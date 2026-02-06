/**
 * Messaging Context - SIMPLIFIED LIKE NOTIFICATIONS
 * Real-time updates for conversation list with global presence tracking
 */

import React, { createContext, useState, useContext, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Conversation, Message, ApiResponse } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { sendNotificationToUser, sendEmailNotification } from '../services/pushNotifications';
import { warn as logWarn } from '../utils/logger';

// Debounce delay for real-time subscription updates (ms)
const DEBOUNCE_DELAY = 300;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

interface MessagingContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
  getOrCreateConversation: (otherUserId: string) => Promise<ApiResponse<Conversation>>;
  sendMessage: (conversationId: string, text: string, replyTo?: { id: string; senderId: string; senderName: string; text: string }, attachments?: { type: 'image' | 'video' | 'document'; url: string; filename?: string; thumbnail?: string }[]) => Promise<ApiResponse<Message>>;
  markAsRead: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<ApiResponse<void>>;
  setTypingStatus: (conversationId: string, isTyping: boolean) => Promise<void>;
  updateOnlineStatus: (isOnline: boolean) => Promise<void>;
  markMessageDelivered: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<ApiResponse<void>>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const globalPresenceChannelRef = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const userNameRef = useRef<string>('');
  const offlineUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationsRef = useRef<Conversation[]>([]); // Keep current conversations in ref for partial updates
  const isLoadingRef = useRef(false); // Prevent multiple simultaneous loads
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Failsafe timeout

  useEffect(() => {
    userNameRef.current = user?.fullName || '';
  }, [user?.fullName]);

  // Keep conversationsRef in sync with state for use in partial updates
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // NOTE: This must be defined before it's referenced in dependency arrays below.
  const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
    if (!userId) return;

    try {
      const updates: Record<string, any> = {
        online_status: isOnline,
      };

      // "Last seen" should represent the last time the user was active.
      // We update it when the app goes to background/offline.
      if (!isOnline) {
        updates.last_seen = new Date().toISOString();
      }

      await supabase.from('users').update(updates).eq('id', userId);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }, [userId]);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  // Helper function to check if a user is online
  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.has(userId);
  };

  // Helper to map database user row to participant details
  const mapUserToParticipant = (u: any) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    phone: u.phone,
    location: u.location,
    bio: u.bio,
    areasOfExpertise: u.areas_of_expertise,
    education: u.education,
    avatarUrl: u.avatar_url,
    role: u.role,
    membershipTier: u.membership_tier,
    membershipStatus: u.membership_status,
    is_partner_organization: u.is_partner_organization,
    totalHours: u.total_hours,
    activitiesCompleted: u.activities_completed,
    organizationsHelped: u.organizations_helped,
    achievements: [],
    onlineStatus: u.online_status,
    lastSeen: u.last_seen,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  });

  // OPTIMIZED: Uses batched queries instead of N+1
  const loadConversations = useCallback(async () => {
    if (!user) {
      console.log('[loadConversations] No user, skipping');
      return;
    }

    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      console.log('[loadConversations] Already loading, skipping');
      return;
    }

    console.log('[loadConversations] Starting load for user:', user.id?.substring(0, 8));

    // Set loading inside try to ensure finally ALWAYS resets it
    try {
      isLoadingRef.current = true;
      setLoading(true);

      // Failsafe: Auto-reset loading state after 30 seconds in case something goes wrong
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoadingRef.current) {
          console.warn('[loadConversations] Failsafe timeout triggered - resetting stuck loading state');
          isLoadingRef.current = false;
          setLoading(false);
        }
        loadingTimeoutRef.current = null;
      }, 30000);

      // 1. Fetch all conversations where user is a participant (1 query)
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .not('deleted_by', 'cs', `["${user.id}"]`)
        .order('updated_at', { ascending: false });

      if (conversationsError) {
        console.error('[loadConversations] Error fetching conversations:', conversationsError);
        throw conversationsError;
      }

      console.log('[loadConversations] Found conversations:', conversationsData?.length || 0);

      if (!conversationsData || conversationsData.length === 0) {
        console.log('[loadConversations] No conversations found, setting empty array');
        setConversations([]);
        return;
      }

      // 2. Collect all unique participant IDs across all conversations
      const allParticipantIds = new Set<string>();
      conversationsData.forEach(conv => {
        conv.participants.forEach((id: string) => allParticipantIds.add(id));
      });

      // 3. Fetch ALL users in ONE query (instead of N queries)
      const { data: allUsersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', Array.from(allParticipantIds));

      if (usersError) {
        console.error('[loadConversations] Error fetching users:', usersError);
        throw usersError;
      }

      // Create a lookup map for users
      const usersMap = new Map<string, any>();
      allUsersData?.forEach(u => usersMap.set(u.id, u));

      // 4. Get conversation IDs for batch queries
      const conversationIds = conversationsData.map(c => c.id);

      // 5. Fetch last messages for ALL conversations in ONE query
      const { data: allMessagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('[loadConversations] Error fetching messages:', messagesError);
        throw messagesError;
      }

      // Group messages by conversation and take the first (most recent) for each
      const lastMessageMap = new Map<string, any>();
      allMessagesData?.forEach(msg => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      });

      // 6. Count unread messages per conversation in ONE query
      const { data: unreadMessagesData, error: unreadError } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .eq('read', false)
        .neq('sender_id', user.id);

      if (unreadError) {
        console.error('[loadConversations] Error fetching unread counts:', unreadError);
        throw unreadError;
      }

      // Count unreads per conversation
      const unreadCountMap = new Map<string, number>();
      unreadMessagesData?.forEach(msg => {
        const current = unreadCountMap.get(msg.conversation_id) || 0;
        unreadCountMap.set(msg.conversation_id, current + 1);
      });

      // 7. Build conversations with all details (no additional queries!)
      const conversationsWithDetails = conversationsData.map(conv => {
        // Get participant details from the lookup map
        const participantDetails = conv.participants
          .map((id: string) => usersMap.get(id))
          .filter(Boolean)
          .map(mapUserToParticipant);

        // Get last message from the lookup map
        const lastMsg = lastMessageMap.get(conv.id);
        const lastMessage = lastMsg ? {
          id: lastMsg.id,
          conversationId: lastMsg.conversation_id,
          senderId: lastMsg.sender_id,
          text: lastMsg.text,
          read: lastMsg.read,
          status: lastMsg.status || 'sent',
          createdAt: lastMsg.created_at,
        } : undefined;

        return {
          id: conv.id,
          participants: conv.participants,
          participantDetails,
          lastMessage,
          unreadCount: unreadCountMap.get(conv.id) || 0,
          updatedAt: conv.updated_at,
        } as Conversation;
      });

      console.log('[loadConversations] Successfully loaded', conversationsWithDetails.length, 'conversations');
      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('[loadConversations] Error:', error);
    } finally {
      console.log('[loadConversations] Finally block - resetting loading state');
      // Clear failsafe timeout since we completed normally
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user]);

  // Debounced version to prevent rapid-fire reloads from real-time events
  const debouncedLoadConversations = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      loadConversations();
      debounceTimeoutRef.current = null;
    }, DEBOUNCE_DELAY);
  }, [loadConversations]);

  // Update a single conversation's last message and unread count (for partial updates)
  const updateSingleConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      // Check if we have this conversation
      const existingConv = conversationsRef.current.find(c => c.id === conversationId);
      if (!existingConv) {
        // New conversation - do a full reload
        debouncedLoadConversations();
        return;
      }

      // Fetch just the last message for this conversation
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      // Fetch unread count for this conversation
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('read', false)
        .neq('sender_id', user.id);

      const lastMessage = messagesData?.[0] ? {
        id: messagesData[0].id,
        conversationId: messagesData[0].conversation_id,
        senderId: messagesData[0].sender_id,
        text: messagesData[0].text,
        read: messagesData[0].read,
        status: messagesData[0].status || 'sent',
        createdAt: messagesData[0].created_at,
      } : undefined;

      // Update just this conversation in state
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id !== conversationId) return conv;
          return {
            ...conv,
            lastMessage,
            unreadCount: unreadCount || 0,
            updatedAt: new Date().toISOString(),
          };
        });
        // Re-sort by updatedAt (most recent first)
        return updated.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    } catch (error) {
      console.error('Error updating single conversation:', error);
      // Fall back to full reload on error
      debouncedLoadConversations();
    }
  }, [user, debouncedLoadConversations]);

  // Load conversations on mount
  useEffect(() => {
    console.log('[MessagingContext] Mount effect - userId:', userId?.substring(0, 8) || 'null', 'isLoading:', isLoadingRef.current);
    if (userId) {
      // Reset loading ref on mount in case of stale state from previous render
      isLoadingRef.current = false;
      loadConversations();
    }

    // Cleanup: reset loading state on unmount
    return () => {
      console.log('[MessagingContext] Unmount - cleaning up loading state');
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [userId, loadConversations]);

  // OPTIMIZED REAL-TIME SUBSCRIPTIONS with debouncing and partial updates
  useEffect(() => {
    if (!userId) return;

    // Subscribe to message changes that can affect previews/unreads (INSERT/UPDATE/DELETE)
    // OPTIMIZATION: Only update the affected conversation instead of reloading everything
    const messageSubscription = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          // Only update the specific conversation that received the message
          const conversationId = payload.new?.conversation_id;
          if (conversationId) {
            updateSingleConversation(conversationId);
          } else {
            debouncedLoadConversations();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: any) => {
          // Message updated (e.g., marked as read, soft deleted)
          const conversationId = payload.new?.conversation_id;
          if (conversationId) {
            updateSingleConversation(conversationId);
          } else {
            debouncedLoadConversations();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload: any) => {
          // Hard delete - need conversation_id from old record
          const conversationId = payload.old?.conversation_id;
          if (conversationId) {
            updateSingleConversation(conversationId);
          } else {
            debouncedLoadConversations();
          }
        }
      )
      .subscribe();

    // Subscribe to conversation changes (these are less frequent, use debounced full reload)
    const conversationSubscription = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => debouncedLoadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => debouncedLoadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        () => debouncedLoadConversations()
      )
      .subscribe();

    return () => {
      // Clean up debounce timeout on unmount
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      messageSubscription.unsubscribe();
      conversationSubscription.unsubscribe();
    };
  }, [userId, updateSingleConversation, debouncedLoadConversations]);

  // GLOBAL PRESENCE CHANNEL - Track all online users
  useEffect(() => {
    if (!userId) return;

    // Cancel any pending "mark offline" updates (helps with dev remounts / quick re-init)
    if (offlineUpdateTimeoutRef.current) {
      clearTimeout(offlineUpdateTimeoutRef.current);
      offlineUpdateTimeoutRef.current = null;
    }

    console.log('[GlobalPresence] Setting up global presence channel for user:', userId.substring(0, 8));

    const globalPresenceChannel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    globalPresenceChannelRef.current = globalPresenceChannel;

    // Track presence changes
    globalPresenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = globalPresenceChannel.presenceState();
        const presences = Object.values(state).flat() as any[];
        
        // Extract all online user IDs
        const onlineUserIds = new Set<string>(
          presences
            .filter((p: any) => p.online === true)
            .map((p: any) => p.user_id)
        );
        
        console.log('[GlobalPresence] Synced online users:', onlineUserIds.size);
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[GlobalPresence] User joined:', key);
        const joinedUserId = newPresences[0]?.user_id;
        if (joinedUserId) {
          setOnlineUsers((prev) => new Set(prev).add(joinedUserId));
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[GlobalPresence] User left:', key);
        const leftUserId = leftPresences[0]?.user_id;
        if (leftUserId) {
          setOnlineUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(leftUserId);
            return newSet;
          });
        }
      })
      .subscribe(async (status) => {
        console.log('[GlobalPresence] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // If we had a pending offline update (cleanup from a quick remount), cancel it.
          if (offlineUpdateTimeoutRef.current) {
            clearTimeout(offlineUpdateTimeoutRef.current);
            offlineUpdateTimeoutRef.current = null;
          }

          // Persist presence state (best-effort; used for "Last seen")
          // Fire-and-forget: presence itself is still the source of truth for "online now".
          updateOnlineStatus(true).catch(() => {});

          // Track current user as online
          await globalPresenceChannel.track({
            user_id: userId,
            user_name: userNameRef.current,
            online: true,
            timestamp: new Date().toISOString(),
          });
          console.log('[GlobalPresence] Tracked user as online');
        }
      });

    return () => {
      console.log('[GlobalPresence] Cleaning up presence channel');
      if (globalPresenceChannelRef.current) {
        // Persist last seen on exit (best-effort) - debounce to avoid flip-flopping
        // when effects re-mount quickly (e.g. profile updates, dev strict-mode).
        if (offlineUpdateTimeoutRef.current) {
          clearTimeout(offlineUpdateTimeoutRef.current);
        }
        offlineUpdateTimeoutRef.current = setTimeout(() => {
          updateOnlineStatus(false).catch(() => {});
          offlineUpdateTimeoutRef.current = null;
        }, 1500);

        globalPresenceChannelRef.current.untrack();
        globalPresenceChannelRef.current.unsubscribe();
        supabase.removeChannel(globalPresenceChannelRef.current);
        globalPresenceChannelRef.current = null;
      }
      setOnlineUsers(new Set());
    };
  }, [userId, updateOnlineStatus]);

  // APP STATE LISTENER - Track when app goes to background/foreground
  useEffect(() => {
    if (!userId) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      console.log('[AppState] Changed from', previousAppState, 'to', nextAppState);

      if (nextAppState === 'active' && previousAppState.match(/inactive|background/)) {
        // App came to foreground - mark user as online
        console.log('[AppState] App came to foreground, marking user as online');
        if (globalPresenceChannelRef.current) {
          try {
            updateOnlineStatus(true).catch(() => {});
            await globalPresenceChannelRef.current.track({
              user_id: userId,
              user_name: userNameRef.current,
              online: true,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error('[AppState] Error tracking presence:', error);
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - mark user as offline
        console.log('[AppState] App went to background, marking user as offline');
        if (globalPresenceChannelRef.current) {
          try {
            updateOnlineStatus(false).catch(() => {});
            await globalPresenceChannelRef.current.untrack();
          } catch (error) {
            console.error('[AppState] Error untracking presence:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [userId, updateOnlineStatus]);

  // Keep all your existing functions exactly as they were
  const getOrCreateConversation = async (
    otherUserId: string
  ): Promise<ApiResponse<Conversation>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const participants = [user.id, otherUserId].sort();

      // Check if conversation already exists
      const { data: existingConvs, error: searchError } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .contains('participants', [otherUserId]);

      if (searchError) {
        console.error('Search error:', searchError);
      }

      // Find a conversation that has exactly these two participants
      const existingConv = existingConvs?.find((conv) => {
        return conv.participants.length === 2 &&
               conv.participants.includes(user.id) &&
               conv.participants.includes(otherUserId);
      });

      if (existingConv) {
        // Get participant details
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .in('id', participants);

        const participantDetails = usersData?.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          phone: u.phone,
          location: u.location,
          bio: u.bio,
          areasOfExpertise: u.areas_of_expertise,
          education: u.education,
          avatarUrl: u.avatar_url,
          role: u.role,
          membershipTier: u.membership_tier,
          membershipStatus: u.membership_status,
          is_partner_organization: u.is_partner_organization,
          totalHours: u.total_hours,
          activitiesCompleted: u.activities_completed,
          organizationsHelped: u.organizations_helped,
          achievements: [],
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })) || [];

        const conversation: Conversation = {
          id: existingConv.id,
          participants: existingConv.participants,
          participantDetails,
          unreadCount: 0,
          updatedAt: existingConv.updated_at,
        };

        return { success: true, data: conversation };
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participants,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Get participant details
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .in('id', participants);

      const participantDetails = usersData?.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        location: u.location,
        bio: u.bio,
        areasOfExpertise: u.areas_of_expertise,
        education: u.education,
        avatarUrl: u.avatar_url,
        role: u.role,
        membershipTier: u.membership_tier,
        membershipStatus: u.membership_status,
        is_partner_organization: u.is_partner_organization,
        totalHours: u.total_hours,
        activitiesCompleted: u.activities_completed,
        organizationsHelped: u.organizations_helped,
        achievements: [],
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })) || [];

      const conversation: Conversation = {
        id: newConv.id,
        participants: newConv.participants,
        participantDetails,
        unreadCount: 0,
        updatedAt: newConv.updated_at,
      };

      setConversations((prev) => [conversation, ...prev]);
      return { success: true, data: conversation };
    } catch (error: any) {
      console.error('Error in getOrCreateConversation:', error);
      return { success: false, error: error.message };
    }
  };

  const sendMessage = async (
    conversationId: string,
    text: string,
    replyTo?: { id: string; senderId: string; senderName: string; text: string },
    attachments?: { type: 'image' | 'video' | 'document'; url: string; filename?: string; thumbnail?: string }[]
  ): Promise<ApiResponse<Message>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Build insert object - only include fields that exist in the database schema
      // Store attachments and reply data in text field (temporary workaround until columns are added)
      let messageText = text;
      
      // Store reply data in text field if present
      if (replyTo?.id) {
        const replyJson = JSON.stringify({
          id: replyTo.id,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName,
          text: replyTo.text,
        });
        messageText = messageText 
          ? `${messageText}\n__REPLY_TO__:${replyJson}`
          : `__REPLY_TO__:${replyJson}`;
      }
      
      // Store attachments in text field if present
      if (attachments && attachments.length > 0) {
        const attachmentsJson = JSON.stringify(attachments);
        // Store attachments with a special marker so we can parse them back
        messageText = messageText 
          ? `${messageText}\n__ATTACHMENTS__:${attachmentsJson}`
          : `__ATTACHMENTS__:${attachmentsJson}`;
      }
      
      const insertData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        text: messageText,
        read: false,
      };
      
      // Note: 'status' column may not exist - if insert fails, you may need to remove this
      // or add the column to your database schema
      insertData.status = 'sent';

      const { data, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Create notification for recipient
      const { data: convData } = await supabase
        .from('conversations')
        .select('participants')
        .eq('id', conversationId)
        .single();

     if (convData) {
  const recipientId = convData.participants.find((id: string) => id !== user.id);
  
  if (recipientId) {
    console.log('💬 Message sent, checking notification settings for recipient:', recipientId.substring(0, 8) + '...');
    
    const { data: settings } = await supabase
      .from('user_notification_settings')
      .select('messages_enabled')
      .eq('user_id', recipientId)
      .single();

    console.log('📊 Recipient notification settings:', settings);

    const shouldSendNotification = settings?.messages_enabled === true;
    console.log('🔔 Should send push notification?', shouldSendNotification);

    if (shouldSendNotification) {
      console.log('✅ Creating database notification...');
      
      await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'message',
          title: 'New Message',
          message: `${user.fullName} sent you a message`,
          link: `/conversation/${conversationId}`,
          related_id: conversationId,
          sender_id: user.id,
        });

      console.log('📤 Sending push notification to recipient...');
      
      // Send push notification
      try {
        const pushResult = await sendNotificationToUser(recipientId, {
          type: 'message',
          id: conversationId,
          title: 'New Message',
          body: `${user.fullName}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
        });

        if (pushResult) {
          console.log('✅ Push notification sent!');
        } else {
          console.error('❌ Failed to send push notification');
        }
      } catch (pushError) {
        console.error('❌ Exception sending push notification:', pushError);
      }

      // Send email notification (async, non-blocking)
      // The Edge Function handles throttling and checks if user is online
      sendEmailNotification(recipientId, 'message', {
        senderName: user.fullName,
        senderAvatarUrl: user.avatarUrl,
        messagePreview: text.substring(0, 150),
        conversationId: conversationId,
      }).then((emailResult) => {
        if (emailResult.success) {
          if (emailResult.skipped) {
            console.log('📧 Email notification skipped (throttled or user online)');
          } else {
            console.log('📧 Email notification sent!');
          }
        } else {
          console.error('📧 Email notification failed:', emailResult.error);
        }
      }).catch((emailError) => {
        console.error('📧 Exception sending email notification:', emailError);
      });
    } else {
      console.log('⏭️ Skipping push notification (disabled in settings)');
    }
  }
}

      // Use provided reply data or fetch if needed
      let replyToData: Message['replyTo'] = undefined;
      if (replyTo) {
        // Use the provided reply data
        replyToData = replyTo;
      } else if (data.reply_to_message_id) {
        // Fallback: fetch reply data if not provided
        const { data: replyData } = await supabase
          .from('messages')
          .select('id, sender_id, text')
          .eq('id', data.reply_to_message_id)
          .single();
        
        if (replyData) {
          // Get sender name
          const { data: senderData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', replyData.sender_id)
            .single();
          
          replyToData = {
            id: replyData.id,
            senderId: replyData.sender_id,
            senderName: senderData?.full_name || 'User',
            text: replyData.text,
          };
        }
      }

      // Parse attachments and reply data from text field if they exist
      let parsedMessageText = data.text;
      let parsedAttachments: Message['attachments'] = undefined;
      let parsedReplyTo: Message['replyTo'] = undefined;
      
      // Parse reply data first (it comes before attachments in the text)
      if (parsedMessageText && parsedMessageText.includes('__REPLY_TO__:')) {
        const replyParts = parsedMessageText.split('__REPLY_TO__:');
        parsedMessageText = replyParts[0].trim();
        try {
          // Extract reply JSON (everything until __ATTACHMENTS__: or end of string)
          const replyJson = replyParts[1].includes('__ATTACHMENTS__:')
            ? replyParts[1].split('__ATTACHMENTS__:')[0]
            : replyParts[1];
          const replyData = JSON.parse(replyJson);
          parsedReplyTo = {
            id: replyData.id,
            senderId: replyData.senderId,
            senderName: replyData.senderName,
            text: replyData.text,
          };
        } catch (e) {
          console.error('Error parsing reply data from message text:', e);
        }
      }
      
      // Parse attachments (after reply data)
      if (parsedMessageText && parsedMessageText.includes('__ATTACHMENTS__:')) {
        const parts = parsedMessageText.split('__ATTACHMENTS__:');
        parsedMessageText = parts[0].trim();
        try {
          parsedAttachments = JSON.parse(parts[1]);
        } catch (e) {
          console.error('Error parsing attachments from message text:', e);
        }
      }
      
      // Use provided data if available (for immediate display), otherwise use parsed
      const finalAttachments = attachments || parsedAttachments;
      const finalReplyTo = replyTo ? {
        id: replyTo.id,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName,
        text: replyTo.text,
      } : parsedReplyTo;

      const message: Message = {
        id: data.id,
        conversationId: data.conversation_id,
        senderId: data.sender_id,
        text: parsedMessageText,
        read: data.read,
        status: data.status || 'sent',
        replyTo: finalReplyTo || replyToData,
        attachments: finalAttachments,
        createdAt: data.created_at,
      };

      return { success: true, data: message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ 
          read: true,
          status: 'read'
        })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const refreshConversations = async () => {
    await loadConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      if (!user?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      // First, get the current deleted_by array
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select('deleted_by')
        .eq('id', conversationId)
        .single();

      if (fetchError) {
        console.error('Error fetching conversation:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Add current user to deleted_by array
      const currentDeletedBy = conversation?.deleted_by || [];
      const updatedDeletedBy = [...currentDeletedBy, user.id];

      // Soft delete: Update deleted_by array
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ deleted_by: updatedDeletedBy })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Error soft deleting conversation:', updateError);
        return { success: false, error: updateError.message };
      }

      // Remove from local state immediately
      setConversations(prev => prev.filter(c => c.id !== conversationId));

      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteConversation:', error);
      return { success: false, error: error.message };
    }
  };

  const setTypingStatus = async (conversationId: string, isTyping: boolean) => {
    if (!user) return;

    try {
      const channel = supabase.channel(`typing:${conversationId}`);
      
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (isTyping) {
            await channel.track({
              user_id: user.id,
              user_name: user.fullName,
              typing: true,
            });
          } else {
            await channel.untrack();
          }
        }
      });
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  };

  const markMessageDelivered = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ status: 'delivered' })
        .eq('id', messageId)
        .neq('sender_id', user.id);
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  };

  const deleteMessage = async (messageId: string): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id, created_at, conversation_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const isOwner = message.sender_id === user.id;

      // Only sender can delete their own messages
      if (!isOwner) {
        return { success: false, error: 'You can only delete your own messages' };
      }

      // Optional: Check if message is less than 1 hour old
      const messageAge = Date.now() - new Date(message.created_at).getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (messageAge > oneHour) {
        return { success: false, error: 'You can only delete messages within 1 hour of sending' };
      }

      // Soft delete
      const { error: deleteError } = await supabase
        .from('messages')
        .update({ 
          deleted_at: new Date().toISOString(),
          text: 'This message was deleted'
        })
        .eq('id', messageId);

      if (deleteError) throw deleteError;

      // Optimistically update inbox preview if this was the lastMessage
      // (realtime UPDATE payloads can be partial depending on replica identity settings)
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.lastMessage?.id !== messageId) return conv;
          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              text: 'This message was deleted',
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        loading,
        totalUnreadCount,
        onlineUsers,
        isUserOnline,
        getOrCreateConversation,
        sendMessage,
        markAsRead,
        refreshConversations,
        deleteConversation,
        setTypingStatus,
        updateOnlineStatus,
        markMessageDelivered,
        deleteMessage,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}