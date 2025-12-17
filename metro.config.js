// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix Windows watch mode issues by configuring the watcher
// NOTE: Metro's `watcher` config does NOT support `usePolling` / `interval` in Expo SDK 54.
// Those keys cause the "Unknown option" warnings and can prevent watch mode from starting.
// If you still hit watcher issues on Windows, prefer starting with:
//   set EXPO_USE_METRO_WORKSPACE_ROOT=1
//   npx expo start --dev-client --clear
// or moving the project to a local disk folder outside OneDrive, and ensuring AV exclusions.
config.watcher = {
  additionalExts: ['cjs', 'mjs'],
  healthCheck: {
    enabled: true,
  },
};

module.exports = config;

