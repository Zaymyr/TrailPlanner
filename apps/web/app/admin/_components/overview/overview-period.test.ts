import { describe, expect, it } from "vitest";

import { readInboxMode, searchForInboxMode } from "../inbox/inbox-mode";
import { overviewApiQuery, readOverviewPeriod, searchForPeriod } from "./overview-period";

describe("overview period in the URL", () => {
  it("reads ?periode= with 7 days by default", () => {
    expect(readOverviewPeriod("")).toEqual({ key: "7d", from: null, to: null });
    expect(readOverviewPeriod("?periode=30j")).toEqual({ key: "30d", from: null, to: null });
    expect(readOverviewPeriod("?periode=personnalise&du=2026-11-01&au=2026-11-10")).toEqual({ key: "custom", from: "2026-11-01", to: "2026-11-10" });
    expect(readOverviewPeriod("?periode=personnalise&du=hier")).toEqual({ key: "custom", from: null, to: null });
    expect(readOverviewPeriod("?periode=bogus").key).toBe("7d");
  });

  it("writes the period and keeps the other parameters", () => {
    expect(searchForPeriod("?x=1&periode=30j", { key: "7d", from: null, to: null })).toBe("?x=1");
    expect(searchForPeriod("", { key: "today", from: null, to: null })).toBe("?periode=aujourdhui");
    expect(searchForPeriod("", { key: "custom", from: "2026-11-01", to: "2026-11-10" })).toBe("?periode=personnalise&du=2026-11-01&au=2026-11-10");
  });

  it("builds the API query", () => {
    expect(overviewApiQuery({ key: "30d", from: null, to: null })).toBe("range=30d");
    expect(overviewApiQuery({ key: "custom", from: "2026-11-01", to: "2026-11-10" })).toBe("range=custom&from=2026-11-01&to=2026-11-10");
  });
});

describe("tabs of /admin/inbox", () => {
  it("opens « Traiter » for a Messagerie sub-tab and the queue otherwise", () => {
    expect(readInboxMode("")).toBe("file");
    expect(readInboxMode("?filtre=bugs")).toBe("file");
    expect(readInboxMode("?vue=demos")).toBe("traiter");
    expect(readInboxMode("?vue=questionnaires")).toBe("file");
  });

  it("switches tab in the URL", () => {
    expect(searchForInboxMode("?filtre=bugs", "traiter")).toBe("?filtre=bugs&vue=bugs");
    expect(searchForInboxMode("?vue=feedback", "traiter")).toBe("?vue=feedback");
    expect(searchForInboxMode("?vue=feedback&filtre=bugs", "file")).toBe("?filtre=bugs");
  });
});
