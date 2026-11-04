// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeaderAuth } from "./header-auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    t: {
      navigation: { account: "Compte", profile: "Profil", settings: "Réglages", admin: "Admin" },
      racePlanner: { account: { auth: { signOut: "Se déconnecter", signIn: "Se connecter" } } },
    },
  }),
}));
vi.mock("./hooks/useVerifiedSession", () => ({
  useVerifiedSession: () => ({ session: { role: "user" }, isLoading: false, clearSession: vi.fn() }),
}));
vi.mock("./language-toggle", () => ({ LanguageToggle: () => null }));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));

afterEach(cleanup);

describe("HeaderAuth", () => {
  const openMenu = () => {
    const details = screen.getByText("Compte").closest("details") as HTMLDetailsElement;
    details.open = true;
    return details;
  };

  it("closes the account menu on a click outside", () => {
    render(createElement("div", null, createElement(HeaderAuth), createElement("p", null, "Ailleurs")));
    const details = openMenu();
    fireEvent.pointerDown(screen.getByText("Profil"));
    expect(details.open).toBe(true);
    fireEvent.pointerDown(screen.getByText("Ailleurs"));
    expect(details.open).toBe(false);
  });

  it("closes on Escape and after choosing a link", () => {
    render(createElement(HeaderAuth));
    const details = openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(details.open).toBe(false);
    details.open = true;
    fireEvent.click(screen.getByText("Profil"));
    expect(details.open).toBe(false);
  });
});
