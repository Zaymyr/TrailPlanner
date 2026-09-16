import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimeSeriesLineChart } from "../../../components/ui/TimeSeriesLineChart";

describe("TimeSeriesLineChart", () => {
  it("renders labeled series and their accessible SVG", () => {
    const html = renderToStaticMarkup(createElement(TimeSeriesLineChart, {
      title: "Consultations",
      description: "Par jour",
      locale: "fr-FR",
      points: [
        { date: "2026-09-14", values: { readers: 2, opens: 4 } },
        { date: "2026-09-15", values: { readers: 3, opens: 6 } },
      ],
      series: [
        { key: "readers", label: "Lecteurs", color: "#f97316" },
        { key: "opens", label: "Ouvertures", color: "#2563eb" },
      ],
    }));
    expect(html).toContain("Lecteurs");
    expect(html).toContain("Ouvertures");
    expect(html).toContain('aria-label="Consultations. Par jour"');
    expect(html).toContain("<path");
  });

  it("uses the supplied empty message", () => {
    const html = renderToStaticMarkup(createElement(TimeSeriesLineChart, {
      title: "Consultations",
      description: "Par jour",
      locale: "fr-FR",
      points: [],
      series: [{ key: "readers", label: "Lecteurs", color: "#f97316" }],
      emptyMessage: "Pas encore de données.",
    }));
    expect(html).toContain("Pas encore de données.");
    expect(html).not.toContain("<svg");
  });
});
