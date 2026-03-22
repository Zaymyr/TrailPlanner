export const legacyRedirectMap = {
  "/trail-nutrition-planner": "/blog/trail-nutrition-planner",
  "/ultra-trail-fueling": "/blog/ultra-trail-fueling-tips",
  "/ravitaillement-trail": "/blog/ravitaillement-trail",
  "/hydration-trail-running": "/blog/hydration-for-trail-running",
} as const;

export type LegacyPath = keyof typeof legacyRedirectMap;

export const legacyPaths = Object.keys(legacyRedirectMap) as LegacyPath[];
