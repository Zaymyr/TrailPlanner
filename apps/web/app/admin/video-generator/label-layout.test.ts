import { describe, expect, it } from "vitest";

import {
  boxesOverlap,
  getEndpointLabelSpecs,
  getPinnedLabelBox,
  isBoxInsideFrame,
  resolveLabelVisibility,
  type LabelBox,
  type LabelCandidate,
} from "./label-layout";

const frame = { width: 540, height: 960 };
const box = (left: number, top: number, width = 120, height = 50): LabelBox => ({ left, top, right: left + width, bottom: top + height });

describe("getPinnedLabelBox", () => {
  it("centres the card on the anchor and puts its bottom at the offset", () => {
    expect(getPinnedLabelBox({ x: 200, y: 400 }, { width: 100, height: 40 }, -28)).toEqual({ left: 150, right: 250, top: 332, bottom: 372 });
    expect(getPinnedLabelBox({ x: 200, y: 400 }, { width: 100, height: 40 }, -28, 12).bottom).toBe(384);
  });
});

describe("geometry", () => {
  it("detects overlaps, with a gap", () => {
    expect(boxesOverlap(box(0, 0), box(100, 20))).toBe(true);
    expect(boxesOverlap(box(0, 0), box(130, 0))).toBe(false);
    expect(boxesOverlap(box(0, 0), box(124, 0), 6)).toBe(true);
  });

  it("requires the whole box inside the frame", () => {
    expect(isBoxInsideFrame(box(10, 10), frame)).toBe(true);
    expect(isBoxInsideFrame(box(-1, 10), frame)).toBe(false);
    expect(isBoxInsideFrame(box(430, 10), frame)).toBe(false);
    expect(isBoxInsideFrame(box(10, 920), frame)).toBe(false);
  });
});

describe("resolveLabelVisibility", () => {
  const candidate = (id: string, kind: LabelCandidate["kind"], labelBox: LabelBox | null, active = true): LabelCandidate => ({ id, kind, box: labelBox, active });

  it("shows labels that are apart", () => {
    const verdicts = resolveLabelVisibility([candidate("a", "aid", box(10, 100)), candidate("s", "endpoint", box(300, 500))], frame);
    expect(verdicts.get("a")).toBe(true);
    expect(verdicts.get("s")).toBe(true);
  });

  it("hides the start/finish label under an aid bubble that is shown, whatever the order", () => {
    [[candidate("s", "endpoint", box(100, 300)), candidate("a", "aid", box(150, 320))], [candidate("a", "aid", box(150, 320)), candidate("s", "endpoint", box(100, 300))]].forEach((list) => {
      const verdicts = resolveLabelVisibility(list, frame);
      expect(verdicts.get("a")).toBe(true);
      expect(verdicts.get("s")).toBe(false);
    });
  });

  it("keeps the start/finish label above any other label", () => {
    const verdicts = resolveLabelVisibility([candidate("o", "other", box(100, 300)), candidate("s", "endpoint", box(120, 310))], frame);
    expect(verdicts.get("s")).toBe(true);
    expect(verdicts.get("o")).toBe(false);
  });

  it("an aid bubble that is not shown takes no room", () => {
    const verdicts = resolveLabelVisibility([candidate("a", "aid", box(100, 300), false), candidate("s", "endpoint", box(100, 300))], frame);
    expect(verdicts.get("a")).toBe(false);
    expect(verdicts.get("s")).toBe(true);
  });

  it("hides a label cut by the frame edge and lets the one behind it show", () => {
    const verdicts = resolveLabelVisibility([candidate("a", "aid", box(-40, 300)), candidate("s", "endpoint", box(10, 310))], frame);
    expect(verdicts.get("a")).toBe(false);
    expect(verdicts.get("s")).toBe(true);
  });

  it("hides a label that cannot be projected", () => {
    expect(resolveLabelVisibility([candidate("s", "endpoint", null)], frame).get("s")).toBe(false);
  });

  it("ties between equal priorities keep the list order", () => {
    const verdicts = resolveLabelVisibility([candidate("first", "aid", box(100, 300)), candidate("second", "aid", box(110, 310))], frame);
    expect(verdicts.get("first")).toBe(true);
    expect(verdicts.get("second")).toBe(false);
  });
});

describe("getEndpointLabelSpecs", () => {
  const start = { lat: 46.9, lon: 4.0 };

  it("draws one « Départ / Arrivée » label with the start name on a loop", () => {
    const specs = getEndpointLabelSpecs({ start: "Bibracte", finish: "Bibracte" }, start, { lat: 46.9005, lon: 4.0005 });
    expect(specs).toEqual([{ id: "start-finish", kind: "Départ / Arrivée", name: "Bibracte", atFinish: false }]);
  });

  it("draws nothing for a loop without a name", () => {
    expect(getEndpointLabelSpecs({ start: null, finish: null }, start, start)).toEqual([]);
  });

  it("draws both labels when start and finish are 1.5 km apart or more", () => {
    const specs = getEndpointLabelSpecs({ start: "Saulieu", finish: "Autun" }, start, { lat: 46.9, lon: 4.02 });
    expect(specs.map((spec) => [spec.id, spec.kind, spec.name])).toEqual([["start", "Départ", "Saulieu"], ["finish", "Arrivée", "Autun"]]);
    expect(specs[1].atFinish).toBe(true);
  });
});
