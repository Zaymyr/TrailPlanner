import { expect, test, type Page } from "@playwright/test";

const email = process.env.ORGANIZER_E2E_EMAIL;
const password = process.env.ORGANIZER_E2E_PASSWORD;
const paymentEnabled = process.env.RUN_ORGANIZER_PAYMENT_E2E === "1";

test.skip(!email || !password || !paymentEnabled, "Set the organizer E2E credentials and explicit payment opt-in.");

const fillIfVisible = async (page: Page, label: RegExp, value: string) => {
  const input = page.getByLabel(label).first();
  if (await input.isVisible().catch(() => false)) await input.fill(value);
};

test("organizer creates, publishes, pays for, and deletes a TEST event", async ({ page, request, baseURL }) => {
  const suffix = Date.now();
  const eventName = `TEST E2E ORGANIZER ${suffix}`;
  const startDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let eventId: string | null = null;
  let accessToken: string | null = null;

  await page.route("**/api/resend/contact", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "skipped", reason: "e2e" }) })
  );

  try {
    await page.goto("/organisateurs");
    await page.getByRole("link", { name: /créer mon race book/i }).first().click();
    await expect(page).toHaveURL(/\/organizers/);

    await page.getByRole("link", { name: /se connecter/i }).click();
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();

    await expect(page.locator("#organizer-new-event-name")).toBeVisible();
    await page.locator("#organizer-new-event-name").fill(eventName);
    await page.locator("#organizer-new-event-location").fill("Annecy");
    await page.locator("#organizer-new-event-date").fill(startDate);
    await page.locator("#organizer-new-event-end-date").fill(startDate);
    const createEventResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/organizer/events") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: /créer et continuer/i }).click();
    const createEventResponse = await createEventResponsePromise;
    expect(createEventResponse.ok()).toBeTruthy();
    eventId = (await createEventResponse.json()).event.id as string;

    await expect(page).toHaveURL(/\/organizer/);
    accessToken = await page.evaluate(() => window.localStorage.getItem("trailplanner.accessToken"));
    expect(accessToken).toBeTruthy();

    await page.getByRole("button", { name: "Ajouter un format", exact: true }).click();
    await page.getByLabel("Nom du format").fill("TEST 10K");
    await page.getByLabel("Distance km").fill("10");
    await page.getByLabel("D+").fill("250");
    await page.getByLabel("Site officiel / source du format").fill("https://example.com/test-organizer-race");
    const createRaceResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/organizer/races") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    expect((await createRaceResponsePromise).ok()).toBeTruthy();

    await page.getByRole("button", { name: "Publier le RaceBook", exact: true }).click();
    await expect(page.getByRole("heading", { name: /publier cette édition/i })).toBeVisible();
    const checkoutResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/organizer/publication-checkout") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: /choisir essentiel/i }).click();
    const checkoutResponse = await checkoutResponsePromise;
    expect(checkoutResponse.ok()).toBeTruthy();

    await page.waitForURL(/checkout\.stripe\.com/);
    expect(page.url()).toContain("cs_test_");
    await fillIfVisible(page, /numéro de carte|card number/i, "4242424242424242");
    await fillIfVisible(page, /date d'expiration|expiration|expiry/i, "1234");
    await fillIfVisible(page, /code de sécurité|security code|cvc/i, "123");
    await fillIfVisible(page, /nom du titulaire|name on card/i, "TEST ORGANIZER");
    await fillIfVisible(page, /^adresse|address line 1/i, "1 rue du Test");
    await fillIfVisible(page, /code postal|postal code/i, "74000");
    await fillIfVisible(page, /^ville$|^city$/i, "Annecy");
    await page.getByRole("button", { name: /payer|pay/i }).click();

    await page.waitForURL(/organizerPayment=success/, { timeout: 90_000 });
    await expect(page.getByText(/offre essentiel active/i).first()).toBeVisible({ timeout: 60_000 });

    await page.getByText(/état de l’édition et des formats/i).click();
    await page.getByRole("button", { name: "Supprimer la course", exact: true }).click();
    await page.locator("#organizer-delete-event-confirmation").fill("Supprimer");
    await page.getByRole("button", { name: "Supprimer définitivement", exact: true }).click();
    await expect(page.getByText(eventName)).toHaveCount(0);
    eventId = null;
  } finally {
    if (eventId && accessToken && baseURL) {
      const cleanup = await request.delete(`${baseURL}/api/organizer/events/${eventId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect([200, 404]).toContain(cleanup.status());
    }
  }
});
