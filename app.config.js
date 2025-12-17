export default {
  expo: {
    name: "VIbe",
    slug: "vibe-volunteer-app",
    scheme: "vibe",
    version: "1.0.1",
    // Allow rotation & resizing for large-screen devices (tablets/foldables/Chromebooks)
    // per Google Play large-screen requirements.
    orientation: "default",
    icon: "./assets/images/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#0944a2"
    },
    runtimeVersion: {
      policy: "appVersion" // Uses app version (1.0.1) as runtime version
    },
    updates: {
      url: "https://u.expo.dev/af48b690-5cb4-44ef-bd25-e8bcc1c31f0b",
      enabled: true,
      checkAutomatically: "ON_LOAD", // Check for updates when app loads
      fallbackToCacheTimeout: 0 // Immediately fall back to cached version if no network
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "org.volunteersinc.vibe",
      associatedDomains: [
        "applinks:vibe.volunteersinc.org"
      ],
      infoPlist: {
        NSCameraUsageDescription: "VIbe uses your camera to capture volunteer photos and upload media.",
        NSPhotoLibraryUsageDescription: "VIbe needs access to your photo library so you can attach images to posts and opportunities.",
        NSPhotoLibraryAddUsageDescription: "VIbe saves photos or images you create within the app.",
        NSLocationWhenInUseUsageDescription: "Location is used to show nearby volunteer opportunities and events.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "org.volunteersinc.vibe",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#2196F3"
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.RECORD_AUDIO"
      ],
      config: {
        googleMobileAdsAppId: "ca-app-pub-3940256099942544~3347511713",
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      softwareKeyboardLayoutMode: "pan",
      intentFilters: [
        // Share sheet (Android Sharesheet). Without SEND/SEND_MULTIPLE, the app will not
        // appear in "Share to" app lists for content like text/images/files.
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [
            { mimeType: "text/plain" },
            { mimeType: "image/*" },
            { mimeType: "video/*" },
            { mimeType: "application/pdf" },
            { mimeType: "*/*" }
          ]
        },
        {
          action: "SEND_MULTIPLE",
          category: ["DEFAULT"],
          data: [
            { mimeType: "image/*" },
            { mimeType: "video/*" },
            { mimeType: "application/pdf" },
            { mimeType: "*/*" }
          ]
        },
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "vibe.volunteersinc.org",
              pathPrefix: "/post"
            },
            {
              scheme: "https",
              host: "vibe.volunteersinc.org",
              pathPrefix: "/causes"
            },
            {
              scheme: "https",
              host: "vibe.volunteersinc.org",
              pathPrefix: "/events"
            },
            {
              scheme: "https",
              host: "vibe.volunteersinc.org",
              pathPrefix: "/opportunity"
            },
            {
              scheme: "https",
              host: "vibe.volunteersinc.org",
              pathPrefix: "/invite"
            },
            {
              scheme: "vibe",
              host: "*"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "./plugins/withFirebaseManifestFix",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#2196F3",
          sounds: []
        }
      ],
      "expo-router",
      "expo-image-picker",
      "expo-location",
      "expo-video",
      "expo-web-browser",
      "expo-updates",
      // Sentry plugin is native-only, exclude from web builds
      ...(process.env.VERCEL
        ? []
        : [
            [
              "@sentry/react-native/expo",
              {
                organization: "volunteers-incorporated",
                project: "react-native",
              },
            ],
          ])
    ],
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "af48b690-5cb4-44ef-bd25-e8bcc1c31f0b"
      }
    },
    owner: "viadim"
  }
};