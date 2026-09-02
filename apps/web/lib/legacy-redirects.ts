export const legacyRedirectMap = {
  "/trail-nutrition-planner": "/race-planner",
  "/ultra-trail-fueling": "/blog/quelle-nutrition-pour-un-trail",
  "/ravitaillement-trail": "/blog/ravitaillement-trail",
  "/hydration-trail-running": "/blog/hydration-for-trail-running",
} as const;

export type LegacyPath = keyof typeof legacyRedirectMap;

export const legacyPaths = Object.keys(legacyRedirectMap) as LegacyPath[];
