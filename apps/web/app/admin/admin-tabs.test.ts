import { describe, expect, it } from "vitest";

import { resolveLegacyAdminUrl } from "./admin-redirects";
import { ADMIN_TABS, raceEditHref, readMessagingView, readOrganizerView, readRaceParam, searchForView } from "./admin-tabs";

describe("admin tabs URL state", () => {
  it("has unique french ids", () => {
    const ids = ADMIN_TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("redirects every former tab id to a console route", () => {
    ADMIN_TABS.forEach((tab) => {
      const target = resolveLegacyAdminUrl("/admin", new URLSearchParams({ onglet: tab.id }));
      expect(target?.startsWith("/admin/")).toBe(true);
    });
  });

  it("reads sub-views with defaults", () => {
    expect(readMessagingView("?onglet=messagerie&vue=questionnaires")).toBe("questionnaires");
    expect(readMessagingView("?vue=demos")).toBe("demos");
    expect(readMessagingView("?vue=autre")).toBe("bugs");
    expect(readOrganizerView("?vue=acces")).toBe("acces");
    expect(readOrganizerView("")).toBe("publication");
  });

  it("omits the default view from the URL", () => {
    expect(searchForView("?onglet=messagerie", "feedback", "bugs")).toBe("?onglet=messagerie&vue=feedback");
    expect(searchForView("?onglet=messagerie&vue=feedback", "bugs", "bugs")).toBe("?onglet=messagerie");
    expect(searchForView("?vue=acces", "publication", "publication")).toBe("");
  });

  it("builds and reads race edit links", () => {
    const href = raceEditHref("11111111-1111-4111-8111-111111111111");
    expect(href).toBe("/admin/catalog/races?course=11111111-1111-4111-8111-111111111111");
    expect(readRaceParam(href.slice(href.indexOf("?")))).toBe("11111111-1111-4111-8111-111111111111");
    expect(readRaceParam("?course=")).toBeNull();
  });
});
