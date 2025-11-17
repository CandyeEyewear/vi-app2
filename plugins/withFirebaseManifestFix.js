const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withFirebaseManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Find the application tag
    const application = androidManifest.manifest.application[0];
    
    // Find the Firebase notification color meta-data
    if (application['meta-data']) {
      const metaDataArray = application['meta-data'];
      const firebaseColorMeta = metaDataArray.find(
        meta => meta.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
      );
      
      if (firebaseColorMeta) {
        // Add tools:replace attribute
        firebaseColorMeta.$['tools:replace'] = 'android:resource';
      }
    }
    
    // Add tools namespace if not present
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    return config;
  });
};

