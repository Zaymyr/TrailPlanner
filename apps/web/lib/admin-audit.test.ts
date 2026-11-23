import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_FAMILIES,
  IMPORTANT_AUDIT_ACTIONS,
  auditActionLabel,
  auditFamilyOf,
  auditFilters,
  auditTargetHref,
  buildAuditCsv,
  diffAuditValues,
  formatAuditRelative,
  isImportantAuditAction,
  mapAuditRow,
  maskAuditEmail,
  pickAuditFields,
  readAuditQuery,
  sanitizeAuditValue,
  toAuditRow,
  writeAuditQuery,
  type AuditEntry,
} from "./admin-audit";

const ACTOR = "11111111-1111-4111-8111-111111111111";

describe("action catalogue", () => {
  it("gives every action a French label and a known family", () => {
    for (const [key, definition] of Object.entries(AUDIT_ACTIONS)) {
      expect(key).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
      expect(definition.label.length).toBeGreaterThan(3);
      expect(definition.family in AUDIT_FAMILIES).toBe(true);
    }
  });

  it("falls back to the prefix family and a generic label for an unknown action", () => {
    expect(auditFamilyOf("premium.grant")).toBe("premium");
    expect(auditFamilyOf("premium.something-new")).toBe("premium");
    expect(auditActionLabel("premium.something-new")).toContain("premium.something-new");
  });

  it("flags failures and important actions for the overview feed", () => {
    expect(isImportantAuditAction("premium.grant")).toBe(true);
    expect(isImportantAuditAction("message.send")).toBe(false);
    expect(isImportantAuditAction("message.send", "error")).toBe(true);
    expect(IMPORTANT_AUDIT_ACTIONS).toContain("billing.invoice-settle");
    expect(IMPORTANT_AUDIT_ACTIONS).not.toContain("simulation.runner-mode");
  });

  it("lists every action written by a route, and only declared ones", () => {
    const root = join(__dirname, "..", "app", "api");
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name === "route.ts") files.push(path);
      }
    };
    walk(root);
    const used = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("withAdminAudit(")) continue;
      for (const match of source.matchAll(/"((?:premium|user|message|feedback|race-request|organizer|edition|billing|catalog|product|partner|content|automation|render|flyover|survey|maintenance|simulation)\.[a-z0-9-]+)"/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(30);
    for (const action of used) expect(action in AUDIT_ACTIONS, `${action} is missing from AUDIT_ACTIONS`).toBe(true);
  });
});

describe("sanitizeAuditValue", () => {
  it("masks e-mail addresses, in values and in free text", () => {
    expect(maskAuditEmail("Faustin@Gmail.com")).toBe("fa***@gmail.com");
    expect(sanitizeAuditValue({ email: "marie.dupont@example.com", label: "écrire à jean@example.org demain" })).toEqual({
      email: "ma***@example.com",
      label: "écrire à je***@example.org demain",
    });
  });

  it("never keeps secrets, message content, files or contact details", () => {
    const clean = sanitizeAuditValue({
      password: "hunter2",
      apiKey: "sk_live_123",
      accessToken: "abc",
      body: "Bonjour, voici le contenu du message",
      message: "contenu",
      gpx: "<gpx>…</gpx>",
      phone: "0612345678",
      billingAddress: "1 rue de la Paix",
      name: "SaintéLyon",
      tier: "complete",
    }) as Record<string, unknown>;
    expect(clean.name).toBe("SaintéLyon");
    expect(clean.tier).toBe("complete");
    for (const key of ["password", "apiKey", "accessToken", "body", "message", "gpx", "phone", "billingAddress"]) expect(clean[key]).toBe("[non journalisé]");
    expect(JSON.stringify(clean)).not.toContain("hunter2");
    expect(JSON.stringify(clean)).not.toContain("Bonjour");
  });

  it("bounds depth, width and length, and drops empty documents", () => {
    expect(sanitizeAuditValue(null)).toBeNull();
    expect(sanitizeAuditValue({})).toBeNull();
    const long = sanitizeAuditValue({ a: "x ".repeat(400) }) as { a: string };
    expect(long.a.length).toBeLessThanOrEqual(200);
    const list = sanitizeAuditValue({ items: Array.from({ length: 20 }, (_, index) => index) }) as { items: unknown[] };
    expect(list.items).toHaveLength(9);
    expect(list.items[8]).toBe("… +12");
    expect(sanitizeAuditValue({ a: { b: { c: { d: 1 } } } })).toEqual({ a: { b: { c: "[objet]" } } });
    expect(sanitizeAuditValue({ value: "x".repeat(900) })).toEqual({ value: "[valeur longue]" });
    expect(sanitizeAuditValue({ to: "2026-11-23" })).toEqual({ to: "2026-11-23" });
  });

  it("picks only the listed fields", () => {
    expect(pickAuditFields({ a: 1, b: 2, email: "x@y.fr" }, ["a", "email", "missing"])).toEqual({ a: 1, email: "x***@y.fr" });
    expect(pickAuditFields(null, ["a"])).toBeNull();
    expect(pickAuditFields({ b: 2 }, ["a"])).toBeNull();
  });
});

describe("toAuditRow", () => {
  it("builds a valid row with bounded fields", () => {
    const row = toAuditRow({
      actorUserId: ACTOR.toUpperCase(),
      actorLabel: "fa***@gmail.com",
      action: "premium.grant",
      targetType: "user",
      targetId: 42,
      summary: "Premium accordé  à   un coureur",
      after: { reason: "Geste commercial", email: "lea@example.com" },
      requestPath: "POST /api/admin/premium",
    });
    expect(row).toMatchObject({
      actor_user_id: ACTOR,
      action: "premium.grant",
      target_type: "user",
      target_id: "42",
      summary: "Premium accordé à un coureur",
      before: null,
      after: { reason: "Geste commercial", email: "le***@example.com" },
      status: "ok",
      error: null,
    });
  });

  it("keeps a failure with a truncated, masked error and rejects invalid identities", () => {
    const row = toAuditRow({ actorUserId: ACTOR, action: "billing.invoice-create", targetType: "invoice", summary: "x", status: "error", error: `${"e".repeat(400)} lea@example.com` });
    expect(row?.status).toBe("error");
    expect(row?.error?.length).toBeLessThanOrEqual(300);
    expect(toAuditRow({ actorUserId: "not-a-uuid", action: "premium.grant", targetType: "user", summary: "x" })).toBeNull();
    expect(toAuditRow({ actorUserId: ACTOR, action: "Premium Grant", targetType: "user", summary: "x" })).toBeNull();
    expect(toAuditRow({ actorUserId: ACTOR, action: "premium.grant", targetType: "", summary: "x" })).toBeNull();
  });
});

describe("read query", () => {
  it("normalises the URL parameters and drops unknown values", () => {
    const query = readAuditQuery(new URLSearchParams({
      du: "2026-11-30",
      au: "2026-11-01",
      acteur: ACTOR,
      action: "premium, billing.invoice-settle ,BAD ACTION",
      cible: "user-1",
      statut: "echec",
      recherche: "  facture  ",
      page: "3",
      entree: "not-a-uuid",
    }));
    expect(query).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      actor: ACTOR,
      actions: ["premium", "billing.invoice-settle"],
      target: "user-1",
      status: "error",
      search: "facture",
      page: 3,
      entryId: null,
    });
    expect(readAuditQuery(new URLSearchParams({ du: "nope", statut: "x", page: "-4" }))).toMatchObject({ from: null, status: null, page: 1 });
  });

  it("round-trips through the URL", () => {
    const query = readAuditQuery(new URLSearchParams("du=2026-11-01&action=premium&statut=reussie&page=2&recherche=a"));
    expect(writeAuditQuery(query).toString()).toBe("du=2026-11-01&action=premium&statut=reussie&recherche=a&page=2");
  });

  it("builds PostgREST filters: family prefix, exact action, target, search, bounds", () => {
    const query = readAuditQuery(new URLSearchParams({ action: "premium,billing.invoice-settle", cible: "abc", recherche: "a,b)(*%", statut: "reussie", acteur: ACTOR }));
    const filters = auditFilters(query, { fromIso: "2026-10-31T23:00:00.000Z", toIso: "2026-11-30T23:00:00.000Z" });
    expect(filters).toContain(`actor_user_id=eq.${ACTOR}`);
    expect(filters).toContain("status=eq.ok");
    expect(filters).toContain("or=(action.like.premium.*,action.eq.billing.invoice-settle)");
    expect(filters).toContain("or=(target_id.eq.abc,target_type.eq.abc)");
    expect(filters).toContain("created_at=gte.2026-10-31T23%3A00%3A00.000Z");
    expect(filters.find((filter) => filter.includes("summary.ilike"))).toBe("or=(summary.ilike.*a%20b*,action.ilike.*a%20b*,target_id.ilike.*a%20b*,actor_label.ilike.*a%20b*)");
    expect(auditFilters(readAuditQuery(new URLSearchParams({ entree: "22222222-2222-4222-8222-222222222222", statut: "echec" })), {})).toEqual(["id=eq.22222222-2222-4222-8222-222222222222"]);
  });
});

describe("target links", () => {
  it("opens the sheet of the target when there is one", () => {
    expect(auditTargetHref("user", "abc")).toBe("/admin/runners?coureur=abc");
    expect(auditTargetHref("edition", "e1")).toBe("/admin/organizers?edition=e1");
    expect(auditTargetHref("race", "r1")).toBe("/admin/catalog/races?course=r1");
    expect(auditTargetHref("post", "p1")).toBe("/admin/content/posts?post=p1");
    expect(auditTargetHref("render", "j1")).toBe("/admin/content/renders?rendu=j1");
    expect(auditTargetHref("flyover", "o1")).toBe("/admin/content/flyovers?commande=o1");
    expect(auditTargetHref("invoice", "organizer_invoice:i1")).toBe("/admin/billing?ligne=organizer_invoice%3Ai1");
    expect(auditTargetHref("simulation", "premium")).toBeNull();
    expect(auditTargetHref("unknown", "x")).toBeNull();
  });

  it("never builds a link from an unsafe identifier", () => {
    expect(auditTargetHref("user", "a&b=c/../x")).toBe("/admin/runners");
    expect(auditTargetHref("user", null)).toBe("/admin/runners");
  });
});

describe("diffAuditValues", () => {
  it("compares field by field, changed lines first", () => {
    const rows = diffAuditValues({ tier: "essential", modules: { a: true }, same: 1 }, { tier: "complete", modules: { a: true, b: false }, same: 1 });
    expect(rows.map((row) => `${row.kind}:${row.path}`)).toEqual(["changed:tier", "added:modules.b", "same:modules.a", "same:same"]);
    expect(rows[0]).toMatchObject({ before: "essential", after: "complete" });
  });

  it("handles a missing side", () => {
    expect(diffAuditValues(null, { a: 1 })).toEqual([{ path: "a", before: null, after: "1", kind: "added" }]);
    expect(diffAuditValues({ a: 1 }, null)).toEqual([{ path: "a", before: "1", after: null, kind: "removed" }]);
    expect(diffAuditValues(null, null)).toEqual([]);
  });
});

describe("relative time and CSV", () => {
  const now = new Date("2026-11-23T12:00:00Z");
  it("formats a relative time", () => {
    expect(formatAuditRelative("2026-11-23T11:59:50Z", now)).toBe("à l’instant");
    expect(formatAuditRelative("2026-11-23T11:30:00Z", now)).toBe("il y a 30 min");
    expect(formatAuditRelative("2026-11-23T07:00:00Z", now)).toBe("il y a 5 h");
    expect(formatAuditRelative("2026-11-20T12:00:00Z", now)).toBe("il y a 3 j");
    expect(formatAuditRelative("2026-08-01T12:00:00Z", now)).toBe("le 01/08/2026");
  });

  it("exports a spreadsheet-safe CSV (semicolon, BOM, neutralised formulas)", () => {
    const entry: AuditEntry = mapAuditRow({
      id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-11-23T10:30:00Z",
      actor_user_id: ACTOR,
      actor_label: "fa***@gmail.com",
      action: "premium.grant",
      target_type: "user",
      target_id: "u1",
      summary: "=HYPERLINK(\"http://x\"); « Premium »",
      before: null,
      after: { reason: "x" },
      request_path: "POST /api/admin/premium",
      status: "error",
      error: "502",
    });
    const csv = buildAuditCsv([entry]);
    expect(csv.startsWith("﻿Date;Admin;Action")).toBe(true);
    const [, line] = csv.split("\r\n");
    expect(line).toContain("23/11/2026 11:30:00;fa***@gmail.com;Premium accordé;Premium;Coureur;u1;");
    expect(line).toContain("\"'=HYPERLINK(\"\"http://x\"\"); « Premium »\"");
    expect(line).toContain(";Échec;502;POST /api/admin/premium");
  });
});

describe("mapAuditRow", () => {
  it("names the actor from the identity, then the label, then a short id", () => {
    const row = { id: "i", created_at: "2026-11-23T10:00:00Z", actor_user_id: ACTOR, actor_label: "fa***@gmail.com", action: "user.role", target_type: "user", target_id: "u1", summary: "s", status: "ok" as const };
    expect(mapAuditRow(row, "Faustin").actorName).toBe("Faustin");
    expect(mapAuditRow(row).actorName).toBe("fa***@gmail.com");
    expect(mapAuditRow({ ...row, actor_label: null }).actorName).toBe("Admin 11111111");
    expect(mapAuditRow(row)).toMatchObject({ actionLabel: "Rôles modifiés", familyLabel: "Comptes et rôles", targetHref: "/admin/runners?coureur=u1" });
  });
});
