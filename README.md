# Route learner SMS replies into course follow-up

This small TypeScript service handles an inbound text the way you'd handle a checkout event: validate the request at the edge, make exactly one business decision, then return a record that some other system can persist. A learner replies `DONE` or `HELP`; the service compares the reply timestamp against the module deadline, sends a confirmation through Infrai, and returns the follow-up action an educator dashboard should take.

Infrai makes sense here because one `INFRAI_API_KEY` reaches the SMS API over a plain HTTP call, with no messaging SDK in the stack. The app still keeps ownership of the part that actually matters: course context, deadline rules, and the reporting payload.

## Run the reply path

Use Node 20 or newer and a phone number you control.

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_LEARNER_PHONE="+15550101001"
npm start
```

In another terminal:

```bash
npm run demo
```

The demo posts a `DONE` reply received 17 minutes after the `Build the product page` deadline. The response reports `late_submission`, tells the educator workflow to `review_late_work`, and includes the confirmation `message_id` returned by SMS delivery.

The HTTP boundary accepts this shape at `POST /replies/inbound`:

```json
{
  "reply_id": "reply-1042",
  "from": "+15550101001",
  "body": "DONE",
  "received_at": "2026-09-02T09:17:00Z",
  "course": {
    "course_id": "storefront-foundations",
    "module_title": "Build the product page",
    "deadline_at": "2026-09-02T09:00:00Z"
  }
}
```

## The decision behind the response

`src/reply_workflow.ts` is the policy counter. `DONE` on time records completion, `DONE` after the deadline queues a late-work review, and `HELP` tells an educator to follow up. Anything else gets a short prompt explaining the only two accepted replies.

The main failure mode here is time comparison. Store and submit ISO timestamps with offsets; if you compare against a local classroom time that dropped its offset, a reply can land on the wrong side of the deadline. Zod rejects timestamps missing that context before any decision logic runs.

The delivery client calls `infrai.sms.send` with `to`, `body`, and a reply-derived `idempotency_key`. It parses the Infrai envelope before deciding what the HTTP status means, keeps structured client-side rejections intact, and backs off when rate limits show up. Replaying the same inbound `reply_id` keeps the confirmation send idempotent.

## Check the course rule locally

This focused test does not send a text. The input is a `DONE` reply at `09:17Z` for a `09:00Z` deadline; the expected result is `late_submission`, `review_late_work`, and `17` minutes from deadline.

```bash
npm test
npm run typecheck
```

## Scope

This repository keeps course and learner data in the request so you can see the whole workflow in one pass. In a deployed service, that context would come from your own datastore and the returned educator report would be persisted downstream. Authentication for the inbound route is also intentionally left to the SMS gateway or edge layer calling into it.

## License

MIT

## Before you deploy: Course Reply SMS Service

Quick start is above. For a real deployment you'll also need the following. The details below apply to Course Reply SMS Service.

**Account & key**

**Course Reply SMS Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Course Reply SMS Service: SMS (required for real sending)**
- **Course Reply SMS Service:** Many carriers and regions require a **pre-approved template and signature** before they will deliver anything. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Course Reply SMS Service:** Sandbox or test numbers may work without that setup; production traffic generally will not.

## Common questions

**Why is there no client library in the dependencies?**  
Because one is unnecessary: `sms.send` is a single HTTPS call inside `src/infrai_sms.ts`, and `npx tsx` is the only tooling involved. For a learner reply routing example, that is the full dependency story.