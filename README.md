# VIbe - Volunteer Social Networking App

**Changing Communities Through Volunteerism**

A mobile app for volunteers to discover opportunities, share their journey, and connect with other volunteers.

---

## 🎯 Features

### ✅ **Phase 2 Complete - Core Features**

1. **Authentication**
   - Login & Register
   - Profile management
   - Secure authentication with Supabase

2. **Social Feed**
   - Create posts with photos/videos
   - Like, comment, and share posts
   - Real-time engagement
   - Admin can delete any post

3. **Direct Messaging**
   - One-on-one conversations
   - Real-time messaging
   - Unread message badges

4. **Opportunity Discovery**
   - Browse volunteer opportunities
   - Filter by category
   - Search functionality
   - View details with map location
   - Sign up for opportunities

5. **User Profiles**
   - Impact statistics (hours, activities, organizations)
   - Achievements system
   - Edit profile
   - Settings

---

## 🚀 Getting Started

### **Prerequisites**

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### **Installation**

1. **Clone or download the project**
```bash
cd vibe-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**

You need to create a Supabase project and configure the database:

a. Go to [https://supabase.com](https://supabase.com) and create a new project

b. Get your project URL and anon key from Settings > API

c. Update `/config/supabase.config.ts` with your keys:
```typescript
export const supabaseConfig = {
  url: 'YOUR_SUPABASE_URL_HERE',
  anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE',
};
```

d. Create the database tables using the SQL commands in `/config/supabase.config.ts`

4. **Start the development server**
```bash
npm start
```

5. **Run on your device**
   - Scan the QR code with Expo Go (Android) or Camera app (iOS)
   - Or press `i` for iOS simulator
   - Or press `a` for Android emulator

---

## 📊 Database Schema

The app uses Supabase (PostgreSQL) with the following tables:

- `users` - User profiles and stats
- `opportunities` - Volunteer opportunities
- `opportunity_signups` - User signups for opportunities
- `posts` - Social feed posts
- `comments` - Post comments
- `conversations` - Message conversations
- `messages` - Direct messages
- `achievements` - User achievements
- `notifications` - Push notifications

See `/config/supabase.config.ts` for the complete schema.

---

## 🎨 Design System

### **Colors**
- **Primary Blue**: `#2196F3` (from VIbe logo)
- **Secondary Gray**: `#9E9E9E`
- **Background**: White/Light gray
- **Categories**:
  - Environment: `#4CAF50` (Green)
  - Education: `#2196F3` (Blue)
  - Healthcare: `#F44336` (Red)
  - Poor Relief: `#FF9800` (Orange)
  - Community: `#9C27B0` (Purple)

### **Typography**
- Clean, modern sans-serif fonts
- Bold headers for impact
- Readable body text

---

## 📱 App Structure

```
vibe-app/
├── app/
│   ├── (tabs)/              # Main tab screens
│   │   ├── feed.tsx         # Social feed
│   │   ├── messages.tsx     # Message list
│   │   ├── discover.tsx     # Browse opportunities
│   │   └── profile.tsx      # User profile
│   ├── conversation/        # Chat screens
│   ├── opportunity/         # Opportunity details
│   ├── login.tsx            # Login screen
│   ├── register.tsx         # Registration
│   ├── edit-profile.tsx     # Edit profile
│   └── settings.tsx         # App settings
├── components/
│   └── cards/               # Reusable card components
├── contexts/                # State management
│   ├── AuthContext.tsx
│   ├── FeedContext.tsx
│   └── MessagingContext.tsx
├── services/                # API services
│   └── supabase.ts
├── types/                   # TypeScript definitions
├── constants/               # App constants
└── config/                  # Configuration files
```

---

## 🔐 User Roles

1. **Volunteer** (default)
   - Browse and sign up for opportunities
   - Create posts and engage with feed
   - Message other volunteers

2. **Admin**
   - All volunteer permissions
   - Create/edit/delete opportunities
   - Delete any post (moderation)
   - View analytics

---

## 🎯 Next Steps (Phase 3 - Admin Features)

- [ ] Admin dashboard
- [ ] Create/edit opportunities (admin only)
- [ ] Post moderation panel
- [ ] Analytics and reporting
- [ ] Announcement system

---

## 🐛 Known Issues

- Media upload to Supabase storage not yet implemented (uses local URIs)
- Real-time message updates require page refresh
- Map requires actual lat/long coordinates

---

## 📝 License

Copyright © 2025 Volunteers Incorporated

---

## 🤝 Support

For questions or support, contact: support@volunteersinc.org

Website: [www.volunteersinc.org](https://www.volunteersinc.org)

---

**Built with ❤️ for volunteers making a difference in Jamaica and beyond!**
