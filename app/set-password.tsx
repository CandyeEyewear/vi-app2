import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

export default function SetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    console.log('[DEBUG] Full hash:', hash);

    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      console.log('[DEBUG] access_token:', params.get('access_token')?.substring(0, 50) + '...');
      console.log('[DEBUG] refresh_token:', params.get('refresh_token') ? 'Present' : 'Missing');
      console.log('[DEBUG] type:', params.get('type'));
      console.log('[DEBUG] token_hash:', params.get('token_hash'));
    }
  }, []);

  const handleSetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log('[SET-PASSWORD] Updating password...');
      
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password
      });

      if (passwordError) throw passwordError;

      console.log('[SET-PASSWORD] Clearing needs_password_setup flag...');
      
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { needs_password_setup: false }
      });

      if (metadataError) throw metadataError;

      console.log('[SET-PASSWORD] ✅ Password set successfully');

      Alert.alert(
        'Success! 🎉',
        'Your password has been set. Welcome to VIbe!',
        [
          {
            text: 'Get Started',
            onPress: () => router.replace('/feed' as any)
          }
        ]
      );

    } catch (error: any) {
      console.error('[SET-PASSWORD] Error:', error);
      const errorMessage = error.message || 'Failed to set password';
      const errorDetails = error.status ? ` (Status: ${error.status})` : '';
      Alert.alert(
        'Error Details',
        `${errorMessage}${errorDetails}\n\nError: ${JSON.stringify(error, null, 2)}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://46485094.fs1.hubspotusercontent-na1.net/hubfs/46485094/icon%2022a.png' }}
          style={styles.logo}
        />
        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          Secure your VIbe account by creating a strong password
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.requirementsBox}>
          <Text style={styles.requirementsTitle}>Password Requirements:</Text>
          <Text style={styles.requirement}>• At least 8 characters</Text>
          <Text style={styles.requirement}>• Include uppercase letters (A-Z)</Text>
          <Text style={styles.requirement}>• Include numbers (0-9)</Text>
          <Text style={styles.requirement}>• Include special characters (!@#$%)</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Setting Password...' : 'Set Password & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  contentContainer: { padding: 20 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  emoji: { fontSize: 64, marginBottom: 16 },
  logo: { 
    width: 80, 
    height: 80, 
    marginBottom: 16,
    resizeMode: 'contain'
  },
  title: { fontSize: 28, fontWeight: '700', color: '#2c3e50', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', paddingHorizontal: 20 },
  form: { backgroundColor: 'white', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  inputContainer: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  requirementsBox: { backgroundColor: '#e3f2fd', padding: 16, borderRadius: 8, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#4A90E2' },
  requirementsTitle: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8 },
  requirement: { fontSize: 13, color: '#555', marginBottom: 4 },
  button: { backgroundColor: '#4A90E2', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
