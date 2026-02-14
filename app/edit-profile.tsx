/**
 * Edit Profile Screen
 * Edit user profile information with proper avatar upload to Supabase Storage
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { supabase } from '../services/supabase';
import CustomAlert from '../components/CustomAlert';
import Button from '../components/Button';
import CrossPlatformDateTimePicker from '../components/CrossPlatformDateTimePicker';
import WebContainer from '../components/WebContainer';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    country: user?.country || '',
    bio: user?.bio || '',
    education: user?.education || '',
    areasOfExpertise: user?.areasOfExpertise?.join(', ') || '',
    avatarUrl: user?.avatarUrl || '',
    dateOfBirth: user?.dateOfBirth || '',
  });
  
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [dobDate, setDobDate] = useState<Date>(() => {
    return formData.dateOfBirth ? new Date(formData.dateOfBirth) : new Date(2000, 0, 1);
  });
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.location || !formData.country) {
      showAlert('Error', 'Please fill in all required fields', 'error');
      return;
    }

    setSaving(true);

    const expertiseArray = formData.areasOfExpertise
      ? formData.areasOfExpertise.split(',').map(item => item.trim()).filter(Boolean)
      : undefined;

    const response = await updateProfile({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      location: formData.location,
      country: formData.country,
      bio: formData.bio || undefined,
      education: formData.education || undefined,
      areasOfExpertise: expertiseArray,
      avatarUrl: formData.avatarUrl || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
    });

    setSaving(false);

    if (response.success) {
      showAlert('Success', 'Profile updated successfully', 'success');
      setTimeout(() => {
        router.back();
      }, 1500);
    } else {
      showAlert('Error', response.error || 'Failed to update profile', 'error');
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    try {
      // SDK 54: Validate file existence using fetch + blob
      const headResponse = await fetch(uri);
      if (!headResponse.ok) {
        throw new Error('File does not exist');
      }

      // Read file as base64 using fetch + FileReader (SDK 54 compatible)
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Create unique filename
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${ext}`;
      const filePath = `avatars/${fileName}`;

      // Convert base64 to byte array
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Determine content type
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('post-images') // Using existing post-images bucket
        .upload(filePath, byteArray, {
          contentType: contentType,
          upsert: true, // Overwrite if exists
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow access to your photos', 'warning');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadingImage(true);
      
      // Upload to Supabase Storage
      const publicUrl = await uploadImageToStorage(result.assets[0].uri);
      
      setUploadingImage(false);

      if (publicUrl) {
        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
        showAlert('Success', 'Photo uploaded successfully', 'success');
      } else {
        showAlert('Error', 'Failed to upload photo', 'error');
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <WebContainer>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (styles.scrollContent.paddingBottom || 32) + insets.bottom + 80 }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
            {formData.avatarUrl ? (
              <Image source={{ uri: formData.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {formData.fullName.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              ) : (
                <Text style={styles.cameraIconText}>📷</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            {uploadingImage ? 'Uploading...' : 'Tap to change photo'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information*</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name*</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.fullName}
                onChangeText={(value) => updateField('fullName', value)}
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email*</Text>
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone*</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (876) 123-4567"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Location*</Text>
              <TextInput
                style={styles.input}
                placeholder="Kingston, Jamaica"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.location}
                onChangeText={(value) => updateField('location', value)}
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Country*</Text>
              <TextInput
                style={styles.input}
                placeholder="Jamaica"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.country}
                onChangeText={(value) => updateField('country', value)}
                editable={!saving}
              />
            </View>

            <CrossPlatformDateTimePicker
              mode="date"
              value={dobDate}
              onChange={(date) => {
                if (date) {
                  setDobDate(date);
                  const iso = date.toISOString().split('T')[0];
                  updateField('dateOfBirth', iso);
                }
              }}
              maximumDate={new Date()}
              label="Date of Birth *"
              placeholder="Select your date of birth"
              colors={{
                card: '#FFFFFF',
                border: Colors.light.border,
                text: Colors.light.text,
                textSecondary: Colors.light.textSecondary,
              }}
              disabled={saving}
            />
            <Text style={styles.hint}>You must be 18 or older</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about yourself..."
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.bio}
                onChangeText={(value) => updateField('bio', value)}
                multiline
                numberOfLines={4}
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Education</Text>
              <TextInput
                style={styles.input}
                placeholder="Bachelor's in Computer Science"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.education}
                onChangeText={(value) => updateField('education', value)}
                editable={!saving}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Areas of Expertise</Text>
              <TextInput
                style={styles.input}
                placeholder="Teaching, Healthcare, Technology (comma separated)"
                placeholderTextColor={Colors.light.textSecondary}
                value={formData.areasOfExpertise}
                onChangeText={(value) => updateField('areasOfExpertise', value)}
                editable={!saving}
              />
              <Text style={styles.hint}>Separate multiple areas with commas</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            onPress={handleSave}
            disabled={saving || uploadingImage}
            loading={saving}
            style={styles.saveButton}
          >
            Save Changes
          </Button>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving || uploadingImage}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </WebContainer>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.card,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
    maxWidth: 800,
    width: '100%' as any,
    alignSelf: 'center' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 32,
    color: Colors.light.primary,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.background,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.background,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconText: {
    fontSize: 18,
  },
  avatarHint: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
  form: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.light.background,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.light.background,
  },
  saveButton: {
    marginBottom: 12,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});