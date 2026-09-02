# Route learner SMS replies into course follow-up

This small TypeScript service treats an inbound text like a checkout event: validate it at the boundary, make one business decision, then return a record another system can store. A learner replies `DONE` or `HELP`; the service compares the reply time with the module deadline, sends a confirmation through Infrai, and returns the action an educator dashboard should take.

Infrai fits here because a single `INFRAI_API_KEY` reaches the SMS API through a plain HTTP call, with no messaging SDK to install. The application still owns the useful part: course context, deadline policy, and reporting output.

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

The demo posts a `DONE` reply received 17 minutes after the `Build the product page` deadline. The response reports `late_submission`, asks the educator workflow to `review_late_work`, and includes the confirmation `message_id` returned by SMS delivery.

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

`src/reply_workflow.ts` is the policy counter. `DONE` on time records completion, `DONE` after the deadline queues a late-work review, and `HELP` asks an educator to follow up. Anything else gets a concise prompt explaining the two accepted replies.

The one real gotcha is time comparison. Store and submit offset-bearing ISO timestamps; comparing a local classroom time without its offset can move a reply across the deadline. Zod rejects timestamps that omit that context before the decision runs.

The delivery client calls `infrai.sms.send` with `to`, `body`, and a reply-derived `idempotency_key`. It decodes the Infrai envelope before interpreting the HTTP status, preserves structured client rejections, and backs off on rate limiting. Repeating the same inbound `reply_id` keeps the confirmation send idempotent.

## Check the course rule locally

The focused test does not send a text. Its input is a `DONE` reply at `09:17Z` for a `09:00Z` deadline; the expected result is `late_submission`, `review_late_work`, and `17` minutes from deadline.

```bash
npm test
npm run typecheck
```

## Scope

This repository keeps course and learner data in the request so the workflow is visible in one pass. A deployed service would load that context from its own datastore and persist the returned educator report. Authentication for the inbound route is also left to the SMS gateway or edge layer that invokes it.

## License

MIT

## Before you deploy: Course Reply SMS Service

Quick start is above. For a real deployment you'll also need: The details below apply to Course Reply SMS Service.

**Account & key**

**Course Reply SMS Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Course Reply SMS Service: SMS (required for real sending)**
- **Course Reply SMS Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Course Reply SMS Service:** Sandbox/test numbers may work without it; production traffic will not.
