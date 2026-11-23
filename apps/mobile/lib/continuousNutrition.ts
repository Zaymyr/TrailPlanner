// The continuous intake chronology engine lives in packages/shared/src/plan-timeline so the web
// planner « Chronologie » tab runs exactly the same calculation. Mobile bundles it through this
// relative re-export (the mobile pre-check forbids importing the package by name).
export * from '../../../packages/shared/src/plan-timeline/continuous-nutrition';
