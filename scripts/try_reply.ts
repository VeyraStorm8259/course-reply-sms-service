export {};

const response = await fetch("http://localhost:3000/replies/inbound", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reply_id: `demo-${Date.now()}`,
    from: process.env.DEMO_LEARNER_PHONE,
    body: "DONE",
    received_at: "2026-09-02T09:17:00Z",
    course: {
      course_id: "storefront-foundations",
      module_title: "Build the product page",
      deadline_at: "2026-09-02T09:00:00Z",
    },
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
