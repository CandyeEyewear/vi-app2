# VIbe Deployment Guide

This document explains how to deploy updates to the VIbe app using our automated GitHub Actions workflows.

## Table of Contents

- [Overview](#overview)
- [Two Types of Updates](#two-types-of-updates)
- [OTA Updates (Instant)](#ota-updates-instant)
- [Full Builds (Version Releases)](#full-builds-version-releases)
- [Decision Guide](#decision-guide)
- [Common Scenarios](#common-scenarios)

---

## Overview

VIbe uses **two automated workflows** to deploy updates:

1. **OTA (Over-The-Air) Updates** - For JavaScript/UI changes (instant)
2. **Full Builds** - For native changes and version releases (15-20 minutes)

Both workflows run automatically via GitHub Actions when you push code or create tags.

---

## Two Types of Updates

### OTA Updates
- **What:** JavaScript, React components, UI, styling, logic
- **Time:** Users receive in 5-10 minutes
- **Trigger:** Push to `master` or `production` branch
- **No rebuild needed**

### Full Builds
- **What:** Native code, plugins, version updates, configuration
- **Time:** Build takes 15-20 min, Play Store review 24-48 hours
- **Trigger:** Create git tag (e.g., `v1.0.2`)
- **Requires rebuild**

---

## OTA Updates (Instant)

### When to Use OTA

Use OTA updates for:
- ✅ Bug fixes in JavaScript
- ✅ UI/UX improvements
- ✅ Text changes
- ✅ Layout adjustments
- ✅ Logic updates
- ✅ Asset changes (images, etc.)

### How to Deploy OTA Update

#### Step 1: Test on Preview Branch
```bash
# Make your changes
git add .
git commit -m "Fix: Description of change"
git push origin master
```

**Result:** Automatic OTA update to `preview` branch for testing

#### Step 2: Deploy to Production (Live Users)
```bash
# After testing, merge to production
git checkout production
git pull origin production
git merge master
git push origin production
```

**Result:** Automatic OTA update to `production` branch → All users get update on next app launch

### Monitor OTA Updates

- **GitHub Actions:** https://github.com/CandyeEyewear/vi-app2/actions
- **Expo Dashboard:** https://expo.dev/accounts/viadim/projects/vibe-volunteer-app/updates

---

## Full Builds (Version Releases)

### When to Use Full Builds

Use full builds for:
- ✅ Version updates (1.0.1 → 1.0.2)
- ✅ New native dependencies
- ✅ Plugin additions/updates
- ✅ Firebase config changes
- ✅ Major releases

### How to Create a New Build

#### Step 1: Update App Version

Edit `app.config.js`:
```javascript
version: "1.0.2",  // Update version number
```

#### Step 2: Commit Changes
```bash
git add .
git commit -m "Release v1.0.2 - Description of changes"
git push origin master
```

#### Step 3: Create Version Tag
```bash
git tag v1.0.2
git push origin v1.0.2
```

**Result:** GitHub Actions automatically starts building Android production AAB

#### Step 4: Download and Upload

1. Wait 15-20 minutes for build to complete
2. Go to: https://expo.dev/accounts/viadim/projects/vibe-volunteer-app/builds
3. Download the AAB file
4. Upload to Google Play Console
5. Submit for review

### Tag Naming Rules

Tags **must** start with `v`:

- ✅ `v1.0.2` - Correct
- ✅ `v2.0.0` - Correct
- ✅ `v1.0.2-hotfix` - Correct
- ❌ `1.0.2` - Won't trigger workflow
- ❌ `release-1.0.2` - Won't trigger workflow

### Monitor Builds

- **GitHub Actions:** https://github.com/CandyeEyewear/vi-app2/actions
- **EAS Builds:** https://expo.dev/accounts/viadim/projects/vibe-volunteer-app/builds

---

## Decision Guide

Use this flowchart to decide which deployment method to use:
```
Are you changing native code, plugins, or app version?
│
├─ YES → Use Full Build (create git tag)
│
└─ NO → Are you only changing JavaScript/UI/assets?
    │
    ├─ YES → Use OTA Update (push to master/production)
    │
    └─ UNSURE → Use Full Build (safer option)
```

### Quick Reference Table

| Change Type | Method | Command | Time to Users |
|-------------|--------|---------|---------------|
| Bug fix | OTA | `git push origin production` | 5-10 minutes |
| UI update | OTA | `git push origin production` | 5-10 minutes |
| New feature (JS only) | OTA | `git push origin production` | 5-10 minutes |
| Version bump | Build | `git tag v1.0.2 && git push origin v1.0.2` | 24-48 hours |
| Add plugin | Build | `git tag v1.0.2 && git push origin v1.0.2` | 24-48 hours |
| Firebase update | Build | `git tag v1.0.2 && git push origin v1.0.2` | 24-48 hours |

---

## Common Scenarios

### Scenario 1: Emergency Bug Fix (JavaScript)
```bash
# Fix the bug in your code
git add .
git commit -m "Hotfix: Fix critical login bug"
git push origin master

# Test on preview, then deploy
git checkout production
git merge master
git push origin production
```

**Timeline:** Users get fix in 5-10 minutes ⚡

---

### Scenario 2: New App Version Release
```bash
# 1. Update version in app.config.js to 1.0.2
# 2. Commit and push
git add .
git commit -m "Release v1.0.2 - Add new features"
git push origin master

# 3. Create and push tag
git tag v1.0.2
git push origin v1.0.2

# 4. Wait 15-20 minutes
# 5. Download AAB from https://expo.dev
# 6. Upload to Google Play Console
```

**Timeline:** Users get update in 24-48 hours (after Play Store review) 📦

---

### Scenario 3: Adding New Native Feature
```bash
# 1. Install new package (e.g., expo-camera)
npm install expo-camera

# 2. Update version in app.config.js
# 3. Commit changes
git add .
git commit -m "v1.0.3 - Add camera functionality"
git push origin master

# 4. Create tag
git tag v1.0.3
git push origin v1.0.3

# 5. Download and upload to Play Store
```

**Timeline:** 24-48 hours (requires full build) 🔨

---

## Workflow Files

The automated workflows are defined in:

- **OTA Updates:** `.github/workflows/ota-update.yml`
- **Builds:** `.github/workflows/build.yml`

These files are managed via GitHub Actions and use the `EXPO_TOKEN` secret for authentication.

---

## Troubleshooting

### OTA Update Not Received

1. Check workflow succeeded: https://github.com/CandyeEyewear/vi-app2/actions
2. Verify update published: https://expo.dev/accounts/viadim/projects/vibe-volunteer-app/updates
3. Check app's runtime version matches update branch
4. Users must restart app to receive update

### Build Failed

1. Check workflow logs: https://github.com/CandyeEyewear/vi-app2/actions
2. Verify `EXPO_TOKEN` secret is set correctly
3. Check `eas.json` configuration
4. Ensure all dependencies are properly installed

### Tag Doesn't Trigger Build

1. Verify tag starts with `v` (e.g., `v1.0.2`)
2. Check tag was pushed: `git push origin v1.0.2`
3. View workflow runs: https://github.com/CandyeEyewear/vi-app2/actions

---

## Additional Resources

- **GitHub Repository:** https://github.com/CandyeEyewear/vi-app2
- **Expo Project:** https://expo.dev/accounts/viadim/projects/vibe-volunteer-app
- **Google Play Console:** https://play.google.com/console
- **EAS Build Documentation:** https://docs.expo.dev/build/introduction/
- **EAS Update Documentation:** https://docs.expo.dev/eas-update/introduction/

---

## Support

For questions or issues with deployment, contact the development team or refer to the Expo documentation.

**Last Updated:** December 2024
