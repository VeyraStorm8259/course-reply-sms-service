import assert from "node:assert/strict";
import test from "node:test";
import { decideReply, inboundReplySchema } from "../src/reply_workflow.js";

test("a DONE reply after the course deadline is routed for educator review", () => {
  const input = inboundReplySchema.parse({
    reply_id: "reply-1042",
    from: "+15550101001",
    body: "done",
    received_at: "2026-09-02T09:17:00Z",
    course: {
      course_id: "commerce-101",
      module_title: "Build the product page",
      deadline_at: "2026-09-02T09:00:00Z",
    },
  });

  const decision = decideReply(input);

  assert.equal(decision.learner_status, "late_submission");
  assert.equal(decision.educator_action, "review_late_work");
  assert.equal(decision.report.minutes_from_deadline, 17);
});
