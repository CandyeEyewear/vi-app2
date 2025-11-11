/**
 * Create Announcement Screen
 * Form for admins to create announcement posts
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { 
  ChevronLeft,
  Megaphone,
  Image as ImageIcon,
  X,
  Pin,
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import CustomAlert from '../components/CustomAlert';
import { sendNotificationToUser } from '../services/pushNotifications';

export default function CreateAnnouncementScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // Form state
  const [text, setText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('Error', 'Failed to pick image', 'error');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `announcement-${Date.now()}.jpg`;
      const filePath = `announcements/${fileName}`;

      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const decode = (base64: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bufferLength = base64.length * 0.75;
    let p = 0;
    let encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === '=') {
      bufferLength--;
      if (base64[base64.length - 2] === '=') {
        bufferLength--;
      }
    }

    const bytes = new Uint8Array(bufferLength);

    for (let i = 0; i < base64.length; i += 4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i + 1]);
      encoded3 = chars.indexOf(base64[i + 2]);
      encoded4 = chars.indexOf(base64[i + 3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return bytes;
  };

  const validateForm = () => {
    if (!text.trim()) {
      showAlert('Validation Error', 'Please enter announcement text', 'error');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      let mediaUrls = null;
      let mediaTypes = null;

      if (imageUri) {
        const imageUrl = await uploadImage(imageUri);
        if (imageUrl) {
          mediaUrls = [imageUrl];
          mediaTypes = ['image'];
        }
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id,
          text: text.trim(),
          media_urls: mediaUrls,
          media_types: mediaTypes,
          is_announcement: true,
          is_pinned: isPinned,
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Notify all users who have announcement notifications enabled
      if (data) {
        const { data: usersWithNotifs } = await supabase
          .from('user_notification_settings')
          .select('user_id')
          .eq('announcements_enabled', true)
          .neq('user_id', user?.id);

        if (usersWithNotifs && usersWithNotifs.length > 0) {
          // Create in-app notifications
          const notifications = usersWithNotifs.map(setting => ({
            user_id: setting.user_id,
            type: 'announcement',
            title: 'New Announcement',
            message: `${text.trim().substring(0, 100)}${text.length > 100 ? '...' : ''}`,
            link: '/(tabs)',
            related_id: data.id,
          }));

          await supabase.from('notifications').insert(notifications);

          // Send push notifications
          for (const setting of usersWithNotifs) {
            await sendNotificationToUser(setting.user_id, {
              type: 'announcement',
              id: data.id,
              title: 'New Announcement',
              body: `${text.trim().substring(0, 100)}${text.length > 100 ? '...' : ''}`,
            });
          }
        }
      }

      showAlert(
        'Success!',
        isPinned ? 'Pinned announcement posted successfully' : 'Announcement posted successfully',
        'success'
      );

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      showAlert(
        'Error',
        error.message || 'Failed to create announcement',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Megaphone size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Create Announcement
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
          <Megaphone size={20} color={colors.primary} />
          <Text style={[styles.infoBannerText, { color: colors.primary }]}>
            This announcement will be visible to all users in their feed
          </Text>
        </View>

        {/* Announcement Text */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Announcement Text <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="What would you like to announce?"
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Pin Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Pin size={20} color={colors.primary} />
              <Text style={[styles.label, { color: colors.text, marginLeft: 8 }]}>
                Pin to Top
              </Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={isPinned ? colors.primary : colors.textSecondary}
            />
          </View>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Pinned announcements will appear at the top of the feed
          </Text>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Image (Optional)</Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                onPress={() => setImageUri(null)}
              >
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePickImage}
            >
              <ImageIcon size={32} color={colors.textSecondary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                Add Image
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.5 },
          ]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Post Announcement'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Alert */}
      <CustomAlert
        visible={alertVisible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
  },
  imagePickerButton: {
    height: 150,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
