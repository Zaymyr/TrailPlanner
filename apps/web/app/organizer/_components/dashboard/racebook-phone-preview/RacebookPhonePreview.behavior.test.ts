import React, { type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RacebookView, RacebookViewModel } from "@pace-yourself/racebook-ui";

const viewCalls = vi.hoisted(() => [] as Array<ComponentProps<typeof RacebookView>>);

// Vitest compiles this Next.js JSX file with the classic runtime in the node suite.
vi.stubGlobal("React", React);

vi.mock("@pace-yourself/racebook-ui", async () => {
  const ReactModule = await import("react");

  return {
    RacebookView: (props: ComponentProps<typeof RacebookView>) => {
      viewCalls.push(props);
      const wavesAvailable = props.model.modules.startWaves && props.model.data.startWaves.length > 0;

      return ReactModule.createElement(
        "div",
        {
          "data-testid": "shared-racebook-view",
          "data-locale": props.locale,
          "data-requested-course-tab": props.activeCourseTab,
          "data-waves-available": String(wavesAvailable),
        },
        props.locale === "fr" ? "Aperçu partagé" : "Shared preview",
      );
    },
  };
});

vi.mock("../../../../../components/ui/button", async () => {
  const ReactModule = await import("react");

  return {
    Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
      ReactModule.createElement("button", props, children),
  };
});

vi.mock("../../../../../components/ui/dialog", async () => {
  const ReactModule = await import("react");
  const passthrough = ({ children }: { children?: ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children);

  return {
    Dialog: ({ children }: { children?: ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    DialogContent: passthrough,
    DialogDescription: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
  };
});

import { RacebookPhonePreview, type RacebookPhonePreviewProps } from "./RacebookPhonePreview";

function modelWithStartWaves(available: boolean): RacebookViewModel {
  return {
    modules: {
      equipment: true,
      bibPickup: true,
      access: true,
      services: true,
      startWaves: available,
      aidStations: true,
      relay: true,
      awards: true,
      officialProducts: true,
      sponsors: true,
    },
    data: {
      editionServices: [],
      startWaves: available ? [{ id: "wave-1" }] : [],
      awards: [],
      relayPoints: [],
    },
  } as unknown as RacebookViewModel;
}

function props(overrides: Partial<RacebookPhonePreviewProps> = {}): RacebookPhonePreviewProps {
  return {
    model: modelWithStartWaves(false),
    locale: "fr",
    onLocaleChange: vi.fn(),
    previewMode: "content",
    onPreviewModeChange: vi.fn(),
    formats: [{ id: "race-1", label: "42 km" }],
    selectedFormatId: "race-1",
    onFormatChange: vi.fn(),
    activeTab: "course",
    activeCourseTab: "start-waves",
    onTabChange: vi.fn(),
    onCourseTabChange: vi.fn(),
    ...overrides,
  };
}

describe("RacebookPhonePreview behavior", () => {
  beforeEach(() => {
    viewCalls.length = 0;
  });

  it("keeps a requested tab selected when its hydrated content becomes available", () => {
    const beforeHydration = renderToStaticMarkup(React.createElement(RacebookPhonePreview, props()));
    expect(beforeHydration).toContain('data-requested-course-tab="start-waves"');
    expect(beforeHydration).toContain('data-waves-available="false"');

    viewCalls.length = 0;
    const afterHydration = renderToStaticMarkup(
      React.createElement(RacebookPhonePreview, props({ model: modelWithStartWaves(true) })),
    );

    expect(afterHydration).toContain('data-requested-course-tab="start-waves"');
    expect(afterHydration).toContain('data-waves-available="true"');
    expect(viewCalls.every((call) => call.activeCourseTab === "start-waves")).toBe(true);
  });

  it.each([
    ["fr", "Aperçu partagé"],
    ["en", "Shared preview"],
  ] as const)("forwards the %s locale to every shared preview surface", (locale, expectedCopy) => {
    const markup = renderToStaticMarkup(React.createElement(RacebookPhonePreview, props({ locale })));

    expect(markup).toContain(expectedCopy);
    expect(viewCalls.length).toBeGreaterThan(0);
    expect(viewCalls.every((call) => call.locale === locale)).toBe(true);
  });

  it("neutralizes external actions and analytics in every web preview surface", () => {
    renderToStaticMarkup(React.createElement(RacebookPhonePreview, props()));

    expect(viewCalls.length).toBeGreaterThan(0);
    for (const call of viewCalls) {
      expect(call.adapters).toBeUndefined();
      expect(call.onInteraction).toBeUndefined();
    }
  });
});
