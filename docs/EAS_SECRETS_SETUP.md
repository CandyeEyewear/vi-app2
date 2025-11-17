# EAS Secrets Configuration

This guide explains how to securely manage environment variables and API keys using EAS Secrets.

## Why Use EAS Secrets?

- **Security**: Keep sensitive keys out of your codebase
- **Flexibility**: Different keys for development, staging, and production
- **Best Practice**: Industry standard for managing secrets

## Setup Instructions

### 1. Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

### 2. Login to EAS

```bash
eas login
```

### 3. Create Secrets

Create secrets for each environment:

```bash
# Development
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-dev-project.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-dev-anon-key" --type string

# Production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://your-prod-project.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD --value "your-prod-anon-key" --type string
```

### 4. Update eas.json

Update your `eas.json` to use secrets:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "${EXPO_PUBLIC_SUPABASE_URL_PROD}",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD}"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "${EXPO_PUBLIC_SUPABASE_URL}",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "${EXPO_PUBLIC_SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

### 5. List Secrets

To view all secrets:

```bash
eas secret:list
```

### 6. Delete Secrets

To remove a secret:

```bash
eas secret:delete --name EXPO_PUBLIC_SUPABASE_URL
```

## Local Development

For local development, create a `.env` file (and add it to `.gitignore`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
```

Then install `expo-constants` and use:

```typescript
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 
                    process.env.EXPO_PUBLIC_SUPABASE_URL;
```

## Important Notes

1. **Never commit secrets to Git**: Always use `.gitignore` for `.env` files
2. **Use different keys per environment**: Never use production keys in development
3. **Rotate keys regularly**: Update secrets periodically for security
4. **Limit access**: Only team members who need access should have it

## Current Configuration

Currently, the app uses hardcoded values in `eas.json` and `config/supabase.config.ts`. 

**Action Required**: Before production launch, migrate to EAS Secrets following the steps above.

## Additional Resources

- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)

