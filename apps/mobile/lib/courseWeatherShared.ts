// The race-weather contract and presentation helpers live in packages/shared/src/course-weather so
// the web app and the mobile app read the same `GET /api/race-weather` payload the same way. Mobile
// bundles them through this relative re-export (the mobile pre-check forbids importing the package
// by name).
export * from '../../../packages/shared/src/course-weather';
