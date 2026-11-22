import { describe, expect, it } from "vitest";

import { ADMIN_TABS, raceEditHref, readAdminTab, readMessagingView, readOrganizerView, readRaceParam, searchForTab, searchForView } from "./admin-tabs";

describe("admin tabs URL state", () => {
  it("has unique french ids", () => {
    const ids = ADMIN_TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reads the tab and falls back to produits", () => {
    expect(readAdminTab("?onglet=messagerie")).toBe("messagerie");
    expect(readAdminTab("?onglet=croissance&x=1")).toBe("croissance");
    expect(readAdminTab("?onglet=inconnu")).toBe("produits");
    expect(readAdminTab("")).toBe("produits");
  });

  it("reads sub-views with defaults", () => {
    expect(readMessagingView("?onglet=messagerie&vue=questionnaires")).toBe("questionnaires");
    expect(readMessagingView("?vue=demos")).toBe("demos");
    expect(readMessagingView("?vue=autre")).toBe("bugs");
    expect(readOrganizerView("?vue=acces")).toBe("acces");
    expect(readOrganizerView("")).toBe("publication");
  });

  it("builds tab searches that drop the previous sub-view and race", () => {
    expect(searchForTab("?onglet=messagerie&vue=bugs", "courses")).toBe("?onglet=courses");
    expect(searchForTab("?onglet=courses&course=abc&utm=1", "utilisateurs")).toBe("?onglet=utilisateurs&utm=1");
  });

  it("omits the default view from the URL", () => {
    expect(searchForView("?onglet=messagerie", "feedback", "bugs")).toBe("?onglet=messagerie&vue=feedback");
    expect(searchForView("?onglet=messagerie&vue=feedback", "bugs", "bugs")).toBe("?onglet=messagerie");
    expect(searchForView("?vue=acces", "publication", "publication")).toBe("");
  });

  it("builds and reads race edit links", () => {
    const href = raceEditHref("11111111-1111-4111-8111-111111111111");
    expect(href).toBe("/admin?onglet=courses&course=11111111-1111-4111-8111-111111111111");
    expect(readRaceParam(href.slice(href.indexOf("?")))).toBe("11111111-1111-4111-8111-111111111111");
    expect(readRaceParam("?course=")).toBeNull();
    expect(readAdminTab(href.slice(href.indexOf("?")))).toBe("courses");
  });
});
