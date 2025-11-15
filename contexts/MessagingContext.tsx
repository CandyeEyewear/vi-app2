/**
 * Messaging Context - SIMPLIFIED LIKE NOTIFICATIONS
 * Real-time updates for conversation list
 */

import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { Conversation, Message, ApiResponse } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { sendNotificationToUser } from '../services/pushNotifications';

interface MessagingContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number;
  getOrCreateConversation: (otherUserId: string) => Promise<ApiResponse<Conversation>>;
  sendMessage: (conversationId: string, text: string) => Promise<ApiResponse<Message>>;
  markAsRead: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<ApiResponse<void>>;
  setTypingStatus: (conversationId: string, isTyping: boolean) => Promise<void>;
  updateOnlineStatus: (isOnline: boolean) => Promise<void>;
  markMessageDelivered: (messageId: string) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  // Load conversations on mount - SIMPLE LIKE NOTIFICATIONS
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // SIMPLE REAL-TIME SUBSCRIPTION LIKE NOTIFICATIONS
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const messageSubscription = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Simply reload conversations when any message changes
          loadConversations();
        }
      )
      .subscribe();

    // Subscribe to conversation changes
    const conversationSubscription = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events
          schema: 'public',
          table: 'conversations',
        },
        () => {
          // Reload conversations when any conversation changes
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
      conversationSubscription.unsubscribe();
    };
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch conversations where user is a participant
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // For each conversation, get participant details and last message
      const conversationsWithDetails = await Promise.all(
        conversationsData.map(async (conv) => {
          // Get participant details with online status
          const { data: usersData } = await supabase
            .from('users')
            .select('*')
            .in('id', conv.participants);

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
            totalHours: u.total_hours,
            activitiesCompleted: u.activities_completed,
            organizationsHelped: u.organizations_helped,
            achievements: [],
            onlineStatus: u.online_status,
            lastSeen: u.last_seen,
            createdAt: u.created_at,
            updatedAt: u.updated_at,
          })) || [];

          // Get last message
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMessage = messagesData?.[0] ? {
            id: messagesData[0].id,
            conversationId: messagesData[0].conversation_id,
            senderId: messagesData[0].sender_id,
            text: messagesData[0].text,
            read: messagesData[0].read,
            status: messagesData[0].status || 'sent',
            createdAt: messagesData[0].created_at,
          } : undefined;

          // Count ONLY unread messages that YOU didn't send
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_id', user.id);

          return {
            id: conv.id,
            participants: conv.participants,
            participantDetails,
            lastMessage,
            unreadCount: unreadCount || 0,
            updatedAt: conv.updated_at,
          } as Conversation;
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

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
    text: string
  ): Promise<ApiResponse<Message>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text,
          read: false,
          status: 'sent',
        })
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
    } else {
      console.log('⏭️ Skipping push notification (disabled in settings)');
    }
  }
}

      const message: Message = {
        id: data.id,
        conversationId: data.conversation_id,
        senderId: data.sender_id,
        text: data.text,
        read: data.read,
        status: data.status || 'sent',
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

  const deleteConversation = async (conversationId: string): Promise<ApiResponse<void>> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Delete all messages in the conversation first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Delete the conversation
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (convError) throw convError;

      // Update local state
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
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

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;

    try {
      await supabase
        .from('users')
        .update({
          online_status: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating online status:', error);
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

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        loading,
        totalUnreadCount,
        getOrCreateConversation,
        sendMessage,
        markAsRead,
        refreshConversations,
        deleteConversation,
        setTypingStatus,
        updateOnlineStatus,
        markMessageDelivered,
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