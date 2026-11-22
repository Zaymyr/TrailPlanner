import { describe, expect, it } from "vitest";

import { availableFlyoverActions, planFlyoverAdminAction } from "./flyover-admin";

type Order = Parameters<typeof planFlyoverAdminAction>[0];
const order = (patch: Partial<Order> = {}): Order => ({
  status: "paid",
  work: null,
  paid_at: "2026-11-22T20:37:59Z",
  social_post_id: null,
  ready_at: null,
  ...patch,
});

describe("planFlyoverAdminAction", () => {
  it("cancels any open order, guarded on its open statuses, and takes the collab post back to draft", () => {
    const plan = planFlyoverAdminAction(order({ status: "ready", social_post_id: "post-1" }), "cancel");
    expect(plan).toMatchObject({ ok: true, patch: { status: "cancelled" }, unschedulePostId: "post-1" });
    expect(plan.ok && plan.guard).toBe("status=in.(pending_payment,paid,scripted,rendering,ready,failed)");
    expect(planFlyoverAdminAction(order({ status: "cancelled" }), "cancel").ok).toBe(false);
    expect(planFlyoverAdminAction(order({ status: "refunded" }), "cancel").ok).toBe(false);
  });

  it("retries a failed or cancelled paid order from the last step done", () => {
    expect(planFlyoverAdminAction(order({ status: "failed", work: { content: {} } }), "retry")).toMatchObject({ ok: true, patch: { status: "scripted", attempts: 0, error: null, render_job_id: null } });
    expect(planFlyoverAdminAction(order({ status: "cancelled" }), "retry")).toMatchObject({ ok: true, patch: { status: "paid" } });
    expect(planFlyoverAdminAction(order({ status: "rendering" }), "retry").ok).toBe(false);
    expect(planFlyoverAdminAction(order({ status: "cancelled", paid_at: null }), "retry").ok).toBe(false);
  });

  it("rewrites the text from scratch before the render, never during it", () => {
    expect(planFlyoverAdminAction(order({ status: "scripted", work: { content: {} } }), "rewrite")).toMatchObject({ ok: true, patch: { status: "paid", work: null } });
    expect(planFlyoverAdminAction(order({ status: "rendering" }), "rewrite").ok).toBe(false);
  });

  it("resends the ready email of a delivered order only", () => {
    expect(planFlyoverAdminAction(order({ status: "ready" }), "resend_ready_email")).toMatchObject({ ok: true, patch: { ready_email_sent_at: null } });
    expect(planFlyoverAdminAction(order({ status: "paid" }), "resend_ready_email").ok).toBe(false);
  });

  it("lists the actions the list offers", () => {
    expect(availableFlyoverActions(order({ status: "rendering" }))).toEqual(["cancel"]);
    expect(availableFlyoverActions(order({ status: "failed", work: { content: {} } }))).toEqual(["cancel", "retry", "rewrite"]);
    expect(availableFlyoverActions(order({ status: "pending_payment", paid_at: null }))).toEqual(["cancel"]);
    expect(availableFlyoverActions(order({ status: "expired", paid_at: null }))).toEqual([]);
  });
});
