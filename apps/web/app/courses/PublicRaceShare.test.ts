import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copyPublicRaceLink,
  getFacebookShareUrl,
  sharePublicRace
} from "./_components/PublicRaceShare";

const originalNavigator = globalThis.navigator;
const originalDocument = globalThis.document;

function setNavigator(value: Partial<Navigator>) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

function setDocument(value: Partial<Document>) {
  Object.defineProperty(globalThis, "document", { configurable: true, value });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
});

describe("public race sharing", () => {
  it("uses the native share sheet when it is available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });

    await expect(sharePublicRace("Trail des Crêtes", "https://paceyourself.app/courses/trail")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://paceyourself.app/courses/trail" }));
  });

  it("does not copy after native share cancellation", async () => {
    const cancellation = new Error("cancelled");
    cancellation.name = "AbortError";
    const writeText = vi.fn();
    setNavigator({ share: vi.fn().mockRejectedValue(cancellation), clipboard: { writeText } as Clipboard });

    await expect(sharePublicRace("Trail", "https://example.com/trail")).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } as Clipboard });

    await expect(sharePublicRace("Trail", "https://example.com/trail")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com/trail");
  });

  it("falls back to execCommand when Clipboard is unavailable", async () => {
    const remove = vi.fn();
    const textarea = { value: "", setAttribute: vi.fn(), style: {}, select: vi.fn(), remove };
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    setNavigator({});
    setDocument({
      createElement: vi.fn().mockReturnValue(textarea),
      body: { appendChild } as unknown as HTMLElement,
      execCommand
    });

    await expect(copyPublicRaceLink("https://example.com/trail")).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(remove).toHaveBeenCalled();
  });

  it("builds an encoded Facebook share URL", () => {
    expect(getFacebookShareUrl("https://example.com/course?a=1&b=2")).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fcourse%3Fa%3D1%26b%3D2"
    );
  });
});
