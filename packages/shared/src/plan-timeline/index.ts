// Plan-timeline engine shared by web and mobile: section summaries (pace, fatigue, elevation),
// the continuous intake chronology and its display compaction. Pure TypeScript only:
// no React, React Native, DOM, Node or network dependency may be imported here, because the
// Expo app bundles these files directly through relative imports (see docs/01-architecture/packages.md).
export * from './types';
export * from './profile-utils';
export * from './section-summary';
export * from './plan-values';
export * from './continuous-nutrition';
export * from './presentation';
