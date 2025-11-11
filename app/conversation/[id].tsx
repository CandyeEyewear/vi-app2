/**
 * Conversation Screen
 * Individual chat with another volunteer - FIXED VERSION
 * - Real-time read receipt updates
 * - Proper message status tracking
 */

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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useMessaging } from '../../contexts/MessagingContext';
import { Colors } from '../../constants/colors';
import { Message } from '../../types';
import { supabase } from '../../services/supabase';
import ProfileActionSheet from '../../components/ProfileActionSheet';
import MessageStatus from '../../components/MessageStatus';
import TypingIndicator from '../../components/TypingIndicator';
import OnlineStatusDot from '../../components/OnlineStatusDot';

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { conversations, sendMessage, markAsRead, setTypingStatus, markMessageDelivered, updateOnlineStatus } = useMessaging();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileActionSheet, setShowProfileActionSheet] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversation = conversations.find((c) => c.id === id);
  const otherUser = conversation?.participantDetails.find((p) => p.id !== user?.id);

  // Merge arrays without duplicate ids
  const mergeUnique = (a: Message[], b: Message[]) => {
    const map = new Map<string, Message>();
    [...a, ...b].forEach(m => map.set(m.id, m));
    return Array.from(map.values());
  };

  useEffect(() => {
    if (!id) return;

    loadMessages();
    markAsRead(id);
    updateOnlineStatus(true);
    
    // Subscribe to new messages (INSERT)
    const messagesChannel = supabase.channel(`conversation:${id}`);
    
    messagesChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMessage: Message = {
            id: payload.new.id,
            conversationId: payload.new.conversation_id,
            senderId: payload.new.sender_id,
            text: payload.new.text,
            read: payload.new.read,
            status: payload.new.status || 'sent',
            createdAt: payload.new.created_at,
          };

          // PREPEND new message so it appears at the *bottom* with inverted list
          setMessages(prev => mergeUnique([newMessage], prev));
          
          // Delivery & read receipts
          if (newMessage.senderId !== user?.id) {
            markMessageDelivered(newMessage.id);
            markAsRead(id);
          }
          
          // Scroll to "bottom" (offset 0 when inverted)
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          });
        }
      )
      // Read receipts/status updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? {
                    ...msg,
                    read: payload.new.read,
                    status: payload.new.status || msg.status,
                  }
                : msg
            )
          );
        }
      )
      .subscribe();

    // Typing indicators
    const typingChannel = supabase.channel(`typing:${id}`);
    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const typingUsers = Object.values(state).flat();
        const someoneTyping = typingUsers.some(
          (u: any) => u.user_id !== user?.id && u.typing
        );
        setOtherUserTyping(someoneTyping);
      })
      .subscribe();

    // Cleanup
    return () => {
      messagesChannel.unsubscribe();
      typingChannel.unsubscribe();
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingStatus(id, false);
    };
  }, [id]);

  const loadMessages = async (loadMore = false) => {
    try {
      if (loadMore) setLoadingMore(true); else setLoading(true);

      let query = supabase
        .from('messages')
        .select('*')
        // Newest first (DESC) works with inverted list: first element renders at bottom
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (loadMore && messages.length > 0) {
        const oldestMsg = messages[messages.length - 1]; // last in array is oldest (since array is DESC)
        query = query.lt('created_at', oldestMsg.createdAt);
      }

      const { data, error } = await query;
      if (error) throw error;

      const messagesData: Message[] = (data ?? []).map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        text: msg.text,
        read: msg.read,
        status: msg.status || 'sent',
        createdAt: msg.created_at,
      }));

      if (loadMore) {
        // Append older messages to END so they appear ABOVE (scrolling up) with inverted list
        setMessages(prev => mergeUnique(prev, messagesData));
      } else {
        // Initial set: newest first
        setMessages(prev => mergeUnique(messagesData, prev));
        // Start at bottom
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      }

      if (messagesData.length > 0) {
        setOldestMessageId(messagesData[messagesData.length - 1].id);
      }
      setHasMore(messagesData.length === 10);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) loadMessages(true);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (!id) return;
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      setTypingStatus(id, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(id, false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !id || sending) return;

    setIsTyping(false);
    setTypingStatus(id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    Keyboard.dismiss();

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    const response = await sendMessage(id, textToSend);
    setSending(false);

    if (!response.success) {
      setInputText(textToSend);
      // TODO: show error toast
    } else {
      // Keep the view pinned to bottom for your own sends too
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleUserTap = () => {
    if (otherUser) setShowProfileActionSheet(true);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMe && item.status && <MessageStatus status={item.status} />}
          </View>
        </View>
      </View>
    );
  };

  if (!conversation || !otherUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Conversation not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.light.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerUser} 
          onPress={handleUserTap}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWithStatus}>
            {otherUser.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                <Text style={styles.headerAvatarText}>
                  {otherUser.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {otherUser.onlineStatus && (
              <OnlineStatusDot isOnline={otherUser.onlineStatus} size={12} />
            )}
          </View>
          <View>
            <Text style={styles.headerName}>{otherUser.fullName}</Text>
            {otherUser.onlineStatus && <Text style={styles.onlineText}>Online</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            inverted={true}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <Text style={styles.loadingMoreText}>Loading older messages...</Text>
                </View>
              ) : !hasMore && messages.length > 0 ? (
                <View style={styles.endOfMessagesContainer}>
                  <Text style={styles.endOfMessagesText}>• Beginning of conversation •</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the conversation!</Text>
              </View>
            }
          />
          {otherUserTyping && otherUser && (
            <TypingIndicator userName={otherUser.fullName} />
          )}
        </>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.light.textSecondary}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Profile Action Sheet */}
      {otherUser && (
        <ProfileActionSheet
          visible={showProfileActionSheet}
          onClose={() => setShowProfileActionSheet(false)}
          userId={otherUser.id}
          userName={otherUser.fullName}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    marginRight: 8,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWithStatus: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  onlineText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
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
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  messageBubbleMe: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  messageText: {
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 4,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.light.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
    marginTop: 32,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  endOfMessagesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endOfMessagesText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
});
