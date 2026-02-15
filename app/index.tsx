import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

export default function Index() {
  const { user, loading } = useAuth();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/feed" />;
  }

  return <Redirect href="/login" />;
}
