import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("RootChrome skip link", () => {
  it("only reveals the shortcut for keyboard focus and clears pointer focus", () => {
    const source = readFileSync(resolve(process.cwd(), "app/root-chrome.tsx"), "utf8");

    expect(source).toContain("focus-visible:translate-y-0");
    expect(source).not.toContain(" focus:translate-y-0");
    expect(source).toContain('if (event.key === "Tab") setKeyboardNavigation(true)');
    expect(source).toContain("if (!keyboardNavigation) event.currentTarget.blur()");
    expect(source).toContain('"pointer-events-none -translate-y-24 opacity-0"');
    expect(source).toContain('document.addEventListener("pointerdown", hideSkipLinkAfterPointerInput, true)');
    expect(source).toContain("skipLinkRef.current?.blur()");
  });
});

describe("RootChrome standalone pages", () => {
  it("leaves the admin console frame to AdminShell (no site header or footer)", () => {
    const source = readFileSync(resolve(process.cwd(), "app/root-chrome.tsx"), "utf8");

    expect(source).toContain(`const STANDALONE_PATHS = new Set(["/links", "/en/links", "/admin"]);`);
    expect(source).toContain(`const STANDALONE_PREFIXES = ["/share/plan/", "/render/", "/admin/"];`);
  });
});
