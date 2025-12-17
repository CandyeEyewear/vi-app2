/**
 * Create Announcement Screen
 * Form for admins to create announcement posts
 */

import React, { useMemo, useState } from 'react';
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
import { File } from 'expo-file-system';
import CustomAlert from '../components/CustomAlert';
import Button from '../components/Button';
import { sendNotificationToUser } from '../services/pushNotifications';
import WebContainer from '../components/WebContainer';
import MentionInput from '../components/MentionInput';
import { extractHashtagIds } from '../utils/hashtags';

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
  const [autoCropImage, setAutoCropImage] = useState(false);
  const [announcementScope, setAnnouncementScope] = useState<'general' | 'targeted'>('general');
  const [targetText, setTargetText] = useState('');

  const selectedTargets = useMemo(() => {
    const { eventIds, causeIds, opportunityIds } = extractHashtagIds(targetText);
    return {
      eventIds,
      causeIds,
      opportunityIds,
      total: eventIds.length + causeIds.length + opportunityIds.length,
    };
  }, [targetText]);

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
        allowsEditing: autoCropImage,
        ...(autoCropImage ? { aspect: [4, 3] as [number, number] } : {}),
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
      console.log('📸 Starting image upload...');
      // SDK 54: Validate using fetch + blob
      const headResponse = await fetch(uri);
      if (!headResponse.ok) {
        throw new Error('File does not exist');
      }

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

      const fileName = `announcement-${Date.now()}.jpg`;
      const filePath = `announcements/${fileName}`;

      console.log('📤 Uploading to storage:', filePath);
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('❌ Image upload error:', error);
        throw error;
      }

      console.log('✅ Image uploaded successfully');
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      console.log('🔗 Public URL generated:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('❌ Error uploading image:', error);
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
    if (announcementScope === 'targeted' && selectedTargets.total === 0) {
      showAlert('Validation Error', 'Please select at least one target (event, cause, or opportunity)', 'error');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    console.log('🚀 handleCreate called');
    console.log('📋 Validation - Text:', text.trim() ? 'Valid' : 'Empty', '| Pinned:', isPinned, '| Has Image:', !!imageUri);
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    try {
      setLoading(true);
      console.log('✅ Form validation passed');
      console.log('👤 Admin user ID:', user?.id);

      let mediaUrls = null;
      let mediaTypes = null;

      if (imageUri) {
        console.log('🖼️ Image selected, uploading...');
        const imageUrl = await uploadImage(imageUri);
        if (imageUrl) {
          mediaUrls = [imageUrl];
          mediaTypes = ['image'];
          console.log('✅ Image URL added to post');
        } else {
          console.warn('⚠️ Image upload failed, continuing without image');
        }
      }

      console.log('📝 Creating post in database...');
      console.log('📊 Post data:', {
        user_id: user?.id,
        text_length: text.trim().length,
        has_media: !!mediaUrls,
        is_announcement: true,
        is_pinned: isPinned,
      });

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id,
          text: text.trim(),
          media_urls: mediaUrls,
          media_types: mediaTypes,
          is_announcement: true,
          is_pinned: isPinned,
          announcement_scope: announcementScope,
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Post creation error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      console.log('✅ Post created successfully!');
      console.log('📊 Post ID:', data.id);

      // Create notifications using database function
      console.log('🔔 Starting notification process...');

      // Save targets if targeted
      if (announcementScope === 'targeted') {
        const targetRows = [
          ...selectedTargets.opportunityIds.map((id) => ({ post_id: data.id, target_type: 'opportunity', target_id: id })),
          ...selectedTargets.eventIds.map((id) => ({ post_id: data.id, target_type: 'event', target_id: id })),
          ...selectedTargets.causeIds.map((id) => ({ post_id: data.id, target_type: 'cause', target_id: id })),
        ];

        const { error: targetsError } = await supabase.from('announcement_targets').insert(targetRows);
        if (targetsError) {
          console.error('❌ Failed to save announcement targets:', targetsError);
          // Don't throw - post was created successfully
        }
      }

      const rpcName =
        announcementScope === 'targeted'
          ? 'create_targeted_announcement_notifications'
          : 'create_announcement_notifications';

      console.log(`🔧 Calling RPC function: ${rpcName}`);

      const { data: notificationCount, error: notifError } = await supabase.rpc(rpcName, {
        p_post_id: data.id,
        p_title: 'New Announcement',
        p_content: text.trim().substring(0, 100) + (text.length > 100 ? '...' : ''),
        p_sender_id: user?.id,
      });

      console.log('🔍 RPC function response:', {
        notificationCount,
        error: notifError,
      });

      if (notifError) {
        console.error('❌ Notification creation error:', notifError);
        console.error('❌ Error details:', {
          message: notifError.message,
          code: notifError.code,
          details: notifError.details,
          hint: notifError.hint,
        });
        console.warn('⚠️ Post created but notifications failed');
        // Don't throw - post was created successfully
      } else {
        console.log('✅ Notifications created successfully');
        console.log('📊 Total notifications sent:', notificationCount);
        
        // Send push notifications to users with announcements enabled
        const notifiedUserIds: string[] = Array.isArray(notificationCount)
          ? notificationCount.map((r: any) => r.user_id || r.userId).filter(Boolean)
          : [];

        if (!notifError && notifiedUserIds.length > 0) {
          console.log('🔔 Starting push notification process...');
          
          // Get users with push tokens (only notified audience)
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, push_token')
            .in('id', notifiedUserIds)
            .not('push_token', 'is', null);

          console.log('📊 Users query result:', { 
            error: usersError, 
            userCount: users?.length || 0 
          });

          if (!usersError && users) {
            console.log('✅ Found', users.length, 'users with push tokens');
            
            // Get notification settings for these users
            const { data: settingsData, error: settingsError } = await supabase
              .from('user_notification_settings')
              .select('user_id, announcements_enabled')
              .in('user_id', users.map(u => u.id));

            console.log('📊 Settings query result:', { 
              error: settingsError, 
              settingsCount: settingsData?.length || 0 
            });

            if (!settingsError && settingsData) {
              // Filter users who have announcements enabled
              const settingsMap = new Map(settingsData.map(s => [s.user_id, s.announcements_enabled]));
              
              const enabledUsers = users.filter(user => {
                const setting = settingsMap.get(user.id);
                return setting === true || setting === undefined;
              });

              console.log('✅ Found', enabledUsers.length, 'users with announcements enabled');

              for (const userObj of enabledUsers) {
                console.log('📤 Sending push to user:', userObj.id.substring(0, 8) + '...');
                try {
                  await sendNotificationToUser(userObj.id, {
                    type: 'announcement',
                    id: data.id,
                    title: 'New Announcement',
                    body: text.trim().substring(0, 100) + (text.length > 100 ? '...' : ''),
                  });
                  console.log('✅ Push sent to user:', userObj.id.substring(0, 8) + '...');
                } catch (pushError) {
                  console.error('❌ Failed to send push to user:', userObj.id, pushError);
                }
              }
              
              console.log('🎉 Push notification process complete!');
            }
          }
        }
      }

      console.log('🎉 Announcement creation complete!');
      
      // Build success message
      let successMessage = '';
      if (notifError) {
        successMessage = isPinned 
          ? 'Pinned announcement posted successfully!' 
          : 'Announcement posted successfully!';
      } else {
        // Handle notificationCount - it might be an array or number
        let count = 0;
        if (Array.isArray(notificationCount)) {
          count = notificationCount.length;
        } else if (typeof notificationCount === 'number') {
          count = notificationCount;
        }
        
        if (count > 0) {
          const countText = count === 1 ? 'notification' : 'notifications';
          successMessage = isPinned
            ? `Pinned announcement posted! ${count} ${countText} sent.`
            : `Announcement posted! ${count} ${countText} sent.`;
        } else {
          successMessage = isPinned
            ? 'Pinned announcement posted successfully!'
            : 'Announcement posted successfully!';
        }
      }
      
      showAlert('Success!', successMessage, 'success');

      console.log('🏠 Navigating back after delay...');
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('❌ Fatal error in handleCreate:', error);
      console.error('❌ Error stack:', error.stack);
      showAlert(
        'Error',
        error.message || 'Failed to create announcement',
        'error'
      );
    } finally {
      console.log('🏁 handleCreate finished, setting loading to false');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        <View style={{ width: 40 }} />
      </View>

      {/* Form */}
      <WebContainer>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: styles.scrollContent.paddingBottom + insets.bottom + 100 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
          <Megaphone size={20} color={colors.primary} />
          <Text style={[styles.infoBannerText, { color: colors.text }]}>
            Announcements are highlighted posts. Choose General (everyone) or Targeted (only participants of selected items).
          </Text>
        </View>

        {/* Audience */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Audience</Text>
          <View style={[styles.scopeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setAnnouncementScope('general')}
              style={[
                styles.scopePill,
                {
                  backgroundColor: announcementScope === 'general' ? colors.primary + '15' : 'transparent',
                  borderColor: announcementScope === 'general' ? colors.primary + '40' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.scopeText, { color: announcementScope === 'general' ? colors.primary : colors.textSecondary }]}>
                General
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAnnouncementScope('targeted')}
              style={[
                styles.scopePill,
                {
                  backgroundColor: announcementScope === 'targeted' ? colors.primary + '15' : 'transparent',
                  borderColor: announcementScope === 'targeted' ? colors.primary + '40' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.scopeText, { color: announcementScope === 'targeted' ? colors.primary : colors.textSecondary }]}>
                Targeted
              </Text>
            </TouchableOpacity>
          </View>
          {announcementScope === 'targeted' && (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Visible only to users who signed up, registered, or donated to the selected items.
            </Text>
          )}
        </View>

        {/* Targets */}
        {announcementScope === 'targeted' && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Targets <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={[styles.mentionWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MentionInput
                value={targetText}
                onChangeText={setTargetText}
                placeholder="Type # to select Events, Causes, or Opportunities..."
                multiline
              />
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Selected: {selectedTargets.opportunityIds.length} opportunities, {selectedTargets.eventIds.length} events, {selectedTargets.causeIds.length} causes
            </Text>
          </View>
        )}

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
          <View style={[styles.pinSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.pinContent}>
              <ImageIcon size={20} color={autoCropImage ? colors.primary : colors.textSecondary} />
              <View style={styles.pinText}>
                <Text style={[styles.pinTitle, { color: colors.text }]}>Auto-crop image</Text>
                <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
                  Off = upload full image • On = crop to 4:3
                </Text>
              </View>
            </View>
            <Switch
              value={autoCropImage}
              onValueChange={setAutoCropImage}
              trackColor={{ false: colors.border, true: colors.primary + '40' }}
              thumbColor={autoCropImage ? colors.primary : colors.textSecondary}
            />
          </View>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                resizeMode={autoCropImage ? 'cover' : 'contain'}
              />
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
        <Button
          variant="primary"
          size="lg"
          onPress={handleCreate}
          disabled={loading}
          loading={loading}
          loadingText="Posting..."
          icon={<Megaphone size={20} color="#FFFFFF" />}
          style={[styles.createButton, { marginBottom: insets.bottom + 16 }]}
        >
          Post Announcement
        </Button>
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
  scopeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    gap: 6,
  },
  scopePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scopeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  mentionWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    marginTop: 8,
  },
});
