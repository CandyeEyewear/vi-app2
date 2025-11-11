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

 
// Notify all users who have opportunity notifications enabled
   if (data) {
     const { data: usersWithNotifs } = await supabase
       .from('user_notification_settings')
       .select('user_id')
       .eq('opportunities_enabled', true)
       .neq('user_id', user?.id);

     if (usersWithNotifs && usersWithNotifs.length > 0) {
       // Create in-app notifications
       const notifications = usersWithNotifs.map(setting => ({
         user_id: setting.user_id,
         type: 'opportunity',
         title: 'New Opportunity Available',
         message: `${title.trim()} - ${organizationName.trim()}`,
         link: `/opportunity/${data.id}`,
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

   // Notify all users who have announcement notifications enabled
   if (data) {
     const { data: usersWithNotifs } = await supabase
  .from('user_notification_settings')
  .select('user_id')
  .eq('announcements_enabled', true)
  .neq('user_id', user?.id)
  .not('announcements_enabled', 'is', null); // Add this line

     if (usersWithNotifs && usersWithNotifs.length > 0) {
       const notifications = usersWithNotifs.map(setting => ({
         user_id: setting.user_id,
         type: 'announcement',
         title: 'New Announcement',
         message: `${text.trim().substring(0, 100)}${text.length > 100 ? '...' : ''}`,
         link: '/feed',
         related_id: data.id,
       }));

       await supabase.from('notifications').insert(notifications);
     }
   }

// Send push notifications
       for (const setting of usersWithNotifs) {
         await sendNotificationToUser(setting.user_id, {
           type: 'announcement',
           id: data.id,
           title: 'New Announcement',
           body: `${text.trim().substring(0, 100)}${text.length > 100 ? '...' : ''}`,
         });
       }


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
          <Text style={[styles.infoBannerText, { color: colors.text }]}>
            Announcements appear in the feed with special styling and are visible to all volunteers.
          </Text>
        </View>

        {/* Announcement Text */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Announcement Message <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={text}
            onChangeText={setText}
            placeholder="Write your announcement here... (e.g., Upcoming beach cleanup this Saturday!)"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {text.length} characters
          </Text>
        </View>

        {/* Pin to Top */}
        <View style={[styles.pinSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pinContent}>
            <Pin size={20} color={isPinned ? colors.primary : colors.textSecondary} />
            <View style={styles.pinText}>
              <Text style={[styles.pinTitle, { color: colors.text }]}>Pin to Top</Text>
              <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
                Keep this announcement at the top of the feed
              </Text>
            </View>
          </View>
          <Switch
            value={isPinned}
            onValueChange={setIsPinned}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={isPinned ? colors.primary : colors.textSecondary}
          />
        </View>

        {/* Image Upload (Optional) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Image (Optional)
          </Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setImageUri(null)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePickImage}
            >
              <ImageIcon size={32} color={colors.textSecondary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                Tap to upload image
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preview Section */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Preview</Text>
          <View style={[styles.previewCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
            <View style={styles.previewHeader}>
              <Megaphone size={16} color={colors.primary} />
              <Text style={[styles.previewBadge, { color: colors.primary }]}>
                ANNOUNCEMENT
              </Text>
              {isPinned && (
                <>
                  <Text style={[styles.previewDivider, { color: colors.primary }]}>•</Text>
                  <Pin size={14} color={colors.primary} />
                  <Text style={[styles.previewBadge, { color: colors.primary }]}>
                    PINNED
                  </Text>
                </>
              )}
            </View>
            {text.trim() ? (
              <Text style={[styles.previewText, { color: colors.text }]}>
                {text}
              </Text>
            ) : (
              <Text style={[styles.previewPlaceholder, { color: colors.textSecondary }]}>
                Your announcement text will appear here...
              </Text>
            )}
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Megaphone size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>
            {loading ? 'Posting...' : 'Post Announcement'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
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
    paddingBottom: 32,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 24,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 150,
  },
  charCount: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  pinSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  pinContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pinText: {
    flex: 1,
  },
  pinTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  pinSubtitle: {
    fontSize: 13,
  },
  imagePickerButton: {
    height: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  imagePickerText: {
    fontSize: 14,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  previewBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewDivider: {
    fontSize: 11,
  },
  previewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  previewPlaceholder: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
