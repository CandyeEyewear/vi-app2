# NetInfo Installation Instructions

The `@react-native-community/netinfo` package needs to be properly installed for network monitoring to work.

## Quick Fix

Run this command in your terminal (use Command Prompt if PowerShell is blocked):

```bash
npm install
```

Then clear the Metro bundler cache and restart:

```bash
npx expo start --clear
```

## If That Doesn't Work

### Option 1: Use Expo Install (Recommended)

The package needs to be installed with the correct version for Expo SDK 54:

```bash
npx expo install @react-native-community/netinfo
```

### Option 2: Manual Installation

1. Delete `node_modules` folder
2. Delete `package-lock.json` (if it exists)
3. Run `npm install`
4. Clear cache: `npx expo start --clear`

### Option 3: Rebuild Native Code

If you're using a development build, you may need to rebuild:

```bash
npx expo prebuild --clean
npx expo run:android
```

## Current Status

The app has been updated to work **without** NetInfo as a fallback. Network monitoring will be disabled, but the app will still function. Once you install the package properly, network monitoring will automatically work.

## Verification

After installation, check that:
1. The package exists in `node_modules/@react-native-community/netinfo`
2. No bundling errors occur
3. Network status banner appears when offline (if NetInfo is working)

## Alternative: Remove Network Monitoring

If you don't need network monitoring, you can:
1. Remove `NetworkProvider` from `app/_layout.tsx`
2. Remove `NetworkStatusBanner` from `app/_layout.tsx`
3. Remove `@react-native-community/netinfo` from `package.json`

The app will work fine without it, but users won't see offline indicators.

