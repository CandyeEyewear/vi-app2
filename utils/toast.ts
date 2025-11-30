import { Alert, Platform } from 'react-native';

export const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // Show alert notification
  const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Warning';
  
  if (Platform.OS === 'web') {
    // For web, use browser alert
    window.alert(`${title}\n\n${message}`);
  } else {
    // For mobile, use React Native Alert
    Alert.alert(title, message);
  }
};
