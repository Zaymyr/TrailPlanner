// @vitest-environment jsdom

import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "../components/ui/dialog";

afterEach(cleanup);

function TestDialog({ onOpenChange = vi.fn() }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    setOpen(nextOpen);
  };

  return createElement(
    "div",
    null,
    createElement("button", { type: "button", onClick: () => setOpen(true) }, "Open dialog"),
    createElement(
      Dialog,
      { open, onOpenChange: handleOpenChange },
      createElement(
        DialogContent,
        { "aria-label": "Test dialog" },
        createElement("button", { type: "button" }, "First action"),
        createElement("button", { type: "button" }, "Last action")
      )
    )
  );
}

describe("DialogContent", () => {
  it("closes on Escape and restores the triggering focus", () => {
    const onOpenChange = vi.fn();
    render(createElement(TestDialog, { onOpenChange }));

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps Tab navigation within the dialog", () => {
    render(createElement(TestDialog));
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
