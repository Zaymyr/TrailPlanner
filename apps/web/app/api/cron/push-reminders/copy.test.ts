import { describe, expect, it } from "vitest";

import {
  buildInactiveReminderCopy,
  buildUnfinishedPlanReminderCopy,
} from "../../../../lib/push";

describe("push reminder copy", () => {
  it("uses accented French copy for inactivity reminders", () => {
    expect(buildInactiveReminderCopy("fr")).toEqual({
      title: "Ton prochain plan t'attend",
      body: "Cela fait quelques jours. Reviens voir ton plan et reprendre ta préparation.",
    });
  });

  it("uses accented French copy for unfinished plan reminders", () => {
    expect(buildUnfinishedPlanReminderCopy("fr", "Plan Templiers")).toEqual({
      title: "Ton plan n'est pas terminé",
      body: "Reviens finaliser Plan Templiers et ajouter tes ravitos.",
    });
  });
});
