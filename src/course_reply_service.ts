import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_sms.js";
import { decideReply, inboundReplySchema } from "./reply_workflow.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/replies/inbound") {
    return json(response, 404, { error: "route_not_found" });
  }

  try {
    const input = inboundReplySchema.parse(await readJson(request));
    const decision = decideReply(input);
    const delivery = decision.confirmation_body
      ? await infrai.sms.send({
          to: input.from,
          body: decision.confirmation_body,
          idempotency_key: `course-reply-${input.reply_id}`,
        })
      : null;

    return json(response, 200, {
      learner_status: decision.learner_status,
      educator_action: decision.educator_action,
      educator_report: decision.report,
      confirmation_message_id: delivery?.message_id ?? null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(response, 400, { error: "invalid_reply", issues: error.issues });
    }
    if (error instanceof SyntaxError) {
      return json(response, 400, { error: "invalid_json" });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, {
        error: "sms_rejected",
        details: error.details,
      });
    }
    console.error(error);
    return json(response, 500, { error: "request_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`Course reply service listening on http://localhost:${port}`);
  });
}
