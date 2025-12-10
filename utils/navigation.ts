import { router } from 'expo-router';

export function goBack(fallbackRoute: string = '/(tabs)/feed') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackRoute);
  }
}
