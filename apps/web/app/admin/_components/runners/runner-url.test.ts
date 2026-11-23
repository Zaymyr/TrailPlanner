import { describe, expect, it } from "vitest";

import { DEFAULT_RUNNERS_STATE, nextSort, readRunnersUrl, runnersApiQuery, writeRunnersUrl } from "./runner-url";

const USER = "22222222-2222-4222-8222-222222222222";

describe("runners URL", () => {
  it("reads the defaults from an empty URL and writes them back as nothing", () => {
    expect(readRunnersUrl("")).toEqual(DEFAULT_RUNNERS_STATE);
    expect(writeRunnersUrl(DEFAULT_RUNNERS_STATE)).toBe("");
  });

  it("keeps the lot 1 `?recherche=` (⌘K palette)", () => {
    expect(readRunnersUrl("?recherche=%20camille%40gmail.com%20").search).toBe("camille@gmail.com");
  });

  it("round-trips filters, sort, page and the open profile", () => {
    const state = {
      ...DEFAULT_RUNNERS_STATE,
      search: "trail",
      email: "gmail",
      role: "admin" as const,
      createdFrom: "2026-01-01",
      createdTo: "2026-02-01",
      lastSignInFrom: "2026-11-01",
      lastSignInTo: "2026-11-30",
      sort: "email" as const,
      order: "desc" as const,
      page: 3,
      runnerId: USER,
      tab: "acces" as const,
    };
    const url = writeRunnersUrl(state);
    expect(url).toBe(`?recherche=trail&email=gmail&role=admin&cree_du=2026-01-01&cree_au=2026-02-01&actif_du=2026-11-01&actif_au=2026-11-30&tri=email&ordre=desc&page=3&coureur=${USER}&fiche=acces`);
    expect(readRunnersUrl(url)).toEqual(state);
  });

  it("drops invalid values and leaves the default direction of a column out of the URL", () => {
    expect(readRunnersUrl("?role=root&tri=pwd&page=0&cree_du=hier&coureur=x&fiche=autre")).toEqual(DEFAULT_RUNNERS_STATE);
    expect(writeRunnersUrl({ ...DEFAULT_RUNNERS_STATE, sort: "email", order: "asc" })).toBe("?tri=email");
    expect(readRunnersUrl("?tri=activite")).toMatchObject({ sort: "lastSignInAt", order: "desc" });
    expect(writeRunnersUrl({ ...DEFAULT_RUNNERS_STATE, tab: "acces" })).toBe("");
  });

  it("derives the API query and the header sort toggle", () => {
    expect(runnersApiQuery({ ...DEFAULT_RUNNERS_STATE, role: "user", page: 2 })).toBe(
      "page=2&search=&email=&role=user&createdFrom=&createdTo=&lastSignInFrom=&lastSignInTo=&sort=createdAt&order=desc",
    );
    expect(nextSort({ sort: "createdAt", order: "desc" }, "createdAt")).toEqual({ sort: "createdAt", order: "asc" });
    expect(nextSort({ sort: "createdAt", order: "desc" }, "email")).toEqual({ sort: "email", order: "asc" });
    expect(nextSort({ sort: "email", order: "asc" }, "lastSignInAt")).toEqual({ sort: "lastSignInAt", order: "desc" });
  });
});
