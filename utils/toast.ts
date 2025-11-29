export const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  console.log(`${type.toUpperCase()}: ${message}`);
  // TODO: Replace with proper toast library like react-native-toast-message
};
