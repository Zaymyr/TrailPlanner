import { describe, expect, it } from "vitest";

import { buildIntegrationServices } from "./admin-integrations";
import { buildEmailActivity, type PaymentActivity } from "./admin-system-health";

const SECRET_ENV = {
  STRIPE_SECRET_KEY: "sk_live_SECRET_VALUE",
  STRIPE_WEBHOOK_SECRET: "whsec_SECRET_VALUE",
  STRIPE_PRICE_ID: "price_SECRET_VALUE",
  RESEND_API_KEY: "re_SECRET_VALUE",
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.SECRET_VALUE",
  ELEVENLABS_API_KEY: "el_SECRET_VALUE",
  ANTHROPIC_API_KEY: "sk-ant-SECRET_VALUE",
  GCP_PROJECT_ID: "project-SECRET_VALUE",
  VIDEO_RENDER_TOKEN_SECRET: "x".repeat(40),
};

const payments: PaymentActivity = {
  stripeConfigured: true,
  webhookSecretConfigured: true,
  lastEventAt: "2026-11-23T08:00:00Z",
  lastEventSource: "paiement organisateur",
  unprocessed: [],
  failedOrganizerPayments: 0,
  lastOrganizerPaymentAt: "2026-11-23T08:00:00Z",
  lastFlyoverPaidAt: null,
  lastRunnerEventAt: null,
};

describe("buildIntegrationServices", () => {
  it("says present or absent, never the value of a variable", () => {
    const services = buildIntegrationServices({ env: SECRET_ENV, renderConfigured: false, emails: null, payments });
    expect(JSON.stringify(services)).not.toContain("SECRET_VALUE");
    expect(JSON.stringify(services)).not.toContain("x".repeat(32));
    expect(services.map((service) => service.key)).toEqual(["stripe", "resend", "gcp", "mapbox", "elevenlabs", "anthropic", "openai"]);
  });

  it("derives each status from the configuration and the known activity", () => {
    const emails = buildEmailActivity({ configured: true, rows: [{ id: "1", created_at: "2026-11-23T09:00:00Z", category: "flyover/paid", status: "failed", status_code: 500, message: "boom", recipient_masked: null }], recent: null });
    const services = Object.fromEntries(buildIntegrationServices({ env: SECRET_ENV, renderConfigured: false, emails, payments }).map((service) => [service.key, service]));
    expect(services.stripe).toMatchObject({ status: "ok", detail: "Dernier événement : paiement organisateur" });
    expect(services.stripe.checks[2]).toEqual({ label: "Prix configurés (1 sur 8)", present: true });
    expect(services.resend).toMatchObject({ status: "error", detail: "0 envoyé, 1 échec en 24 h" });
    // Part of the Google Cloud variables only: incomplete.
    expect(services.gcp.status).toBe("error");
    expect(services.gcp.checks.find((check) => check.label.startsWith("VIDEO_RENDER_TOKEN_SECRET"))?.present).toBe(true);
    expect(services.mapbox.status).toBe("ok");
    expect(services.openai).toMatchObject({ status: "off", statusLabel: "Non configuré" });
  });

  it("flags Stripe when the webhook left events unprocessed and Google Cloud when nothing is set", () => {
    const services = Object.fromEntries(buildIntegrationServices({
      env: { STRIPE_SECRET_KEY: "a", STRIPE_WEBHOOK_SECRET: "b" },
      renderConfigured: false,
      emails: null,
      payments: { ...payments, unprocessed: [{ eventType: "charge.refunded", receivedAt: "2026-11-23T07:00:00Z", error: null }] },
    }).map((service) => [service.key, service]));
    expect(services.stripe).toMatchObject({ status: "error", detail: "1 événement non traité par le webhook" });
    expect(services.gcp.status).toBe("off");
    expect(services.resend).toMatchObject({ status: "off", detail: "Journal des e-mails illisible" });
  });
});
