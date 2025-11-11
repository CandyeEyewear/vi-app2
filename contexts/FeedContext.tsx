/**
 * Feed Context - WITH REACTIONS
 * Manages feed posts, likes, comments, shares, and reactions
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { Post, Comment, ApiResponse, ReactionType, PostReaction, ReactionSummary } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

interface FeedContextType {
  posts: Post[];
  loading: boolean;
  createPost: (text: string, mediaUrls?: string[], mediaTypes?: ('image' | 'video')[], visibility?: 'public' | 'circle') => Promise<ApiResponse<Post>>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<ApiResponse<Comment>>;
  sharePost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<ApiResponse<void>>;
  refreshFeed: () => Promise<void>;
  addReaction: (postId: string, reactionType: ReactionType) => Promise<ApiResponse<void>>;
  removeReaction: (postId: string) => Promise<ApiResponse<void>>;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

 // Load feed on mount
  useEffect(() => {
    if (user) {
      loadFeed();
      const cleanup = setupRealtimeSubscription();
      
      return () => {
        if (cleanup) {
          cleanup(); // Call the cleanup function returned by setupRealtimeSubscription
        }
      };
    }
  }, [user]);

  // ✅ Helper function to calculate reaction summary
  const calculateReactionSummary = (reactions: PostReaction[], userId?: string): ReactionSummary => {
    const summary: ReactionSummary = {
      heart: 0,
      thumbsup: 0,
      clap: 0,
      fire: 0,
      star: 0,
      total: 0,
    };

    reactions.forEach((reaction) => {
      summary[reaction.reactionType]++;
      summary.total++;
      if (reaction.userId === userId) {
        summary.userReaction = reaction.reactionType;
      }
    });

    return summary;
  };

  // ✅ Real-time subscription for reactions
  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('post-reactions-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_reactions',
        },
        async (payload) => {
          console.log('New reaction:', payload);
          const newReaction = payload.new as any;
          
          // Get user details for the reaction
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', newReaction.user_id)
            .single();

          const reaction: PostReaction = {
            id: newReaction.id,
            postId: newReaction.post_id,
            userId: newReaction.user_id,
            reactionType: newReaction.reaction_type,
            createdAt: newReaction.created_at,
            user: userData ? {
              id: userData.id,
              email: userData.email,
              fullName: userData.full_name,
              phone: userData.phone,
              location: userData.location,
              avatarUrl: userData.avatar_url,
              role: userData.role,
              totalHours: userData.total_hours,
              activitiesCompleted: userData.activities_completed,
              organizationsHelped: userData.organizations_helped,
              achievements: [],
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            } : undefined,
          };

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === newReaction.post_id) {
                const reactions = [...(p.reactions || []), reaction];
                return {
                  ...p,
                  reactions,
                  reactionSummary: calculateReactionSummary(reactions, user?.id),
                };
              }
              return p;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_reactions',
        },
        (payload) => {
          console.log('Reaction deleted:', payload);
          const deletedReaction = payload.old as any;

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === deletedReaction.post_id) {
                const reactions = (p.reactions || []).filter(r => r.id !== deletedReaction.id);
                return {
                  ...p,
                  reactions,
                  reactionSummary: calculateReactionSummary(reactions, user?.id),
                };
              }
              return p;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_reactions',
        },
        async (payload) => {
          console.log('Reaction updated:', payload);
          const updatedReaction = payload.new as any;

          // Get user details for the reaction
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', updatedReaction.user_id)
            .single();

          const reaction: PostReaction = {
            id: updatedReaction.id,
            postId: updatedReaction.post_id,
            userId: updatedReaction.user_id,
            reactionType: updatedReaction.reaction_type,
            createdAt: updatedReaction.created_at,
            user: userData ? {
              id: userData.id,
              email: userData.email,
              fullName: userData.full_name,
              phone: userData.phone,
              location: userData.location,
              avatarUrl: userData.avatar_url,
              role: userData.role,
              totalHours: userData.total_hours,
              activitiesCompleted: userData.activities_completed,
              organizationsHelped: userData.organizations_helped,
              achievements: [],
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            } : undefined,
          };

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === updatedReaction.post_id) {
                const reactions = (p.reactions || []).map(r => 
                  r.id === reaction.id ? reaction : r
                );
                return {
                  ...p,
                  reactions,
                  reactionSummary: calculateReactionSummary(reactions, user?.id),
                };
              }
              return p;
            })
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const loadFeed = async () => {
    try {
      setLoading(true);

      // Fetch posts with user details
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          user:users(*)
        `)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch comments and reactions for each post
      const postsWithDetails = await Promise.all(
        postsData.map(async (post) => {
          // Fetch comments
          const { data: commentsData } = await supabase
            .from('comments')
            .select(`
              *,
              user:users(*)
            `)
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

          // ✅ Fetch reactions
          const { data: reactionsData } = await supabase
            .from('post_reactions')
            .select(`
              *,
              user:users(*)
            `)
            .eq('post_id', post.id);

          const reactions: PostReaction[] = reactionsData?.map((reaction) => ({
            id: reaction.id,
            postId: reaction.post_id,
            userId: reaction.user_id,
            reactionType: reaction.reaction_type,
            createdAt: reaction.created_at,
            user: {
              id: reaction.user.id,
              email: reaction.user.email,
              fullName: reaction.user.full_name,
              phone: reaction.user.phone,
              location: reaction.user.location,
              avatarUrl: reaction.user.avatar_url,
              role: reaction.user.role,
              totalHours: reaction.user.total_hours,
              activitiesCompleted: reaction.user.activities_completed,
              organizationsHelped: reaction.user.organizations_helped,
              achievements: [],
              createdAt: reaction.user.created_at,
              updatedAt: reaction.user.updated_at,
            },
          })) || [];

          return {
            id: post.id,
            userId: post.user_id,
            user: {
              id: post.user.id,
              email: post.user.email,
              fullName: post.user.full_name,
              phone: post.user.phone,
              location: post.user.location,
              bio: post.user.bio,
              areasOfExpertise: post.user.areas_of_expertise,
              education: post.user.education,
              avatarUrl: post.user.avatar_url,
              role: post.user.role,
              totalHours: post.user.total_hours,
              activitiesCompleted: post.user.activities_completed,
              organizationsHelped: post.user.organizations_helped,
              achievements: [],
              createdAt: post.user.created_at,
              updatedAt: post.user.updated_at,
            },
            text: post.text,
            mediaUrls: post.media_urls || [],
            mediaTypes: post.media_types || [],
            visibility: post.visibility || 'public',
            likes: post.likes || [],
            comments: commentsData?.map((comment) => ({
              id: comment.id,
              postId: comment.post_id,
              userId: comment.user_id,
              user: {
                id: comment.user.id,
                email: comment.user.email,
                fullName: comment.user.full_name,
                phone: comment.user.phone,
                location: comment.user.location,
                bio: comment.user.bio,
                areasOfExpertise: comment.user.areas_of_expertise,
                education: comment.user.education,
                avatarUrl: comment.user.avatar_url,
                role: comment.user.role,
                totalHours: comment.user.total_hours,
                activitiesCompleted: comment.user.activities_completed,
                organizationsHelped: comment.user.organizations_helped,
                achievements: [],
                createdAt: comment.user.created_at,
                updatedAt: comment.user.updated_at,
              },
              text: comment.text,
              createdAt: comment.created_at,
            })) || [],
            shares: post.shares || 0,
            opportunityId: post.opportunity_id,
            isAnnouncement: post.is_announcement || false,
            isPinned: post.is_pinned || false,
            reactions, // ✅ Add reactions
            reactionSummary: calculateReactionSummary(reactions, user?.id), // ✅ Add summary
            createdAt: post.created_at,
            updatedAt: post.updated_at,
          } as Post;
        })
      );

      setPosts(postsWithDetails);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (
     text: string,
     mediaUrls: string[] = [],
     mediaTypes: ('image' | 'video')[] = [],
     visibility: 'public' | 'circle' = 'public'
   ): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is banned
    if (user.isBanned) {
      const now = new Date();
      const bannedUntil = user.bannedUntil ? new Date(user.bannedUntil) : null;
      
      if (!bannedUntil || bannedUntil > now) {
        return { 
          success: false, 
          error: user.bannedUntil 
            ? `You are banned from posting until ${bannedUntil.toLocaleDateString()}`
            : 'You are permanently banned from posting'
        };
      }
    }

    try {
      const { data, error } = await supabase
     .from('posts')
     .insert({
       user_id: user.id,
       text,
       media_urls: mediaUrls,
       media_types: mediaTypes,
       visibility: visibility,
       likes: [],
       shares: 0,
     })
     .select()
     .single();

      if (error) throw error;

      const newPost: Post = {
        id: data.id,
        userId: user.id,
        user: user,
        text: data.text,
        mediaUrls: data.media_urls || [],
        mediaTypes: data.media_types || [],
        visibility: data.visibility || 'public',
        likes: [],
        comments: [],
        shares: 0,
        reactions: [], // ✅ Initialize reactions
        reactionSummary: { // ✅ Initialize summary
          heart: 0,
          thumbsup: 0,
          clap: 0,
          fire: 0,
          star: 0,
          total: 0,
        },
        isAnnouncement: data.is_announcement || false,
        isPinned: data.is_pinned || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setPosts((prev) => [newPost, ...prev]);
      return { success: true, data: newPost };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const likePost = async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newLikes = [...post.likes, user.id];

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: newLikes } : p
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const unlikePost = async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newLikes = post.likes.filter((id) => id !== user.id);

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: newLikes } : p
        )
      );
    } catch (error) {
      console.error('Error unliking post:', error);
    }
  };

  const addComment = async (postId: string, text: string): Promise<ApiResponse<Comment>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          text,
        })
        .select()
        .single();

      if (error) throw error;

      const newComment: Comment = {
        id: data.id,
        postId: data.post_id,
        userId: user.id,
        user: user,
        text: data.text,
        createdAt: data.created_at,
      };

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: [...p.comments, newComment] }
            : p
        )
      );

      return { success: true, data: newComment };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const sharePost = async (postId: string) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newShares = post.shares + 1;

      const { error } = await supabase
        .from('posts')
        .update({ shares: newShares })
        .eq('id', postId);

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, shares: newShares } : p
        )
      );
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const deletePost = async (postId: string): Promise<ApiResponse<void>> => {
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Check if user is admin or post owner
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    if (user.role !== 'admin' && post.userId !== user.id) {
      return { success: false, error: 'Not authorized to delete this post' };
    }

    console.log('Deleting post:', postId);

    // Delete comments first
    const { error: commentsError } = await supabase
      .from('comments')
      .delete()
      .eq('post_id', postId);

    if (commentsError) {
      console.error('Error deleting comments:', commentsError);
      throw new Error(`Failed to delete comments: ${commentsError.message}`);
    }

    // Delete reactions
    const { error: reactionsError } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId);

    if (reactionsError) {
      console.error('Error deleting reactions:', reactionsError);
      throw new Error(`Failed to delete reactions: ${reactionsError.message}`);
    }

    // Delete post
    const { error: postError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (postError) {
      console.error('Error deleting post:', postError);
      throw new Error(`Failed to delete post: ${postError.message}`);
    }

    console.log('Post deleted successfully');
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    return { success: true };
  } catch (error: any) {
    console.error('Delete post error:', error);
    return { success: false, error: error.message };
  }
};

  // ✅ NEW: Add reaction
  const addReaction = async (postId: string, reactionType: ReactionType): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Check if user already has a reaction on this post
      const { data: existing } = await supabase
        .from('post_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // If same reaction, remove it (toggle off)
        if (existing.reaction_type === reactionType) {
          return await removeReaction(postId);
        }
        
        // Otherwise, update to new reaction
        const { error } = await supabase
          .from('post_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Add new reaction
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType,
          });

        if (error) throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error adding reaction:', error);
      return { success: false, error: error.message };
    }
  };

  // ✅ NEW: Remove reaction
  const removeReaction = async (postId: string): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error removing reaction:', error);
      return { success: false, error: error.message };
    }
  };

  const refreshFeed = async () => {
    await loadFeed();
  };

  return (
    <FeedContext.Provider
      value={{
        posts,
        loading,
        createPost,
        likePost,
        unlikePost,
        addComment,
        sharePost,
        deletePost,
        refreshFeed,
        addReaction, // ✅ NEW
        removeReaction, // ✅ NEW
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (context === undefined) {
    throw new Error('useFeed must be used within a FeedProvider');
  }
  return context;
}