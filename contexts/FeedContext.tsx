/**
 * Feed Context - WITH COMPREHENSIVE REAL-TIME
 * Manages feed posts, likes, comments, shares, and reactions
 * ENHANCED with real-time for posts, comments, updates, deletes
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { Post, Comment, ApiResponse, ReactionType, PostReaction, ReactionSummary } from '../types';
import { supabase } from '../services/supabase';
import { getCauseById } from '../services/causesService';
import { useAuth } from './AuthContext';

interface FeedContextType {
  posts: Post[];
  loading: boolean;
  createPost: (text: string, mediaUrls?: string[], mediaTypes?: ('image' | 'video')[], visibility?: 'public' | 'circle') => Promise<ApiResponse<Post>>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<ApiResponse<Comment>>;
  sharePost: (postId: string) => Promise<void>;
  shareToFeed: (postId: string, customMessage?: string) => Promise<ApiResponse<Post>>;
  shareOpportunityToFeed: (opportunityId: string, customMessage?: string, visibility?: 'public' | 'circle') => Promise<ApiResponse<Post>>;
  shareCauseToFeed: (causeId: string, customMessage?: string, visibility?: 'public' | 'circle') => Promise<ApiResponse<Post>>;
  shareEventToFeed: (eventId: string, customMessage?: string, visibility?: 'public' | 'circle') => Promise<ApiResponse<Post>>;
  deletePost: (postId: string) => Promise<ApiResponse<void>>;
  updatePost: (postId: string, text: string) => Promise<ApiResponse<Post>>;
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
      console.log('[FEED] 🚀 User logged in, loading feed and setting up real-time...');
      loadFeed();
      const cleanup = setupRealtimeSubscriptions();
      
      return () => {
        console.log('[FEED] 🧹 Cleaning up real-time subscriptions...');
        if (cleanup) {
          cleanup();
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

  // 🎯 COMPREHENSIVE REAL-TIME SUBSCRIPTIONS
  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    console.log('[FEED] 🔌 Setting up comprehensive real-time subscriptions...');

    // Single channel for all subscriptions
    const channel = supabase
      .channel('feed-realtime-all')
      
      // ========== NEW POSTS ==========
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          console.log('[FEED] ✨ New post detected:', payload.new);
          const newPostData = payload.new as any;
          
          // Skip if it's our own post (already optimistically added)
          if (newPostData.user_id === user.id) {
            console.log('[FEED] ℹ️ Skipping own post (already added optimistically)');
            return;
          }

          // Fetch user details for the new post
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', newPostData.user_id)
            .single();

          if (!userData) {
            console.log('[FEED] ⚠️ Could not fetch user data for new post');
            return;
          }

          const newPost: Post = {
            id: newPostData.id,
            userId: newPostData.user_id,
            user: {
              id: userData.id,
              email: userData.email,
              fullName: userData.full_name,
              phone: userData.phone,
              location: userData.location,
              bio: userData.bio,
              areasOfExpertise: userData.areas_of_expertise,
              education: userData.education,
              avatarUrl: userData.avatar_url,
              role: userData.role,
              totalHours: userData.total_hours,
              activitiesCompleted: userData.activities_completed,
              organizationsHelped: userData.organizations_helped,
              achievements: [],
              membershipTier: userData.membership_tier || 'free',
              membershipStatus: userData.membership_status || 'inactive',
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            },
            text: newPostData.text,
            mediaUrls: newPostData.media_urls || [],
            mediaTypes: newPostData.media_types || [],
            visibility: newPostData.visibility || 'public',
            likes: newPostData.likes || [],
            comments: [],
            shares: newPostData.shares || 0,
            reactions: [],
            reactionSummary: {
              heart: 0,
              thumbsup: 0,
              clap: 0,
              fire: 0,
              star: 0,
              total: 0,
            },
            isAnnouncement: newPostData.is_announcement || false,
            isPinned: newPostData.is_pinned || false,
            sharedPostId: newPostData.shared_post_id || null,
            opportunityId: newPostData.opportunity_id || undefined,
            createdAt: newPostData.created_at,
            updatedAt: newPostData.updated_at,
          };

          // Fetch opportunity data if post references an opportunity
          if (newPostData.opportunity_id) {
            console.log('[FEED] 🎯 New post with opportunity, fetching opportunity data...');
            const { data: opportunityData } = await supabase
              .from('opportunities')
              .select('*')
              .eq('id', newPostData.opportunity_id)
              .single();

            if (opportunityData) {
              const opportunity: any = {
                id: opportunityData.id,
                slug: opportunityData.slug,
                title: opportunityData.title,
                description: opportunityData.description,
                organizationName: opportunityData.organization_name,
                organizationVerified: opportunityData.organization_verified,
                category: opportunityData.category,
                location: opportunityData.location,
                latitude: opportunityData.latitude,
                longitude: opportunityData.longitude,
                date: opportunityData.date || opportunityData.date_start,
                dateStart: opportunityData.date_start,
                dateEnd: opportunityData.date_end,
                timeStart: opportunityData.time_start,
                timeEnd: opportunityData.time_end,
                duration: opportunityData.duration,
                spotsAvailable: opportunityData.spots_available,
                spotsTotal: opportunityData.spots_total,
                imageUrl: opportunityData.image_url,
                status: opportunityData.status,
              };
              newPost.opportunity = opportunity;
            }
          }

          // Fetch cause data if post references a cause
          if (newPostData.cause_id) {
            console.log('[FEED] 💙 New post with cause, fetching cause data...');
            const causeResponse = await getCauseById(newPostData.cause_id);
            
            if (causeResponse.success && causeResponse.data) {
              newPost.cause = causeResponse.data;
            }
          }

          // Fetch event data if post references an event
          if (newPostData.event_id) {
            console.log('[FEED] 🎉 New post with event, fetching event data...');
            const { data: eventData } = await supabase
              .from('events')
              .select('*')
              .eq('id', newPostData.event_id)
              .single();

            if (eventData) {
              const event: any = {
                id: eventData.id,
                slug: eventData.slug,
                title: eventData.title,
                description: eventData.description,
                category: eventData.category,
                location: eventData.location,
                locationAddress: eventData.location_address,
                latitude: eventData.latitude,
                longitude: eventData.longitude,
                mapLink: eventData.map_link,
                isVirtual: eventData.is_virtual ?? false,
                virtualLink: eventData.virtual_link,
                eventDate: eventData.event_date,
                startTime: eventData.start_time,
                endTime: eventData.end_time,
                timezone: eventData.timezone || 'America/Jamaica',
                capacity: eventData.capacity,
                spotsRemaining: eventData.spots_remaining,
                registrationRequired: eventData.registration_required ?? false,
                isFree: eventData.is_free ?? true,
                ticketPrice: eventData.ticket_price ? parseFloat(eventData.ticket_price) : undefined,
                currency: eventData.currency || 'JMD',
                imageUrl: eventData.image_url,
                status: eventData.status,
                isFeatured: eventData.is_featured ?? false,
                visibility: eventData.visibility || 'public',
                createdAt: eventData.created_at,
                updatedAt: eventData.updated_at,
              };
              newPost.event = event;
            }
          }

          // Check for shared posts and fetch original post
          if (newPostData.shared_post_id) {
            console.log('[FEED] 📎 New shared post, fetching original...');
            const { data: originalPostData } = await supabase
              .from('posts')
              .select(`
                *,
                user:users(*)
              `)
              .eq('id', newPostData.shared_post_id)
              .single();

            if (originalPostData) {
              // Fetch comments for original post
              const { data: originalComments } = await supabase
                .from('comments')
                .select(`
                  *,
                  user:users(*)
                `)
                .eq('post_id', originalPostData.id)
                .order('created_at', { ascending: true });

              // Fetch reactions for original post
              const { data: originalReactions } = await supabase
                .from('post_reactions')
                .select(`
                  *,
                  user:users(*)
                `)
                .eq('post_id', originalPostData.id);

              const originalReactionsList: PostReaction[] = originalReactions?.map((reaction) => ({
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
                  membershipTier: reaction.user.membership_tier || 'free',
                  membershipStatus: reaction.user.membership_status || 'inactive',
                  is_partner_organization: reaction.user.is_partner_organization || false,
                  createdAt: reaction.user.created_at,
                  updatedAt: reaction.user.updated_at,
                },
              })) || [];

              const originalPost: Post = {
                id: originalPostData.id,
                userId: originalPostData.user_id,
                user: {
                  id: originalPostData.user.id,
                  email: originalPostData.user.email,
                  fullName: originalPostData.user.full_name,
                  phone: originalPostData.user.phone,
                  location: originalPostData.user.location,
                  bio: originalPostData.user.bio,
                  areasOfExpertise: originalPostData.user.areas_of_expertise,
                  education: originalPostData.user.education,
                  avatarUrl: originalPostData.user.avatar_url,
                  role: originalPostData.user.role,
                  totalHours: originalPostData.user.total_hours,
                  activitiesCompleted: originalPostData.user.activities_completed,
                  organizationsHelped: originalPostData.user.organizations_helped,
                  achievements: [],
                  membershipTier: originalPostData.user.membership_tier || 'free',
                  membershipStatus: originalPostData.user.membership_status || 'inactive',
                  is_partner_organization: originalPostData.user.is_partner_organization || false,
                  createdAt: originalPostData.user.created_at,
                  updatedAt: originalPostData.user.updated_at,
                },
                text: originalPostData.text,
                mediaUrls: originalPostData.media_urls || [],
                mediaTypes: originalPostData.media_types || [],
                visibility: originalPostData.visibility || 'public',
                likes: originalPostData.likes || [],
                comments: originalComments?.map((comment) => ({
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
                  membershipTier: comment.user.membership_tier || 'free',
                  membershipStatus: comment.user.membership_status || 'inactive',
                  is_partner_organization: comment.user.is_partner_organization || false,
                  createdAt: comment.user.created_at,
                  updatedAt: comment.user.updated_at,
                },
                text: comment.text,
                  createdAt: comment.created_at,
                })) || [],
                shares: originalPostData.shares || 0,
                opportunityId: originalPostData.opportunity_id,
                isAnnouncement: originalPostData.is_announcement || false,
                isPinned: originalPostData.is_pinned || false,
                reactions: originalReactionsList,
                reactionSummary: calculateReactionSummary(originalReactionsList, user?.id),
                createdAt: originalPostData.created_at,
                updatedAt: originalPostData.updated_at,
              };

              newPost.sharedPost = originalPost;
            }
          }

          console.log('[FEED] ✅ Adding new post to feed');
          setPosts((prev) => [newPost, ...prev]);
        }
      )

      // ========== POST UPDATES (likes, shares, pins) ==========
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('[FEED] 🔄 Post updated:', payload.new);
          const updatedPostData = payload.new as any;

          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === updatedPostData.id) {
                console.log('[FEED] ✅ Updating post in feed:', updatedPostData.id);
                return {
                  ...p,
                  likes: updatedPostData.likes || p.likes,
                  shares: updatedPostData.shares || p.shares,
                  isPinned: updatedPostData.is_pinned || p.isPinned,
                  updatedAt: updatedPostData.updated_at,
                };
              }
              return p;
            })
          );
        }
      )

      // ========== POST DELETES ==========
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('[FEED] 🗑️ Post deleted:', payload.old);
          const deletedPostData = payload.old as any;

          console.log('[FEED] ✅ Removing post from feed');
          setPosts((prev) => prev.filter((p) => p.id !== deletedPostData.id));
        }
      )

      // ========== NEW COMMENTS ==========
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        async (payload) => {
          console.log('[FEED] 💬 New comment detected:', payload.new);
          const newCommentData = payload.new as any;

          // Fetch user details for the comment
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', newCommentData.user_id)
            .single();

          if (!userData) {
            console.log('[FEED] ⚠️ Could not fetch user data for comment');
            return;
          }

          const newComment: Comment = {
            id: newCommentData.id,
            postId: newCommentData.post_id,
            userId: newCommentData.user_id,
            user: {
              id: userData.id,
              email: userData.email,
              fullName: userData.full_name,
              phone: userData.phone,
              location: userData.location,
              bio: userData.bio,
              areasOfExpertise: userData.areas_of_expertise,
              education: userData.education,
              avatarUrl: userData.avatar_url,
              role: userData.role,
              totalHours: userData.total_hours,
              activitiesCompleted: userData.activities_completed,
              organizationsHelped: userData.organizations_helped,
              achievements: [],
              membershipTier: userData.membership_tier || 'free',
              membershipStatus: userData.membership_status || 'inactive',
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            },
            text: newCommentData.text,
            createdAt: newCommentData.created_at,
          };

          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === newCommentData.post_id) {
                console.log('[FEED] ✅ Adding comment to post:', p.id);
                // Check if comment already exists (to avoid duplicates from optimistic updates)
                const commentExists = p.comments.some(c => c.id === newComment.id);
                if (commentExists) {
                  console.log('[FEED] ℹ️ Comment already exists (optimistic update)');
                  return p;
                }
                return {
                  ...p,
                  comments: [...p.comments, newComment],
                };
              }
              return p;
            })
          );
        }
      )

      // ========== REACTIONS INSERT ==========
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_reactions',
        },
        async (payload) => {
          console.log('[FEED] 👍 New reaction detected:', payload.new);
          const newReaction = payload.new as any;
          
          // If this is our own reaction and we already optimistically added one, replace it instead of duplicating
          const isOwnReaction = user && newReaction.user_id === user.id;

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
              membershipTier: userData.membership_tier || 'free',
              membershipStatus: userData.membership_status || 'inactive',
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            } : undefined,
          };

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === newReaction.post_id) {
                console.log('[FEED] ✅ Adding reaction to post:', p.id);
                const currentReactions = p.reactions || [];

                // 1) If this is our own insert and a temp optimistic reaction exists, replace it
                if (isOwnReaction) {
                  const idxByUser = currentReactions.findIndex(r => r.userId === newReaction.user_id);
                  if (idxByUser !== -1) {
                    const replacing = currentReactions[idxByUser];
                    if (replacing.id.startsWith('temp-') || replacing.id !== reaction.id) {
                      const reactions = currentReactions.map((r, i) => i === idxByUser ? reaction : r);
                      return {
                        ...p,
                        reactions,
                        reactionSummary: calculateReactionSummary(reactions, user?.id),
                      };
                    }
                  }
                }

                // 2) If a reaction with same id already exists, skip (already reconciled)
                const reactionExists = currentReactions.some(r => r.id === reaction.id);
                if (reactionExists) {
                  console.log('[FEED] ℹ️ Reaction already exists (optimistic or prior event)');
                  return p;
                }

                // 3) Otherwise, append normally
                const reactions = [...currentReactions, reaction];
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

      // ========== REACTIONS UPDATE ==========
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_reactions',
        },
        async (payload) => {
          console.log('[FEED] 🔄 Reaction updated:', payload.new);
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
              membershipTier: userData.membership_tier || 'free',
              membershipStatus: userData.membership_status || 'inactive',
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            } : undefined,
          };

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === updatedReaction.post_id) {
                console.log('[FEED] ✅ Updating reaction in post:', p.id);
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

      // ========== REACTIONS DELETE ==========
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_reactions',
        },
        (payload) => {
          console.log('[FEED] 🗑️ Reaction deleted:', payload.old);
          const deletedReaction = payload.old as any;

          // Update post reactions
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === deletedReaction.post_id) {
                console.log('[FEED] ✅ Removing reaction from post:', p.id);
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
      .subscribe((status) => {
        console.log('[FEED] 📡 Real-time subscription status:', status);
      });

    return () => {
      console.log('[FEED] 🔌 Unsubscribing from real-time channel');
      channel.unsubscribe();
    };
  };

  const loadFeed = async () => {
    try {
      console.log('[FEED] 📥 Loading feed...');
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

      console.log('[FEED] ✅ Loaded', postsData.length, 'posts');

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
              membershipTier: reaction.user.membership_tier || 'free',
              membershipStatus: reaction.user.membership_status || 'inactive',
              is_partner_organization: reaction.user.is_partner_organization || false,
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
              membershipTier: post.user.membership_tier || 'free',
              membershipStatus: post.user.membership_status || 'inactive',
              is_partner_organization: post.user.is_partner_organization || false,
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
                membershipTier: comment.user.membership_tier || 'free',
                membershipStatus: comment.user.membership_status || 'inactive',
                is_partner_organization: comment.user.is_partner_organization || false,
                createdAt: comment.user.created_at,
                updatedAt: comment.user.updated_at,
              },
              text: comment.text,
              createdAt: comment.created_at,
            })) || [],
            shares: post.shares || 0,
            opportunityId: post.opportunity_id,
            causeId: post.cause_id,
            eventId: post.event_id,
            isAnnouncement: post.is_announcement || false,
            isPinned: post.is_pinned || false,
            reactions, // ✅ Add reactions
            reactionSummary: calculateReactionSummary(reactions, user?.id), // ✅ Add summary
            sharedPostId: post.shared_post_id || null,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
          } as Post;
        })
      );

      // Fetch opportunities for posts that reference them
      const postsWithOpportunities = await Promise.all(
        postsWithDetails.map(async (post) => {
          if (post.opportunityId) {
            console.log('[FEED] 🎯 Loading opportunity data for post:', post.id);
            const { data: opportunityData } = await supabase
              .from('opportunities')
              .select('*')
              .eq('id', post.opportunityId)
              .single();

            if (opportunityData) {
              const opportunity: any = {
                id: opportunityData.id,
                slug: opportunityData.slug,
                title: opportunityData.title,
                description: opportunityData.description,
                organizationName: opportunityData.organization_name,
                organizationVerified: opportunityData.organization_verified,
                category: opportunityData.category,
                location: opportunityData.location,
                latitude: opportunityData.latitude,
                longitude: opportunityData.longitude,
                date: opportunityData.date || opportunityData.date_start,
                dateStart: opportunityData.date_start,
                dateEnd: opportunityData.date_end,
                timeStart: opportunityData.time_start,
                timeEnd: opportunityData.time_end,
                duration: opportunityData.duration,
                spotsAvailable: opportunityData.spots_available,
                spotsTotal: opportunityData.spots_total,
                imageUrl: opportunityData.image_url,
                status: opportunityData.status,
              };
              return { ...post, opportunity };
            }
          }
          return post;
        })
      );

      // Fetch causes for posts that reference them
      const postsWithCauses = await Promise.all(
        postsWithOpportunities.map(async (post) => {
          if (post.causeId) {
            console.log('[FEED] 💙 Loading cause data for post:', post.id);
            const causeResponse = await getCauseById(post.causeId);
            
            if (causeResponse.success && causeResponse.data) {
              return { ...post, cause: causeResponse.data };
            }
          }
          return post;
        })
      );

      // Fetch events for posts that reference them
const postsWithEvents = await Promise.all(
  postsWithCauses.map(async (post) => {
    if (post.eventId) {
      console.log('[FEED] 🎉 Loading event data for post:', post.id);
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', post.eventId)
        .single();

      if (eventData) {
        const event: any = {
          id: eventData.id,
          slug: eventData.slug,
          title: eventData.title,
          description: eventData.description,
          category: eventData.category,
          location: eventData.location,
          locationAddress: eventData.location_address,
          latitude: eventData.latitude,
          longitude: eventData.longitude,
          mapLink: eventData.map_link,
          isVirtual: eventData.is_virtual ?? false,
          virtualLink: eventData.virtual_link,
          eventDate: eventData.event_date,
          startTime: eventData.start_time,
          endTime: eventData.end_time,
          timezone: eventData.timezone || 'America/Jamaica',
          capacity: eventData.capacity,
          spotsRemaining: eventData.spots_remaining,
          registrationRequired: eventData.registration_required ?? false,
          isFree: eventData.is_free ?? true,
          ticketPrice: eventData.ticket_price ? parseFloat(eventData.ticket_price) : undefined,
          currency: eventData.currency || 'JMD',
          imageUrl: eventData.image_url,
          status: eventData.status,
          isFeatured: eventData.is_featured ?? false,
          visibility: eventData.visibility || 'public',
          createdAt: eventData.created_at,
          updatedAt: eventData.updated_at,
        };
        return { ...post, event };
      }
    }
    return post;
  })
);

      // Fetch original posts for shared posts
      const postsWithSharedData = await Promise.all(
        postsWithEvents.map(async (post) => {
          if (post.sharedPostId) {
            console.log('[FEED] 📎 Loading shared post data for:', post.id);
            // Fetch the original post
            const { data: originalPostData } = await supabase
              .from('posts')
              .select(`
                *,
                user:users(*)
              `)
              .eq('id', post.sharedPostId)
              .single();

            if (originalPostData) {
              // Fetch comments for original post
              const { data: originalComments } = await supabase
                .from('comments')
                .select(`
                  *,
                  user:users(*)
                `)
                .eq('post_id', originalPostData.id)
                .order('created_at', { ascending: true });

              // Fetch reactions for original post
              const { data: originalReactions } = await supabase
                .from('post_reactions')
                .select(`
                  *,
                  user:users(*)
                `)
                .eq('post_id', originalPostData.id);

              const originalReactionsList: PostReaction[] = originalReactions?.map((reaction) => ({
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
                  membershipTier: reaction.user.membership_tier || 'free',
                  membershipStatus: reaction.user.membership_status || 'inactive',
                  createdAt: reaction.user.created_at,
                  updatedAt: reaction.user.updated_at,
                },
              })) || [];

              const originalPost: Post = {
                id: originalPostData.id,
                userId: originalPostData.user_id,
                user: {
                  id: originalPostData.user.id,
                  email: originalPostData.user.email,
                  fullName: originalPostData.user.full_name,
                  phone: originalPostData.user.phone,
                  location: originalPostData.user.location,
                  bio: originalPostData.user.bio,
                  areasOfExpertise: originalPostData.user.areas_of_expertise,
                  education: originalPostData.user.education,
                  avatarUrl: originalPostData.user.avatar_url,
                  role: originalPostData.user.role,
                  totalHours: originalPostData.user.total_hours,
                  activitiesCompleted: originalPostData.user.activities_completed,
                  organizationsHelped: originalPostData.user.organizations_helped,
                  achievements: [],
                  membershipTier: originalPostData.user.membership_tier || 'free',
                  membershipStatus: originalPostData.user.membership_status || 'inactive',
                  createdAt: originalPostData.user.created_at,
                  updatedAt: originalPostData.user.updated_at,
                },
                text: originalPostData.text,
                mediaUrls: originalPostData.media_urls || [],
                mediaTypes: originalPostData.media_types || [],
                visibility: originalPostData.visibility || 'public',
                likes: originalPostData.likes || [],
                comments: originalComments?.map((comment) => ({
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
                  membershipTier: comment.user.membership_tier || 'free',
                  membershipStatus: comment.user.membership_status || 'inactive',
                  createdAt: comment.user.created_at,
                  updatedAt: comment.user.updated_at,
                },
                text: comment.text,
                  createdAt: comment.created_at,
                })) || [],
                shares: originalPostData.shares || 0,
                opportunityId: originalPostData.opportunity_id,
                isAnnouncement: originalPostData.is_announcement || false,
                isPinned: originalPostData.is_pinned || false,
                reactions: originalReactionsList,
                reactionSummary: calculateReactionSummary(originalReactionsList, user?.id),
                createdAt: originalPostData.created_at,
                updatedAt: originalPostData.updated_at,
              };

              return {
                ...post,
                sharedPost: originalPost,
              };
            }
          }
          return post;
        })
      );

      setPosts(postsWithSharedData);
      console.log('[FEED] ✅ Feed loaded successfully');
    } catch (error) {
      console.error('[FEED] ❌ Error loading feed:', error);
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
      console.log('[FEED] 📝 Creating new post...');
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

      console.log('[FEED] ✅ Post created, adding optimistically');
      setPosts((prev) => [newPost, ...prev]);
      return { success: true, data: newPost };
    } catch (error: any) {
      console.error('[FEED] ❌ Error creating post:', error);
      return { success: false, error: error.message };
    }
  };

  const likePost = async (postId: string) => {
    if (!user) return;

    try {
      console.log('[FEED] ❤️ Liking post:', postId);
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newLikes = [...post.likes, user.id];

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: newLikes } : p
        )
      );

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);

      if (error) {
        console.error('[FEED] ❌ Error liking post:', error);
        // Revert optimistic update
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likes: post.likes } : p
          )
        );
        throw error;
      }

      console.log('[FEED] ✅ Post liked successfully');
    } catch (error) {
      console.error('[FEED] ❌ Error liking post:', error);
    }
  };

  const unlikePost = async (postId: string) => {
    if (!user) return;

    try {
      console.log('[FEED] 💔 Unliking post:', postId);
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newLikes = post.likes.filter((id) => id !== user.id);

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: newLikes } : p
        )
      );

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);

      if (error) {
        console.error('[FEED] ❌ Error unliking post:', error);
        // Revert optimistic update
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likes: post.likes } : p
          )
        );
        throw error;
      }

      console.log('[FEED] ✅ Post unliked successfully');
    } catch (error) {
      console.error('[FEED] ❌ Error unliking post:', error);
    }
  };

  const addComment = async (postId: string, text: string): Promise<ApiResponse<Comment>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 💬 Adding comment to post:', postId);
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

      // Optimistic update
      console.log('[FEED] ✅ Comment added optimistically');
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: [...p.comments, newComment] }
            : p
        )
      );

      return { success: true, data: newComment };
    } catch (error: any) {
      console.error('[FEED] ❌ Error adding comment:', error);
      return { success: false, error: error.message };
    }
  };

  const sharePost = async (postId: string) => {
    try {
      console.log('[FEED] 🔄 Sharing post:', postId);
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const newShares = post.shares + 1;

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, shares: newShares } : p
        )
      );

      const { error } = await supabase
        .from('posts')
        .update({ shares: newShares })
        .eq('id', postId);

      if (error) {
        console.error('[FEED] ❌ Error sharing post:', error);
        // Revert optimistic update
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, shares: post.shares } : p
          )
        );
        throw error;
      }

      console.log('[FEED] ✅ Post shared successfully');
    } catch (error) {
      console.error('[FEED] ❌ Error sharing post:', error);
    }
  };

  const shareToFeed = async (postId: string, customComment?: string): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 📤 Sharing post to feed (Facebook-style):', postId);
      const originalPost = posts.find((p) => p.id === postId);
      if (!originalPost) {
        return { success: false, error: 'Original post not found' };
      }

      console.log('[FEED] Creating shared post with reference...');
      console.log('[FEED] Custom comment:', customComment || '(none)');
      
      // Create the shared post with reference to original
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          text: customComment || '', // User's optional comment
          shared_post_id: postId,     // Reference to original post
          media_urls: [],             // Shared posts don't duplicate media
          media_types: [],
          visibility: 'public',
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment share count on original post
      await sharePost(postId);

      const newPost: Post = {
        id: data.id,
        userId: user.id,
        user: user,
        text: data.text, // The user's comment
        mediaUrls: [],
        mediaTypes: [],
        visibility: data.visibility || 'public',
        likes: [],
        comments: [],
        shares: 0,
        reactions: [],
        reactionSummary: {
          heart: 0,
          thumbsup: 0,
          clap: 0,
          fire: 0,
          star: 0,
          total: 0,
        },
        isAnnouncement: false,
        isPinned: false,
        sharedPostId: postId,        // NEW: Store reference
        sharedPost: originalPost,     // NEW: Embed original post
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      console.log('[FEED] ✅ Shared post created, adding optimistically');
      setPosts((prev) => [newPost, ...prev]);
      
      return { success: true, data: newPost };
    } catch (error: any) {
      console.error('[FEED] ❌ Error sharing to feed:', error);
      return { success: false, error: error.message };
    }
  };

  const shareOpportunityToFeed = async (
    opportunityId: string,
    customMessage?: string,
    visibility: 'public' | 'circle' = 'public'
  ): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 📤 Sharing opportunity to feed:', opportunityId);
      console.log('[FEED] Custom message:', customMessage || '(none)');
      console.log('[FEED] Visibility:', visibility);

      // Fetch opportunity details
      const { data: opportunityData, error: oppError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (oppError || !opportunityData) {
        return { success: false, error: 'Opportunity not found' };
      }

      console.log('[FEED] Creating post with opportunity reference...');

      // Create post with opportunity reference
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          text: customMessage || '', // User's optional message
          opportunity_id: opportunityId, // Reference to opportunity
          media_urls: opportunityData.image_url ? [opportunityData.image_url] : [],
          media_types: opportunityData.image_url ? ['image'] : [],
          visibility: visibility,
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Transform opportunity data to Opportunity type
      const opportunity: any = {
        id: opportunityData.id,
        title: opportunityData.title,
        description: opportunityData.description,
        organizationName: opportunityData.organization_name,
        organizationVerified: opportunityData.organization_verified,
        category: opportunityData.category,
        location: opportunityData.location,
        latitude: opportunityData.latitude,
        longitude: opportunityData.longitude,
        date: opportunityData.date,
        dateStart: opportunityData.date_start,
        dateEnd: opportunityData.date_end,
        timeStart: opportunityData.time_start,
        timeEnd: opportunityData.time_end,
        duration: opportunityData.duration,
        spotsAvailable: opportunityData.spots_available,
        spotsTotal: opportunityData.spots_total,
        imageUrl: opportunityData.image_url,
        status: opportunityData.status,
      };

      const newPost: Post = {
        id: data.id,
        userId: user.id,
        user: user,
        text: data.text,
        mediaUrls: data.media_urls || [],
        mediaTypes: data.media_types || [],
        visibility: data.visibility || visibility,
        likes: [],
        comments: [],
        shares: 0,
        reactions: [],
        reactionSummary: {
          heart: 0,
          thumbsup: 0,
          clap: 0,
          fire: 0,
          star: 0,
          total: 0,
        },
        isAnnouncement: false,
        isPinned: false,
        opportunityId: opportunityId,
        opportunity: opportunity,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      console.log('[FEED] ✅ Opportunity shared to feed, adding optimistically');
      setPosts((prev) => [newPost, ...prev]);

      return { success: true, data: newPost };
    } catch (error: any) {
      console.error('[FEED] ❌ Error sharing opportunity to feed:', error);
      return { success: false, error: error.message };
    }
  };

  const shareCauseToFeed = async (
    causeId: string,
    customMessage?: string,
    visibility: 'public' | 'circle' = 'public'
  ): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 📤 Sharing cause to feed:', causeId);
      console.log('[FEED] Custom message:', customMessage || '(none)');
      console.log('[FEED] Visibility:', visibility);

      // Fetch cause details (using service to get recalculated amount_raised)
      const causeResponse = await getCauseById(causeId);

      if (!causeResponse.success || !causeResponse.data) {
        return { success: false, error: 'Cause not found' };
      }

      const causeData = causeResponse.data;

      console.log('[FEED] Creating post with cause reference...');

      // Create post with cause reference
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          text: customMessage || '', // User's optional message
          cause_id: causeId, // Reference to cause
          media_urls: causeData.imageUrl ? [causeData.imageUrl] : [],
          media_types: causeData.imageUrl ? ['image'] : [],
          visibility: visibility,
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Use the cause data from the service (already transformed and with recalculated amount_raised)
      const cause = causeData;

      const newPost: Post = {
        id: data.id,
        userId: user.id,
        user: user,
        text: data.text,
        mediaUrls: data.media_urls || [],
        mediaTypes: data.media_types || [],
        visibility: data.visibility || visibility,
        likes: [],
        comments: [],
        shares: 0,
        reactions: [],
        reactionSummary: {
          heart: 0,
          thumbsup: 0,
          clap: 0,
          fire: 0,
          star: 0,
          total: 0,
        },
        isAnnouncement: false,
        isPinned: false,
        causeId: causeId,
        cause: cause,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      console.log('[FEED] ✅ Cause shared to feed, adding optimistically');
      setPosts((prev) => [newPost, ...prev]);

      return { success: true, data: newPost };
    } catch (error: any) {
      console.error('[FEED] ❌ Error sharing cause to feed:', error);
      return { success: false, error: error.message };
    }
  };

  const shareEventToFeed = async (
    eventId: string,
    customMessage?: string,
    visibility: 'public' | 'circle' = 'public'
  ): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 📤 Sharing event to feed:', eventId);
      console.log('[FEED] Custom message:', customMessage || '(none)');
      console.log('[FEED] Visibility:', visibility);

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !eventData) {
        return { success: false, error: 'Event not found' };
      }

      console.log('[FEED] Creating post with event reference...');

      // Create post with event reference
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          text: customMessage || '', // User's optional message
          event_id: eventId, // Reference to event
          media_urls: eventData.image_url ? [eventData.image_url] : [],
          media_types: eventData.image_url ? ['image'] : [],
          visibility: visibility,
          likes: [],
          shares: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Transform event data to Event type
      const event: any = {
        id: eventData.id,
        title: eventData.title,
        description: eventData.description,
        category: eventData.category,
        eventDate: eventData.event_date,
        startTime: eventData.start_time,
        endTime: eventData.end_time,
        location: eventData.location,
        isVirtual: eventData.is_virtual,
        virtualLink: eventData.virtual_link,
        ticketPrice: eventData.ticket_price,
        isFree: eventData.is_free,
        capacity: eventData.capacity,
        spotsRemaining: eventData.spots_remaining,
        registrationRequired: eventData.registration_required,
        imageUrl: eventData.image_url,
        isFeatured: eventData.is_featured,
        status: eventData.status,
      };

      const newPost: Post = {
        id: data.id,
        userId: user.id,
        user: user,
        text: data.text,
        mediaUrls: data.media_urls || [],
        mediaTypes: data.media_types || [],
        visibility: data.visibility || visibility,
        likes: [],
        comments: [],
        shares: 0,
        reactions: [],
        reactionSummary: {
          heart: 0,
          thumbsup: 0,
          clap: 0,
          fire: 0,
          star: 0,
          total: 0,
        },
        isAnnouncement: false,
        isPinned: false,
        eventId: eventId,
        event: event,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      console.log('[FEED] ✅ Event shared to feed, adding optimistically');
      setPosts((prev) => [newPost, ...prev]);

      return { success: true, data: newPost };
    } catch (error: any) {
      console.error('[FEED] ❌ Error sharing event to feed:', error);
      return { success: false, error: error.message };
    }
  };

  const deletePost = async (postId: string): Promise<ApiResponse<void>> => {
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    console.log('[FEED] 🗑️ Deleting post:', postId);
    // Check if user is admin or post owner
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    if (user.role !== 'admin' && post.userId !== user.id) {
      return { success: false, error: 'Not authorized to delete this post' };
    }

    // Optimistically remove from UI
    setPosts((prev) => prev.filter((p) => p.id !== postId));

    // Delete comments first
    const { error: commentsError } = await supabase
      .from('comments')
      .delete()
      .eq('post_id', postId);

    if (commentsError) {
      console.error('[FEED] ❌ Error deleting comments:', commentsError);
      throw new Error(`Failed to delete comments: ${commentsError.message}`);
    }

    // Delete reactions
    const { error: reactionsError } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId);

    if (reactionsError) {
      console.error('[FEED] ❌ Error deleting reactions:', reactionsError);
      throw new Error(`Failed to delete reactions: ${reactionsError.message}`);
    }

    // Delete post
    const { error: postError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (postError) {
      console.error('[FEED] ❌ Error deleting post:', postError);
      throw new Error(`Failed to delete post: ${postError.message}`);
    }

    console.log('[FEED] ✅ Post deleted successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[FEED] ❌ Delete post error:', error);
    // Reload feed to restore state if delete failed
    await loadFeed();
    return { success: false, error: error.message };
  }
};

  const updatePost = async (postId: string, text: string): Promise<ApiResponse<Post>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] ✏️ Updating post:', postId);
      
      // Check if user is admin or post owner
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        return { success: false, error: 'Post not found' };
      }

      if (user.role !== 'admin' && post.userId !== user.id) {
        return { success: false, error: 'Not authorized to edit this post' };
      }

      // Optimistically update UI
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, text: text.trim(), updatedAt: new Date().toISOString() }
            : p
        )
      );

      // Update in database
      const { data, error } = await supabase
        .from('posts')
        .update({
          text: text.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      console.log('[FEED] ✅ Post updated successfully');
      
      // Reload to get full updated post data
      await loadFeed();
      
      return { success: true, data: post };
    } catch (error: any) {
      console.error('[FEED] ❌ Update post error:', error);
      // Reload feed to restore state if update failed
      await loadFeed();
      return { success: false, error: error.message };
    }
  };

  // ✨ OPTIMISTIC REACTION - Shows instantly!
  const addReaction = async (postId: string, reactionType: ReactionType): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 👍 Adding reaction:', reactionType, 'to post:', postId);
      
      // Get current post state
      const post = posts.find(p => p.id === postId);
      if (!post) return { success: false, error: 'Post not found' };

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
          console.log('[FEED] ℹ️ Same reaction detected, toggling off');
          return await removeReaction(postId);
        }
        
        // Create optimistic reaction for update
        const optimisticReaction: PostReaction = {
          id: existing.id,
          postId: postId,
          userId: user.id,
          reactionType: reactionType,
          createdAt: existing.created_at,
          user: user,
        };

        // Optimistic update - Show immediately
        console.log('[FEED] ⚡ Updating reaction optimistically');
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              const reactions = (p.reactions || []).map(r => 
                r.userId === user.id ? optimisticReaction : r
              );
              return {
                ...p,
                reactions,
                reactionSummary: calculateReactionSummary(reactions, user.id),
              };
            }
            return p;
          })
        );
        
        // Update in database
        const { error } = await supabase
          .from('post_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);

        if (error) throw error;
        console.log('[FEED] ✅ Reaction updated in database');
      } else {
        // Create optimistic reaction for new insert
        const tempId = `temp-${Date.now()}`;
        const optimisticReaction: PostReaction = {
          id: tempId,
          postId: postId,
          userId: user.id,
          reactionType: reactionType,
          createdAt: new Date().toISOString(),
          user: user,
        };

        // Optimistic update - Show immediately
        console.log('[FEED] ⚡ Adding reaction optimistically');
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              const reactions = [...(p.reactions || []), optimisticReaction];
              return {
                ...p,
                reactions,
                reactionSummary: calculateReactionSummary(reactions, user.id),
              };
            }
            return p;
          })
        );

        // Add new reaction to database
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType,
          });

        if (error) throw error;
        console.log('[FEED] ✅ Reaction added to database');
      }

      return { success: true };
    } catch (error: any) {
      console.error('[FEED] ❌ Error adding reaction:', error);
      // Reload to fix state
      await loadFeed();
      return { success: false, error: error.message };
    }
  };

  // ✨ OPTIMISTIC REACTION REMOVAL
  const removeReaction = async (postId: string): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('[FEED] 🗑️ Removing reaction from post:', postId);

      // Optimistic update - Remove immediately
      console.log('[FEED] ⚡ Removing reaction optimistically');
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const reactions = (p.reactions || []).filter(r => r.userId !== user.id);
            return {
              ...p,
              reactions,
              reactionSummary: calculateReactionSummary(reactions, user.id),
            };
          }
          return p;
        })
      );

      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('[FEED] ✅ Reaction removed from database');
      return { success: true };
    } catch (error: any) {
      console.error('[FEED] ❌ Error removing reaction:', error);
      // Reload to fix state
      await loadFeed();
      return { success: false, error: error.message };
    }
  };

  const refreshFeed = async () => {
    console.log('[FEED] 🔄 Manually refreshing feed...');
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
        shareToFeed,
        shareOpportunityToFeed,
        shareCauseToFeed,
        shareEventToFeed,
        deletePost,
        updatePost,
        refreshFeed,
        addReaction,
        removeReaction,
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