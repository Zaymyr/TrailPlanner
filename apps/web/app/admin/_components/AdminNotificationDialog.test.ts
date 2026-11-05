// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminNotificationDialog, type AdminNotificationFormValue } from "./AdminNotificationDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminNotificationDialog", () => {
  it("reuses one notification id when a lost response is retried", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
    const submitted: AdminNotificationFormValue[] = [];
    const onSubmit = vi.fn(async (value: AdminNotificationFormValue) => {
      submitted.push(value);
      if (submitted.length === 1) throw new Error("RÃ©ponse perdue");
    });

    render(createElement(AdminNotificationDialog, {
      open: true,
      recipient: "runner@example.com",
      initialTitle: "Mise Ã  jour",
      initialBody: "La demande est traitÃ©e.",
      onOpenChange: vi.fn(),
      onSubmit,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    expect(submitted[0].notificationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(submitted[1].notificationId).toBe(submitted[0].notificationId);
  });
});
