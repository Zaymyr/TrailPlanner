import { describe, expect, it } from "vitest";

import { ADMIN_NAV, ADMIN_NAV_ITEMS, ADMIN_SUBPAGES, breadcrumbFor, findActiveNavItem } from "./admin-routes";

describe("admin console navigation", () => {
  it("lists the groups of the ADR in order", () => {
    expect(ADMIN_NAV.map((group) => group.label)).toEqual([null, "Pilotage", "Clients", "Catalogue", "Contenus", "Communication", "Système"]);
    const hrefs = ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith("/admin"))).toBe(true);
  });

  it("marks the longest matching entry as active", () => {
    expect(findActiveNavItem("/admin")?.href).toBe("/admin");
    expect(findActiveNavItem("/admin/")?.href).toBe("/admin");
    expect(findActiveNavItem("/admin/content")?.href).toBe("/admin/content");
    expect(findActiveNavItem("/admin/content/studio")?.href).toBe("/admin/content/studio");
    expect(findActiveNavItem("/admin/messaging/surveys")?.href).toBe("/admin/messaging/surveys");
    expect(findActiveNavItem("/admin/organizers/social-proofs")?.href).toBe("/admin/organizers");
    expect(findActiveNavItem("/admin/contentx")).toBeNull();
    expect(findActiveNavItem("/organizer")).toBeNull();
  });

  it("builds the breadcrumb with the group and the sub-page", () => {
    expect(breadcrumbFor("/admin")).toEqual([{ label: "Admin", href: "/admin" }, { label: "Vue d’ensemble" }]);
    expect(breadcrumbFor("/admin/content/studio")).toEqual([{ label: "Admin", href: "/admin" }, { label: "Contenus" }, { label: "Studio vidéo" }]);
    expect(breadcrumbFor("/admin/inbox")).toEqual([{ label: "Admin", href: "/admin" }, { label: "À traiter" }]);
    expect(breadcrumbFor("/admin/organizers/social-proofs")).toEqual([
      { label: "Admin", href: "/admin" },
      { label: "Clients" },
      { label: "Organisateurs", href: "/admin/organizers" },
      { label: "Preuves sociales" },
    ]);
  });

  it("attaches every sub-page to a sidebar entry", () => {
    ADMIN_SUBPAGES.forEach((page) => expect(findActiveNavItem(page.href)?.href).toBe(page.parent));
  });
});
