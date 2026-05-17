const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// The workspace also contains the Next.js app, which currently installs React
// 18 at the repo root. React Native 0.81/Expo 54 must render with React 19, so
// force Metro to resolve shared packages from the mobile app first.
config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [mobileNodeModules, workspaceNodeModules];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(mobileNodeModules, 'react'),
  'react-dom': path.resolve(mobileNodeModules, 'react-dom'),
};

module.exports = config;
