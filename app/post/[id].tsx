/**
 * Post Detail Screen
 * Shows a single post in full detail view
 * Supports deep linking from web shares
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { Post, Comment, PostReaction, ReactionSummary } from '../../types';
import { supabase } from '../../services/supabase';
import { Colors } from '../../constants/colors';
import FeedPostCard from '../../components/cards/FeedPostCard';
import CustomAlert from '../../components/CustomAlert';
import { goBack } from '../../utils/navigation';

export default function PostDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (postId) {
      loadPost();
    }
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      console.log('[POST DETAIL] Loading post:', postId);

      // Fetch post with user data
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          user:users!posts_user_id_fkey(*)
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;
      if (!postData) {
        throw new Error('Post not found');
      }

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          user:users(*)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Fetch reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('post_reactions')
        .select(`
          *,
          user:users(*)
        `)
        .eq('post_id', postId);

      if (reactionsError) throw reactionsError;

      // Transform reactions
      const reactionsList: PostReaction[] = reactionsData?.map((r: any) => ({
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        user: r.user ? {
          id: r.user.id,
          email: r.user.email,
          fullName: r.user.full_name,
          avatarUrl: r.user.avatar_url,
        } : undefined,
        reactionType: r.reaction_type,
        createdAt: r.created_at,
      })) || [];

      // Calculate reaction summary
      const reactionSummary: ReactionSummary = {
        heart: reactionsList.filter(r => r.reactionType === 'heart').length,
        thumbsup: reactionsList.filter(r => r.reactionType === 'thumbsup').length,
        clap: reactionsList.filter(r => r.reactionType === 'clap').length,
        fire: reactionsList.filter(r => r.reactionType === 'fire').length,
        star: reactionsList.filter(r => r.reactionType === 'star').length,
        total: reactionsList.length,
        userReaction: user ? reactionsList.find(r => r.userId === user.id)?.reactionType : undefined,
      };

      // Transform comments
      const commentsList: Comment[] = commentsData?.map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        user: {
          id: c.user.id,
          email: c.user.email,
          fullName: c.user.full_name,
          avatarUrl: c.user.avatar_url,
        },
        text: c.text,
        createdAt: c.created_at,
      })) || [];

      // Transform user data
      const userData = {
        id: postData.user.id,
        email: postData.user.email,
        fullName: postData.user.full_name,
        phone: postData.user.phone,
        location: postData.user.location,
        bio: postData.user.bio,
        areasOfExpertise: postData.user.areas_of_expertise,
        education: postData.user.education,
        avatarUrl: postData.user.avatar_url,
        role: postData.user.role,
        isPrivate: postData.user.is_private,
        totalHours: postData.user.total_hours,
        activitiesCompleted: postData.user.activities_completed,
        organizationsHelped: postData.user.organizations_helped,
        achievements: [],
        createdAt: postData.user.created_at,
        updatedAt: postData.user.updated_at,
      };

      // Load shared post if this is a share
      let sharedPost: Post | null = null;
      if (postData.shared_post_id) {
        const { data: sharedPostData } = await supabase
          .from('posts')
          .select(`
            *,
            user:users!posts_user_id_fkey(*)
          `)
          .eq('id', postData.shared_post_id)
          .single();

        if (sharedPostData) {
          const sharedUserData = {
            id: sharedPostData.user.id,
            email: sharedPostData.user.email,
            fullName: sharedPostData.user.full_name,
            phone: sharedPostData.user.phone,
            location: sharedPostData.user.location,
            bio: sharedPostData.user.bio,
            areasOfExpertise: sharedPostData.user.areas_of_expertise,
            education: sharedPostData.user.education,
            avatarUrl: sharedPostData.user.avatar_url,
            role: sharedPostData.user.role,
            isPrivate: sharedPostData.user.is_private,
            totalHours: sharedPostData.user.total_hours,
            activitiesCompleted: sharedPostData.user.activities_completed,
            organizationsHelped: sharedPostData.user.organizations_helped,
            achievements: [],
            createdAt: sharedPostData.user.created_at,
            updatedAt: sharedPostData.user.updated_at,
          };

          sharedPost = {
            id: sharedPostData.id,
            userId: sharedPostData.user_id,
            user: sharedUserData,
            text: sharedPostData.text,
            mediaUrls: sharedPostData.media_urls || [],
            mediaTypes: sharedPostData.media_types || [],
            likes: sharedPostData.likes || [],
            comments: [],
            shares: sharedPostData.shares || 0,
            isAnnouncement: sharedPostData.is_announcement || false,
            isPinned: sharedPostData.is_pinned || false,
            isHidden: sharedPostData.is_hidden || false,
            sharedPostId: sharedPostData.shared_post_id,
            createdAt: sharedPostData.created_at,
            updatedAt: sharedPostData.updated_at,
          };
        }
      }

      // Transform post data
      const postObject: Post = {
        id: postData.id,
        userId: postData.user_id,
        user: userData,
        text: postData.text,
        mediaUrls: postData.media_urls || [],
        mediaTypes: postData.media_types || [],
        likes: postData.likes || [],
        comments: commentsList,
        shares: postData.shares || 0,
        reactions: reactionsList,
        reactionSummary: reactionSummary,
        isAnnouncement: postData.is_announcement || false,
        isPinned: postData.is_pinned || false,
        isHidden: postData.is_hidden || false,
        sharedPostId: postData.shared_post_id,
        sharedPost: sharedPost,
        createdAt: postData.created_at,
        updatedAt: postData.updated_at,
      };

      setPost(postObject);
      console.log('[POST DETAIL] Post loaded successfully');
    } catch (error: any) {
      console.error('[POST DETAIL] Error loading post:', error);
      showAlert('Error', error.message || 'Failed to load post', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Post not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Post Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <FeedPostCard post={post} />
      </ScrollView>

      {/* Alert */}
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});

