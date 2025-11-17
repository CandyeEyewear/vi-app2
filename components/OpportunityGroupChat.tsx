import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, User } from 'lucide-react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import CustomAlert from './CustomAlert';
import type { OpportunityChatMessage, TypingIndicator } from '../types';

interface OpportunityGroupChatProps {
  opportunityId: string;
}

export default function OpportunityGroupChat({ opportunityId }: OpportunityGroupChatProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<OpportunityChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userCacheRef = useRef<Map<string, { id: string; fullName: string; avatarUrl: string | null }>>(
    new Map()
  );

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  useEffect(() => {
    loadMessages();
    const cleanup = setupRealtimeSubscription();

    return () => {
      // Cleanup typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Cleanup real-time subscription
      if (cleanup) {
        cleanup();
      }
    };
  }, [opportunityId]);

  const setupRealtimeSubscription = () => {
    console.log('[CHAT] 🔔 Setting up real-time subscription for opportunity:', opportunityId);
    
    // Subscribe to new messages
    const messageSubscription = supabase
      .channel(`opportunity-chat-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'opportunity_chat_messages',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        async (payload) => {
          console.log('[CHAT] 📨 New message received via real-time:', payload.new.id);
          
          // Fetch user details for the new message (with simple in-memory cache)
          let userData = userCacheRef.current.get(payload.new.user_id);
          if (!userData) {
            const { data } = await supabase
              .from('users')
              .select('id, full_name, avatar_url')
              .eq('id', payload.new.user_id)
              .single();

            if (data) {
              userData = {
                id: data.id,
                fullName: data.full_name,
                avatarUrl: data.avatar_url,
              };
              userCacheRef.current.set(payload.new.user_id, userData);
            }
          }

          if (userData) {
            const newMessage: OpportunityChatMessage = {
              id: payload.new.id,
              opportunityId: payload.new.opportunity_id,
              userId: payload.new.user_id,
              message: payload.new.message,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
              user: userData as any,
            };

            console.log('[CHAT] ✅ Adding new message to state:', newMessage.id);
            setMessages((prev) => {
              // Check if message already exists to prevent duplicates
              if (prev.some(msg => msg.id === newMessage.id)) {
                console.log('[CHAT] ⚠️ Message already exists, skipping:', newMessage.id);
                return prev;
              }
              return [...prev, newMessage];
            });
            
            // Scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          } else {
            console.error('[CHAT] ❌ Could not fetch user data for message:', payload.new.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[CHAT] 📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[CHAT] ✅ Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[CHAT] ❌ Channel subscription error');
        }
      });

    return () => {
      console.log('[CHAT] 🧹 Cleaning up real-time subscription');
      messageSubscription.unsubscribe();
    };
  };

  const loadMessages = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('opportunity_chat_messages')
        .select(`
          *,
          user:users (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Convert snake_case to camelCase for user fields
      const formattedMessages = data.map((msg: any) => ({
        id: msg.id,
        opportunityId: msg.opportunity_id,
        userId: msg.user_id,
        message: msg.message,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at,
        user: msg.user ? {
          id: msg.user.id,
          fullName: msg.user.full_name,
          avatarUrl: msg.user.avatar_url,
        } : undefined,
      }));

      setMessages(formattedMessages as OpportunityChatMessage[]);

      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      showAlert('Error', 'Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    try {
      setSending(true);

      const { error } = await supabase
        .from('opportunity_chat_messages')
        .insert({
          opportunity_id: opportunityId,
          user_id: user.id,
          message: messageText.trim(),
        });

      if (error) throw error;

      setMessageText('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      showAlert('Error', 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Broadcast typing indicator (implement if needed)
    // For now, just set a timeout to clear it
    typingTimeoutRef.current = setTimeout(() => {
      // Stop typing indicator
    }, 2000);
  };

  const renderMessage = ({ item }: { item: OpportunityChatMessage }) => {
    const isOwnMessage = item.userId === user?.id;
    const messageUser = item.user;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwnMessage && (
          <View style={styles.avatarContainer}>
            {messageUser?.avatarUrl ? (
              <Image source={{ uri: messageUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={16} color={Colors.light.textSecondary} />
              </View>
            )}
          </View>
        )}

        <View style={styles.messageContent}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{messageUser?.fullName || 'Unknown'}</Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
              ]}
            >
              {item.message}
            </Text>
          </View>
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation with other volunteers!
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {typingUsers[0].userName} is typing...
          </Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={(text) => {
            setMessageText(text);
            handleTyping();
          }}
          placeholder="Type a message..."
          placeholderTextColor={Colors.light.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

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
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.light.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: Colors.light.text,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 4,
    marginLeft: 12,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.card,
  },
  typingText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.card,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});