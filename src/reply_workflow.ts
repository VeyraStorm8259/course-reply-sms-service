import { z } from "zod";

export const inboundReplySchema = z.object({
  reply_id: z.string().min(1),
  from: z.string().min(7),
  body: z.string().trim().min(1).max(480),
  received_at: z.string().datetime({ offset: true }),
  course: z.object({
    course_id: z.string().min(1),
    module_title: z.string().min(1),
    deadline_at: z.string().datetime({ offset: true }),
  }),
});

export type InboundReply = z.infer<typeof inboundReplySchema>;
export type ReplyDecision = {
  learner_status: "submitted" | "late_submission" | "needs_help" | "unrecognized";
  educator_action: "record_completion" | "review_late_work" | "follow_up" | "none";
  confirmation_body: string | null;
  report: {
    course_id: string;
    module_title: string;
    learner_phone: string;
    received_at: string;
    deadline_at: string;
    minutes_from_deadline: number;
  };
};

export function decideReply(input: InboundReply): ReplyDecision {
  const normalized = input.body.trim().toUpperCase();
  const receivedAt = Date.parse(input.received_at);
  const deadlineAt = Date.parse(input.course.deadline_at);
  const minutesFromDeadline = Math.trunc((receivedAt - deadlineAt) / 60_000);
  const report = {
    course_id: input.course.course_id,
    module_title: input.course.module_title,
    learner_phone: input.from,
    received_at: input.received_at,
    deadline_at: input.course.deadline_at,
    minutes_from_deadline: minutesFromDeadline,
  };

  if (normalized === "HELP") {
    return {
      learner_status: "needs_help",
      educator_action: "follow_up",
      confirmation_body: `We told your educator you need help with ${input.course.module_title}.`,
      report,
    };
  }

  if (normalized === "DONE" && receivedAt <= deadlineAt) {
    return {
      learner_status: "submitted",
      educator_action: "record_completion",
      confirmation_body: `${input.course.module_title} is recorded as complete.`,
      report,
    };
  }

  if (normalized === "DONE") {
    return {
      learner_status: "late_submission",
      educator_action: "review_late_work",
      confirmation_body: `${input.course.module_title} is recorded for educator review.`,
      report,
    };
  }

  return {
    learner_status: "unrecognized",
    educator_action: "none",
    confirmation_body: "Reply DONE when your work is submitted, or HELP to contact your educator.",
    report,
  };
}
