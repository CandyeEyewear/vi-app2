# 🚀 OTA Updates Guide - VIbe App

## ✅ Setup Complete!

Your app is now configured for **Over-The-Air (OTA) Updates**, enabling you to push instant updates for JavaScript changes without app store reviews!

---

## 📋 What Was Configured

### 1. **Package Installation**
- ✅ `expo-updates` installed and added to dependencies

### 2. **App Configuration** (`app.config.js`)
- ✅ Runtime version set to track app version (1.0.1)
- ✅ Updates URL configured for your EAS project
- ✅ Auto-check on app load enabled
- ✅ expo-updates plugin added

### 3. **Build Profiles** (`eas.json`)
- ✅ Development channel: `development`
- ✅ Preview channel: `preview`
- ✅ Production channel: `production`

---

## 🎯 When to Use Each Update Method

### Use OTA Updates For (Instant - No Review):
- ✅ Bug fixes (like the event crash we just fixed!)
- ✅ UI/UX improvements
- ✅ Text changes
- ✅ Business logic updates
- ✅ API endpoint changes
- ✅ Style/layout changes
- ✅ Any JavaScript/React code

### Use App Store Updates For (Requires Review):
- ❌ Adding new native packages
- ❌ Changing permissions
- ❌ Upgrading Expo SDK
- ❌ Modifying app.json config
- ❌ Native code changes
- ❌ Major version updates

---

## 🔨 How to Use OTA Updates

### Step 1: Build New App Version (One Time)

**Important:** You must rebuild and resubmit your app once to include the expo-updates package.

```bash
# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

**This is required only once.** After users install this new version, they can receive OTA updates.

---

### Step 2: Push OTA Updates (Instant - Use Anytime)

After the initial rebuild, you can push updates instantly:

#### For Production (Live Users)
```bash
# Push update to production channel
eas update --branch production --message "Fixed event selection crash"

# Or with auto message from git commit
eas update --branch production --auto
```

#### For Testing (Preview Build)
```bash
# Push to preview for testing first
eas update --branch preview --message "Testing new feature"
```

#### For Development
```bash
# Push to development channel
eas update --branch development --message "Development testing"
```

---

## 📱 How It Works for Users

### User Experience:
1. **User opens app** → App checks for updates (takes ~1-2 seconds)
2. **Update found** → Downloads in background (user can still use app)
3. **Next app launch** → New update is applied automatically
4. **User sees latest version** → No manual action needed!

### Timeline:
- **You publish update**: 30 seconds
- **Update goes live**: Immediately
- **User gets update**: Next time they open the app
- **Total time**: Minutes (vs. days for app store)

---

## 🎭 Typical Workflow Examples

### Example 1: Quick Bug Fix
```bash
# 1. Fix the bug in your code
# 2. Test locally
npm start

# 3. When ready, publish to production
eas update --branch production --message "Fixed event crash bug"

# 4. Done! Live in 30 seconds ✅
```

### Example 2: Test Before Production
```bash
# 1. Fix the bug
# 2. Publish to preview channel first
eas update --branch preview --message "Testing bug fix"

# 3. Test on preview build
# 4. If good, publish to production
eas update --branch production --message "Fixed event crash bug"
```

### Example 3: Native Change (Requires Rebuild)
```bash
# If you add a new package like react-native-camera:
npm install react-native-camera

# Must rebuild and resubmit to stores:
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android
eas submit --platform ios
```

---

## 🔍 Monitoring Updates

### Check Update Status
```bash
# View all published updates
eas update:list --branch production

# View details of specific update
eas update:view <update-id>
```

### View Update History
```bash
# See all updates for a branch
eas update:list --branch production --json

# See recent updates across all branches
eas update:list
```

### Rollback if Needed
```bash
# If an update causes issues, republish previous version
eas update:republish --branch production --group <previous-update-group-id>
```

---

## 🚦 Update Channels Explained

Your app has 3 channels configured:

### 1. **Production Channel**
- **Who uses it**: All users with production builds from app stores
- **When to publish**: After testing, for all live users
- **Command**: `eas update --branch production`

### 2. **Preview Channel**
- **Who uses it**: Internal testers with preview builds
- **When to publish**: For testing before production
- **Command**: `eas update --branch preview`

### 3. **Development Channel**
- **Who uses it**: Developers with development builds
- **When to publish**: For active development/testing
- **Command**: `eas update --branch development`

---

## ⚡ Quick Commands Reference

```bash
# Push production update
eas update --branch production --message "Your message"

# Push with git commit message
eas update --branch production --auto

# Push to preview for testing
eas update --branch preview --message "Testing fix"

# List all updates
eas update:list

# View update details
eas update:view <update-id>

# Rollback to previous version
eas update:republish --branch production --group <group-id>
```

---

## 🔐 Important Notes

### Runtime Version
- Your runtime version is set to match your app version (1.0.1)
- OTA updates only work for the same runtime version
- When you change native code, increment app version and rebuild

### Update Check Behavior
- **ON_LOAD**: Checks for updates when app starts (current setting)
- Updates download in background
- Applied on next app launch (not immediately)

### Network Usage
- Updates download only when app starts
- Falls back to cached version if no network
- Minimal data usage (~100KB typical for code updates)

---

## 📊 Update Size Guidelines

- **Small update** (~100KB): Text/logic changes, bug fixes
- **Medium update** (~500KB): UI changes, new screens
- **Large update** (~2MB+): Image assets, major refactoring

Users on cellular data will still receive updates, but keep them small when possible!

---

## 🎯 Best Practices

### ✅ DO:
- Test updates on preview channel first
- Use descriptive update messages
- Keep updates focused (one fix at a time)
- Monitor update adoption rates
- Have a rollback plan

### ❌ DON'T:
- Push untested code to production
- Make breaking changes via OTA
- Forget to increment version for native changes
- Bundle large assets unnecessarily
- Deploy during peak usage hours (unless urgent)

---

## 🚨 Troubleshooting

### Update Not Appearing?
1. Check runtime version matches: `eas update:list`
2. Verify update was published: `eas update:view <id>`
3. Kill and restart the app completely
4. Check device has internet connection
5. Verify app has expo-updates package installed

### Need to Rollback?
```bash
# List previous updates
eas update:list --branch production

# Republish previous version
eas update:republish --branch production --group <previous-group-id>
```

### Users Reporting Issues?
1. Immediately rollback to previous version
2. Fix the issue locally
3. Test on preview channel
4. Republish to production when confirmed fixed

---

## 📈 Next Steps

### 1. **Rebuild App Once** (Required)
```bash
# This includes the expo-updates package
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

### 2. **After Users Update** (1-2 weeks)
Once users install the new version from stores, you can start using OTA updates!

### 3. **Test First OTA Update**
```bash
# Make a small change, like updating a text
# Then publish to preview
eas update --branch preview --message "Testing OTA updates"
```

### 4. **Go Live!**
```bash
# When confident, push to production
eas update --branch production --message "First OTA update!"
```

---

## 🎉 Benefits You Now Have

- ⚡ **Instant bug fixes** - Fix crashes in minutes, not days
- 🔄 **Zero app store delays** - No waiting for review
- 🎯 **Staged rollouts** - Test with preview before production
- 💰 **Cost savings** - Fewer app store submissions
- 📱 **Better UX** - Users always have latest features
- 🚀 **Faster iteration** - Deploy multiple times per day if needed

---

## 📚 Additional Resources

- [Expo Updates Documentation](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Update Guide](https://docs.expo.dev/eas-update/introduction/)
- [Runtime Versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Update Strategies](https://docs.expo.dev/eas-update/deployment-patterns/)

---

## 💡 Pro Tips

1. **Always test on preview first** - Catch issues before production
2. **Use descriptive messages** - Helps track what changed
3. **Monitor adoption** - Check how many users have the update
4. **Keep a changelog** - Document all OTA updates
5. **Set up notifications** - Alert team when updates go live

---

## ✅ You're All Set!

Your app is now configured for instant OTA updates. After you rebuild and resubmit once, you'll be able to push updates in seconds instead of waiting days for app store reviews!

**Need help?** Just ask! 🚀
