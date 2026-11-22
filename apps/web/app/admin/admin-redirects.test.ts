import { describe, expect, it } from "vitest";

import { resolveLegacyAdminUrl, toSearchParams } from "./admin-redirects";

const resolve = (url: string) => {
  const parsed = new URL(url, "https://example.test");
  return resolveLegacyAdminUrl(parsed.pathname, parsed.searchParams);
};

describe("resolveLegacyAdminUrl", () => {
  it("leaves the console home and new routes alone", () => {
    expect(resolve("/admin")).toBeNull();
    expect(resolve("/admin/catalog/races?course=abc")).toBeNull();
    expect(resolve("/admin/content/posts?onglet=reels")).toBeNull();
  });

  it("maps every /admin tab of lot 0", () => {
    expect(resolve("/admin?onglet=produits")).toBe("/admin/catalog/products");
    expect(resolve("/admin?onglet=utilisateurs")).toBe("/admin/runners");
    expect(resolve("/admin?onglet=messagerie")).toBe("/admin/inbox");
    expect(resolve("/admin?onglet=templates")).toBe("/admin/content/posts?onglet=templates");
    expect(resolve("/admin?onglet=courses")).toBe("/admin/catalog/races");
    expect(resolve("/admin?onglet=organisateurs")).toBe("/admin/organizers");
    expect(resolve("/admin?onglet=preuves")).toBe("/admin/organizers/social-proofs");
    expect(resolve("/admin?onglet=partenaires")).toBe("/admin/catalog/partners");
    expect(resolve("/admin?onglet=croissance")).toBe("/admin/analytics");
  });

  it("keeps the sub-view and the race being edited", () => {
    expect(resolve("/admin?onglet=messagerie&vue=demandes")).toBe("/admin/inbox?vue=demandes");
    expect(resolve("/admin?onglet=messagerie&vue=demos")).toBe("/admin/inbox?vue=demos");
    expect(resolve("/admin?onglet=messagerie&vue=bugs")).toBe("/admin/inbox");
    expect(resolve("/admin?onglet=messagerie&vue=questionnaires")).toBe("/admin/messaging/surveys");
    expect(resolve("/admin?onglet=messagerie&vue=inconnu")).toBe("/admin/inbox");
    expect(resolve("/admin?onglet=organisateurs&vue=acces")).toBe("/admin/organizers?vue=acces");
    expect(resolve("/admin?onglet=organisateurs&vue=publication")).toBe("/admin/organizers");
    expect(resolve("/admin?onglet=courses&course=11111111-1111-4111-8111-111111111111")).toBe(
      "/admin/catalog/races?course=11111111-1111-4111-8111-111111111111",
    );
  });

  it("sends an unknown tab to the console home", () => {
    expect(resolve("/admin?onglet=inconnu")).toBe("/admin");
    expect(resolve("/admin?onglet=")).toBe("/admin");
  });

  it("maps every Publications tab", () => {
    expect(resolve("/admin/publications")).toBe("/admin/content");
    expect(resolve("/admin/publications?onglet=agenda")).toBe("/admin/content");
    expect(resolve("/admin/publications?onglet=reels")).toBe("/admin/content/posts");
    expect(resolve("/admin/publications?onglet=carousels")).toBe("/admin/content/posts?onglet=carousels");
    expect(resolve("/admin/publications?onglet=published")).toBe("/admin/content/posts?onglet=published");
    expect(resolve("/admin/publications?onglet=flyovers")).toBe("/admin/content/flyovers");
    expect(resolve("/admin/publications?onglet=gpx")).toBe("/admin/catalog/races?vue=qualite");
    expect(resolve("/admin/publications?onglet=settings")).toBe("/admin/system/automation");
    expect(resolve("/admin/publications/")).toBe("/admin/content");
  });

  it("moves the video generator to the studio", () => {
    expect(resolve("/admin/video-generator")).toBe("/admin/content/studio");
  });
});

describe("toSearchParams", () => {
  it("keeps the first value of a repeated key and skips undefined", () => {
    expect(toSearchParams({ onglet: ["courses", "produits"], course: "abc", vide: undefined }).toString()).toBe("onglet=courses&course=abc");
    expect(toSearchParams(undefined).toString()).toBe("");
  });
});
