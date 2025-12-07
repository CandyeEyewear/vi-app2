// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix Windows watch mode issues by configuring the watcher
config.watcher = {
  additionalExts: ['cjs', 'mjs'],
  healthCheck: {
    enabled: true,
  },
  // Use polling on Windows to avoid file system watcher issues
  usePolling: process.platform === 'win32',
  interval: 100,
};

module.exports = config;

