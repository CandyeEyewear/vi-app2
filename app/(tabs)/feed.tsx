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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { Colors } from '../../constants/colors';
import FeedPostCard from '../../components/cards/FeedPostCard';
import CustomAlert from '../../components/CustomAlert';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';

export default function FeedScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { posts, loading, createPost, refreshFeed } = useFeed();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'forYou' | 'myCircle'>('forYou');
  const [postText, setPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
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

  const handleCreatePost = async () => {
    if (!postText.trim() && selectedMedia.length === 0) {
      showAlert('Error', 'Please add some text or media to your post', 'error');
      return;
    }

    setSubmitting(true);
    
    try {
      // Upload images to Supabase Storage using FileSystem (Expo Go compatible)
      const uploadedUrls: string[] = [];
      const mediaTypes: ('image' | 'video')[] = [];

      for (const mediaUri of selectedMedia) {
        try {
          // Get file extension
          const ext = mediaUri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const filePath = `${user?.id}/${fileName}`;

          // Read file as base64 using FileSystem (works in Expo Go!)
          const base64 = await FileSystem.readAsStringAsync(mediaUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Convert base64 to ArrayBuffer for Supabase
          const arrayBuffer = decode(base64);

          // Determine content type
          const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(filePath, arrayBuffer, {
              contentType: contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('post-images')
            .getPublicUrl(filePath);

          uploadedUrls.push(urlData.publicUrl);
          mediaTypes.push('image');
        } catch (error) {
          console.error('Error uploading image:', error);
          showAlert('Error', 'Failed to upload one or more images', 'error');
        }
      }

      // Create post with uploaded image URLs
      // Create post with uploaded image URLs and visibility based on active tab
   const visibility = activeTab === 'forYou' ? 'public' : 'circle';
   const response = await createPost(postText, uploadedUrls, mediaTypes, visibility);

      if (response.success) {
        setPostText('');
        setSelectedMedia([]);
        setShowCreateModal(false);
        // Post created successfully - no alert needed, just close modal smoothly!
      } else {
        showAlert('Error', response.error || 'Failed to create post', 'error');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please allow access to your photos', 'warning');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedMedia(result.assets.map(asset => asset.uri));
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
      {renderHeader()}
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
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to share!</Text>
            </View>
          )
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
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
                onPress={handleCreatePost}
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

              <TouchableOpacity
                style={styles.mediaButton}
                onPress={handlePickImage}
                disabled={submitting}
              >
                <Text style={styles.mediaButtonText}>Add Photo/Video</Text>
              </TouchableOpacity>
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
    bottom: 24,
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
  mediaButtonText: {
    fontSize: 16,
    color: Colors.light.primary,
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
});