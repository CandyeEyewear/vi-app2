/**
 * Feed Tab Screen
 * Main social feed with post creation
 * Shows announcements with special styling and sorts pinned announcements to top
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  useColorScheme,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import WebContainer from '../../components/WebContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Camera, Image as ImageIcon } from 'lucide-react-native';
import Head from 'expo-router/head';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { Colors } from '../../constants/colors';
import FeedPostCard from '../../components/cards/FeedPostCard';
import CustomAlert from '../../components/CustomAlert';
import { FeedSkeleton } from '../../components/SkeletonLayouts';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';
import { uploadMultipleImages } from '../../services/imageUpload';
import { uploadVideo, getVideoSize, formatFileSize, isVideoTooLarge } from '../../services/videoUtils';

export default function FeedScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // More reliable desktop detection for web
  const [isDesktop, setIsDesktop] = React.useState(Platform.OS === 'web' && width >= 992);
  
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const checkDesktop = () => {
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : width;
        setIsDesktop(windowWidth >= 992);
      };
      checkDesktop();
      window.addEventListener('resize', checkDesktop);
      return () => window.removeEventListener('resize', checkDesktop);
    }
  }, [width]);
  
  // Detect mobile web (web but not desktop)
  const isMobileWeb = Platform.OS === 'web' && !isDesktop;
  const { user } = useAuth();
  const { posts, loading, createPost, refreshFeed } = useFeed();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'forYou' | 'myCircle'>('forYou');
  const [postText, setPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  // Load notification count on mount and refresh periodically
   useEffect(() => {
     if (user) {
       loadNotificationCount();
       
       // Refresh count every 30 seconds
       const interval = setInterval(loadNotificationCount, 30000);
       
       return () => clearInterval(interval);
     }
   }, [user]);
  
  // Custom Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

const loadNotificationCount = async () => {
     if (!user?.id) return;
     
     try {
       const { count, error } = await supabase
         .from('notifications')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', user.id)
         .eq('is_read', false);

       if (error) throw error;

       setNotificationCount(count || 0);
     } catch (error) {
       console.error('Error loading notification count:', error);
     }
   };

  // Filter and sort posts based on active tab
   const sortedPosts = useMemo(() => {
     // Filter posts by tab
     const filteredPosts = posts.filter(post => {
       if (activeTab === 'forYou') {
         // Show all public posts
         return post.visibility === 'public' || !post.visibility; // older posts without visibility are public
       } else {
         // Show circle posts only
         return post.visibility === 'circle';
       }
     });

     // Sort: pinned announcements first, then regular announcements, then normal posts
     return [...filteredPosts].sort((a, b) => {
       // Pinned announcements go first
       if (a.isPinned && !b.isPinned) return -1;
       if (!a.isPinned && b.isPinned) return 1;
       
       // Then regular announcements (not pinned)
       if (a.isAnnouncement && !a.isPinned && !b.isAnnouncement) return -1;
       if (!a.isAnnouncement && b.isAnnouncement && !b.isPinned) return 1;
       
       // Otherwise sort by date (newest first)
       return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
     });
   }, [posts, activeTab]);

  const handleSubmitPost = async () => {
    try {
      console.log('🚀 [POST] handleSubmitPost called');
      console.log('📊 [POST] Media count:', selectedMedia.length);
      console.log('📝 [POST] Text length:', postText.trim().length);
      
      setSubmitting(true);
      setUploadProgress(0);

      if (!postText.trim() && selectedMedia.length === 0) {
        showAlert('Error', 'Please add some text or media', 'error');
        return;
      }

      console.log('📤 [POST] Starting post creation...');
      
      let uploadedUrls: string[] = [];
      const mediaTypes: ('image' | 'video')[] = [];

      // Upload media
      if (selectedMedia.length > 0) {
        console.log('📤 [POST] Uploading', selectedMedia.length, 'media files...');
        console.log('📸 [POST] Media details:', selectedMedia.map((uri, i) => ({
          index: i,
          uri: uri.substring(0, 50) + '...',
          isVideo: uri.endsWith('.mp4') || uri.endsWith('.mov') || uri.endsWith('.MOV')
        })));
        
        for (let i = 0; i < selectedMedia.length; i++) {
          const mediaUri = selectedMedia[i];
          const isVideo = mediaUri.endsWith('.mp4') || 
                         mediaUri.endsWith('.mov') || 
                         mediaUri.endsWith('.MOV');

          if (isVideo) {
            console.log(`🎥 [POST] Processing video ${i + 1}/${selectedMedia.length}...`);
            console.log(`🎥 [POST] Video URI: ${mediaUri.substring(0, 50)}...`);
            
            // Check video size first
            console.log(`🎥 [POST] Checking video size...`);
            const size = await getVideoSize(mediaUri);
            console.log(`🎥 [POST] Video size: ${formatFileSize(size)}`);
            
            if (isVideoTooLarge(size)) {
              showAlert(
                'Video Too Large',
                `Video ${i + 1} is ${formatFileSize(size)}. Maximum is 50MB. Please choose a shorter video.`,
                'error'
              );
              return;
            }

            // Upload video with progress
            console.log(`🎥 [POST] Uploading video ${i + 1}/${selectedMedia.length}...`);
            const result = await uploadVideo(
              mediaUri,
              user?.id || '',
              'videos',
              (progress) => {
                const overallProgress = ((i / selectedMedia.length) * 100) + 
                                       (progress / selectedMedia.length);
                setUploadProgress(Math.round(overallProgress));
                console.log(`🎥 [POST] Upload progress: ${progress}% (Overall: ${Math.round(overallProgress)}%)`);
              }
            );

            if (!result.success) {
              console.error(`🎥 [POST] ❌ Upload error for video ${i}:`, result.error);
              showAlert('Upload Error', result.error || 'Failed to upload video', 'error');
              return;
            }

            uploadedUrls.push(result.videoUrl!);
            mediaTypes.push('video');
            console.log(`🎥 [POST] ✅ Video ${i + 1} uploaded successfully`);
            console.log(`🎥 [POST] Video URL: ${result.videoUrl?.substring(0, 50)}...`);

          } else {
            // Upload image
            console.log(`📸 [POST] Uploading image ${i + 1}/${selectedMedia.length}...`);
            console.log(`📸 [POST] Image URI: ${mediaUri.substring(0, 50)}...`);
            
            const { urls, errors } = await uploadMultipleImages(
              [mediaUri],
              user?.id || '',
              'posts'
            );

            if (errors.length > 0) {
              console.error(`📸 [POST] ❌ Upload error for image ${i}:`, errors[0]);
              showAlert('Upload Error', errors[0], 'error');
              return;
            }

            uploadedUrls.push(...urls);
            mediaTypes.push('image');
            console.log(`📸 [POST] ✅ Image ${i + 1} uploaded successfully`);
            console.log(`📸 [POST] Image URL: ${urls[0]?.substring(0, 50)}...`);
          }
        }
        
        console.log('📸 [POST] ✅ All media uploaded successfully');
        console.log('📸 [POST] Total URLs:', uploadedUrls.length);
        console.log('📸 [POST] Media types:', mediaTypes);
      }

      console.log('📝 [POST] Creating post in database...');
      console.log('📝 [POST] Visibility:', activeTab === 'forYou' ? 'public' : 'circle');
      
      // Create post
      const visibility = activeTab === 'forYou' ? 'public' : 'circle';
      const response = await createPost(postText, uploadedUrls, mediaTypes, visibility);

      if (response.success) {
        console.log('✅ [POST] Post created successfully');
        setPostText('');
        setSelectedMedia([]);
        setShowCreateModal(false);
        setUploadProgress(0);
        // Success!
      } else {
        console.error('❌ [POST] Failed to create post:', response.error);
        showAlert('Error', response.error || 'Failed to create post', 'error');
      }
    } catch (error: any) {
      console.error('❌ [POST] Error in handleSubmitPost:', error);
      console.error('❌ [POST] Error message:', error.message);
      console.error('❌ [POST] Error stack:', error.stack);
      showAlert('Error', error.message || 'Failed to create post', 'error');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };


  const pickImage = async (useCamera: boolean = false) => {
    try {
      console.log('📸 [IMAGE] Starting image picker...', { useCamera });
      
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      console.log('📸 [IMAGE] Permission status:', status);

      if (status !== 'granted') {
        Alert.alert('Permission Denied', `Camera/Library access is required`);
        return;
      }

      console.log('📸 [IMAGE] Launching picker...');
      
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,  // Must be false
            quality: 0.2,  // Very low to prevent memory issues
            base64: false,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            quality: 0.5,
            base64: false,
            exif: false,
          });

      console.log('📸 [IMAGE] Picker result:', {
        cancelled: result.canceled,
        assetsCount: result.assets?.length
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('📸 [IMAGE] Processing assets...');
        console.log('📸 [IMAGE] Asset details:', result.assets.map(asset => ({
          uri: asset.uri.substring(0, 50) + '...',
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize
        })));

        // For camera, apply image resizing
        if (useCamera && result.assets[0]) {
          try {
            console.log('📸 [IMAGE] Resizing camera image...');
            const manipResult = await ImageManipulator.manipulateAsync(
              result.assets[0].uri,
              [{ resize: { width: 1024 } }], // Max width 1024px to prevent memory issues
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            console.log('📸 [IMAGE] ✅ Image resized successfully');
            setSelectedMedia(prev => {
              const newMedia = [...prev, manipResult.uri];
              console.log('📸 [IMAGE] ✅ Image added successfully. Total count:', newMedia.length);
              return newMedia;
            });
          } catch (error) {
            console.error('📸 [IMAGE] ❌ Error resizing image:', error);
            // Fallback to original if resizing fails
            setSelectedMedia(prev => {
              const newMedia = [...prev, result.assets[0].uri];
              console.log('📸 [IMAGE] ⚠️ Using original image. Total count:', newMedia.length);
              return newMedia;
            });
          }
        } else {
          // For gallery, add all selected assets
          console.log('📸 [IMAGE] Adding gallery images...');
          setSelectedMedia(prev => {
            const newMedia = [...prev, ...result.assets.map(asset => asset.uri)];
            console.log('📸 [IMAGE] ✅ Images added successfully. Total count:', newMedia.length);
            return newMedia;
          });
        }
      } else {
        console.log('📸 [IMAGE] ⏭️ Picker cancelled or no assets');
      }
    } catch (error: any) {
      console.error('📸 [IMAGE] ❌ Error in pickImage:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

const renderTabs = () => (
     <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
       <TouchableOpacity
         style={[
           styles.tab,
           activeTab === 'forYou' && styles.tabActive,
         ]}
         onPress={() => setActiveTab('forYou')}
       >
         <Text style={[
           styles.tabText,
           { color: activeTab === 'forYou' ? colors.primary : colors.textSecondary },
           activeTab === 'forYou' && styles.tabTextActive,
         ]}>
           For You
         </Text>
         {activeTab === 'forYou' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
       </TouchableOpacity>

       <TouchableOpacity
         style={[
           styles.tab,
           activeTab === 'myCircle' && styles.tabActive,
         ]}
         onPress={() => setActiveTab('myCircle')}
       >
         <Text style={[
           styles.tabText,
           { color: activeTab === 'myCircle' ? colors.primary : colors.textSecondary },
           activeTab === 'myCircle' && styles.tabTextActive,
         ]}>
           My Circle
         </Text>
         {activeTab === 'myCircle' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
       </TouchableOpacity>
     </View>
   );

  const renderHeader = () => (
     <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
       <Text style={[styles.headerTitle, { color: colors.primary }]}>VIbe</Text>
       
       <View style={styles.headerRight}>
         <TouchableOpacity 
           style={styles.searchButton}
           onPress={() => router.push('/search')}
         >
           <Search size={24} color={colors.primary} />
         </TouchableOpacity>
         
         {user && (
     <TouchableOpacity 
       style={styles.avatarContainer}
       onPress={() => router.push('/notifications')}
     >
       {user.avatarUrl ? (
         <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatar} />
       ) : (
         <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
           <Text style={styles.headerAvatarText}>
             {user.fullName.charAt(0).toUpperCase()}
           </Text>
         </View>
       )}
       {notificationCount > 0 && (
         <View style={[styles.notificationBadge, { backgroundColor: colors.error || '#FF0000' }]}>
           <Text style={styles.notificationBadgeText}>
             {notificationCount > 99 ? '99+' : notificationCount}
           </Text>
         </View>
       )}
     </TouchableOpacity>
   )}
       </View>
     </View>
   );

   return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Head>
        <title>Feed | VIbe</title>
      </Head>
      {!isDesktop && renderHeader()}
      <WebContainer>
        {renderTabs()}
        
        <FlatList
          data={sortedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedPostCard post={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshFeed}
            tintColor={Colors.light.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.listContent}>
              <FeedSkeleton count={3} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to share!</Text>
            </View>
          )
        }
      />
      </WebContainer>
      
      {/* Floating Add Button - Outside WebContainer for proper positioning */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          Platform.OS === 'web' && styles.floatingButtonWeb,
          { 
            backgroundColor: colors.primary,
            // Desktop: 24px (no tab bar)
            // Mobile web: 65px (smaller icons-only tab bar)
            // Native mobile: 100px (full tab bar with labels)
            bottom: isDesktop ? 24 : isMobileWeb ? 65 : 100,
            zIndex: 1001,
          }
        ]}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Create Post Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity
                onPress={handleSubmitPost}
                disabled={submitting || (!postText.trim() && selectedMedia.length === 0)}
              >
                <Text
                  style={[
                    styles.modalPost,
                    (submitting || (!postText.trim() && selectedMedia.length === 0)) &&
                      styles.modalPostDisabled,
                  ]}
                >
                  {submitting ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalUserInfo}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.modalAvatar} />
                ) : (
                  <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                    <Text style={styles.modalAvatarText}>
                      {user?.fullName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.modalUserName}>{user?.fullName}</Text>
              </View>

             {/* Visibility Indicator */}
             <View style={styles.visibilityIndicator}>
               <Text style={styles.visibilityText}>
                 Posting to: {activeTab === 'forYou' ? '🌍 For You' : '👥 My Circle'}
               </Text>
             </View>

              <TextInput
                style={styles.modalInput}
                placeholder="What's happening in your volunteer journey?"
                placeholderTextColor={Colors.light.textSecondary}
                value={postText}
                onChangeText={setPostText}
                multiline
                autoFocus
                editable={!submitting}
              />

              {selectedMedia.length > 0 && (
                <View style={styles.mediaPreview}>
                  {selectedMedia.map((uri, index) => (
                    <View key={index} style={styles.mediaItem}>
                      <Image source={{ uri }} style={styles.mediaImage} />
                      <TouchableOpacity
                        style={styles.mediaRemove}
                        onPress={() =>
                          setSelectedMedia(prev => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Text style={styles.mediaRemoveText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Upload Progress */}
              {submitting && uploadProgress > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{uploadProgress}% uploaded</Text>
                </View>
              )}

              <View style={styles.mediaButtonsContainer}>
                <TouchableOpacity
                  style={styles.mediaButtonHalf}
                  onPress={() => pickImage(true)}
                  disabled={submitting}
                >
                  <Camera size={20} color={Colors.light.primary} />
                  <Text style={styles.mediaButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaButtonHalf}
                  onPress={() => pickImage(false)}
                  disabled={submitting}
                >
                  <ImageIcon size={20} color={Colors.light.primary} />
                  <Text style={styles.mediaButtonText}>Library</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.card,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 12,
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonWeb: {
    position: 'fixed' as any,
    zIndex: 1001,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.light.background,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  modalPost: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  modalPostDisabled: {
    opacity: 0.5,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  modalAvatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalInput: {
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mediaPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  mediaItem: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  mediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaRemoveText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  mediaButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    alignItems: 'center',
  },
  mediaButtonsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  mediaButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  mediaButtonText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
visibilityIndicator: {
     backgroundColor: Colors.light.card,
     paddingVertical: 8,
     paddingHorizontal: 12,
     borderRadius: 8,
     marginBottom: 12,
     borderWidth: 1,
     borderColor: Colors.light.border,
   },
   visibilityText: {
     fontSize: 14,
     color: Colors.light.textSecondary,
     fontWeight: '600',
   },
tabsContainer: {
     flexDirection: 'row',
     backgroundColor: Colors.light.background,
     borderBottomWidth: 1,
     paddingHorizontal: 16,
   },
   tab: {
     flex: 1,
     paddingVertical: 16,
     alignItems: 'center',
     position: 'relative',
   },
   tabActive: {
     // Active tab styling handled by text color and indicator
   },
   tabText: {
     fontSize: 16,
     fontWeight: '600',
   },
   tabTextActive: {
     fontWeight: '700',
   },
   tabIndicator: {
     position: 'absolute',
     bottom: 0,
     left: 0,
     right: 0,
     height: 3,
     borderRadius: 2,
   },
avatarContainer: {
     position: 'relative',
   },
   notificationBadge: {
     position: 'absolute',
     top: -2,
     right: -2,
     minWidth: 18,
     height: 18,
     borderRadius: 9,
     backgroundColor: '#FF0000',
     justifyContent: 'center',
     alignItems: 'center',
     paddingHorizontal: 3,
     borderWidth: 2,
     borderColor: '#FFFFFF',
   },
   notificationBadgeText: {
     fontSize: 10,
     fontWeight: 'bold',
     color: '#FFFFFF',
     textAlign: 'center',
   },
  progressContainer: {
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.light.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});