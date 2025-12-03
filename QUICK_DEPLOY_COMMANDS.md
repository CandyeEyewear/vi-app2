# 🚀 Quick Deploy Commands

## Fast Reference for VIbe App Deployment

---

## 📱 **OTA Updates (Instant - Use Daily)**

### Push Update to Production (Live Users)
```bash
eas update --branch production --message "Fixed event crash"
```

### Test First on Preview
```bash
eas update --branch preview --message "Testing feature"
```

### Check Update Status
```bash
eas update:list --branch production
```

---

## 🏪 **App Store Updates (For Native Changes)**

### Build Production Apps
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production

# Both
eas build --platform all --profile production
```

### Submit to Stores
```bash
# Android
eas submit --platform android

# iOS  
eas submit --platform ios

# Both
eas submit --platform all
```

---

## 🔄 **When to Use Each**

### Use OTA (eas update) ✅
- Bug fixes
- UI changes
- Text updates
- Logic changes
- **Fix the event crash → Deploy in 30 seconds!**

### Use App Store (eas build + submit) ❌
- New packages
- Permission changes
- SDK upgrades
- Native changes
- **Need to do this ONCE to enable OTA**

---

## ⚡ **Typical Workflow**

```bash
# 1. Fix bug in code
# 2. Test locally: npm start
# 3. Deploy:
eas update --branch production --message "Bug fix"
# 4. Done! ✅
```

---

## 🆘 **Emergency Rollback**

```bash
# List updates
eas update:list --branch production

# Rollback
eas update:republish --branch production --group <previous-id>
```

---

## 📋 **First-Time Setup Required**

You need to rebuild and resubmit **ONCE** to include expo-updates:

```bash
eas build --platform all --profile production
eas submit --platform all
```

After users install this version, you can use OTA updates anytime!

---

**Current Version:** 1.0.1  
**Update Channels:** development, preview, production  
**Updates Enabled:** ✅ Yes
