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
  ActionSheetIOS,
  Alert,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Camera, Smile, Paperclip, X, Reply } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '../../contexts/AuthContext';
import { useMessaging } from '../../contexts/MessagingContext';
import { Colors } from '../../constants/colors';
import { Message } from '../../types';
import { supabase } from '../../services/supabase';
import { decode } from 'base64-arraybuffer';
import ProfileActionSheet from '../../components/ProfileActionSheet';
import MessageStatus from '../../components/MessageStatus';
import TypingIndicator from '../../components/TypingIndicator';
import OnlineStatusDot from '../../components/OnlineStatusDot';
import SwipeableMessage from '../../components/SwipeableMessage';
import { UserAvatar, UserNameWithBadge } from '../../components/index';

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { conversations, sendMessage, markAsRead, markMessageDelivered, deleteMessage } = useMessaging();
  
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [otherUserOnline, setOtherUserOnline] = useState(false); // Track if other user is in chat
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [imagePreview, setImagePreview] = useState<{ uri: string; type: string } | null>(null); // For sending new images
  const [viewingImage, setViewingImage] = useState<string | null>(null); // For viewing already-sent images
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  const conversation = conversations.find((c) => c.id === id);
  const otherUser = conversation?.participantDetails.find((p) => p.id !== user?.id);

  // Merge arrays without duplicate ids
  const mergeUnique = (a: Message[], b: Message[]) => {
    const map = new Map<string, Message>();
    [...a, ...b].forEach(m => map.set(m.id, m));
    return Array.from(map.values());
  };

  // Parse attachments and reply data from text field (temporary workaround until columns are added)
  const parseAttachmentsFromText = (text: string): { 
    text: string; 
    attachments?: Message['attachments'];
    replyTo?: Message['replyTo'];
  } => {
    if (!text) {
      return { text: '' };
    }
    
    let messageText = text;
    let attachments: Message['attachments'] = undefined;
    let replyTo: Message['replyTo'] = undefined;
    
    // Parse reply data first (it comes before attachments in the text)
    if (messageText.includes('__REPLY_TO__:')) {
      const replyParts = messageText.split('__REPLY_TO__:');
      messageText = replyParts[0].trim();
      try {
        // Extract reply JSON (everything until __ATTACHMENTS__: or end of string)
        const replyJson = replyParts[1].includes('__ATTACHMENTS__:')
          ? replyParts[1].split('__ATTACHMENTS__:')[0]
          : replyParts[1];
        const replyData = JSON.parse(replyJson);
        replyTo = {
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
    if (messageText.includes('__ATTACHMENTS__:')) {
      const attachmentParts = messageText.split('__ATTACHMENTS__:');
      messageText = attachmentParts[0].trim();
      try {
        attachments = JSON.parse(attachmentParts[1]);
      } catch (e) {
        console.error('Error parsing attachments from message text:', e);
      }
    }
    
    return { text: messageText, attachments, replyTo };
  };

  // Smooth keyboard animations for both iOS and Android
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        
        // Ultra smooth animation - no gaps
        Animated.timing(keyboardAnim, {
          toValue: height,
          duration: Platform.OS === 'ios' ? 250 : 150,
          useNativeDriver: false,
        }).start();
        
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, Platform.OS === 'ios' ? 50 : 100);
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        
        // Ultra smooth animation - smooth transition back
        Animated.timing(keyboardAnim, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 150,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAnim]);

  useEffect(() => {
    if (!id || !user) return;

    loadMessages();
    markAsRead(id);
    
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
        async (payload) => {
          // Parse attachments and reply data from text field
          const { text: messageText, attachments: parsedAttachments, replyTo: parsedReplyTo } = parseAttachmentsFromText(payload.new.text);

          // Use parsed reply data if available, otherwise try to fetch from database (fallback)
          let replyTo: Message['replyTo'] = parsedReplyTo;
          
          // Fallback: If reply data wasn't in text field, try to fetch from database
          if (!replyTo && payload.new.reply_to_message_id) {
            const { data: replyData } = await supabase
              .from('messages')
              .select('id, sender_id, text')
              .eq('id', payload.new.reply_to_message_id)
              .single();
            
            if (replyData) {
              const replySenderId = replyData.sender_id;
              const replySenderName = replySenderId === user?.id 
                ? 'You' 
                : (otherUser?.fullName || 'User');
              
              // Parse attachments from reply message text
              const { text: replyText } = parseAttachmentsFromText(replyData.text);
              
              replyTo = {
                id: replyData.id,
                senderId: replySenderId,
                senderName: replySenderName,
                text: replyText,
              };
            }
          }

          const newMessage: Message = {
            id: payload.new.id,
            conversationId: payload.new.conversation_id,
            senderId: payload.new.sender_id,
            text: messageText,
            read: payload.new.read,
            status: payload.new.status || 'sent',
            deletedAt: payload.new.deleted_at || undefined,
            replyTo,
            attachments: parsedAttachments,
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
      // Read receipts/status updates and deletions
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
                    deletedAt: payload.new.deleted_at || undefined,
                    text: payload.new.text,
                  }
                : msg
            )
          );
        }
      )
      .subscribe();

    // Presence channel for online status and typing indicators
    const presenceChannel = supabase.channel(`presence:${id}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });
    presenceChannelRef.current = presenceChannel; // Store ref for typing updates

    // Track current user as online in this conversation
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const presences = Object.values(state).flat() as any[];
        
        // Check if other user is online in this chat
        const otherUserPresence = presences.find(
          (p: any) => p.user_id === otherUser?.id
        );
        setOtherUserOnline(!!otherUserPresence);
        
        // Check typing status
        const someoneTyping = presences.some(
          (p: any) => p.user_id !== user.id && p.typing
        );
        setOtherUserTyping(someoneTyping);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Other user joined the chat
        if (newPresences[0]?.user_id === otherUser?.id) {
          setOtherUserOnline(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Other user left the chat
        if (leftPresences[0]?.user_id === otherUser?.id) {
          setOtherUserOnline(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user as present in this conversation
          await presenceChannel.track({
            user_id: user.id,
            user_name: user.fullName,
            online: true,
            typing: false,
          });
        }
      });

    // Cleanup: Remove presence when leaving chat
    return () => {
      // Untrack presence before unsubscribing
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
      messagesChannel.unsubscribe();
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      presenceChannelRef.current = null;
      setOtherUserOnline(false);
    };
  }, [id, user, otherUser?.id]);

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

      // Get all reply message IDs that we need to fetch
      const replyMessageIds = (data ?? [])
        .map((msg: any) => msg.reply_to_message_id)
        .filter((id: string | null) => id !== null) as string[];

      // Fetch reply messages in batch if any exist
      let replyMessagesMap: Record<string, any> = {};
      if (replyMessageIds.length > 0) {
        const { data: replyData } = await supabase
          .from('messages')
          .select('id, sender_id, text, created_at')
          .in('id', replyMessageIds);
        
        if (replyData) {
          replyMessagesMap = replyData.reduce((acc: Record<string, any>, msg: any) => {
            acc[msg.id] = msg;
            return acc;
          }, {});
        }
      }

      const messagesData: Message[] = (data ?? []).map((msg: any) => {
        // Get sender name for reply
        let replySenderName = '';
        const replyMessage = msg.reply_to_message_id ? replyMessagesMap[msg.reply_to_message_id] : null;
        
        if (replyMessage) {
          const replySenderId = replyMessage.sender_id;
          if (replySenderId === user?.id) {
            replySenderName = 'You';
          } else {
            const replyUser = conversation?.participantDetails.find(p => p.id === replySenderId);
            replySenderName = replyUser?.fullName || 'User';
          }
        }

        // Parse attachments and reply data from text field
        const { text: messageText, attachments: parsedAttachments, replyTo: parsedReplyTo } = parseAttachmentsFromText(msg.text);
        
        // Use parsed reply data if available, otherwise use fetched reply message (fallback)
        let finalReplyTo: Message['replyTo'] = parsedReplyTo;
        
        // Fallback: If reply data wasn't in text field, use fetched reply message
        if (!finalReplyTo && msg.reply_to_message_id && replyMessage) {
          const { text: replyText } = parseAttachmentsFromText(replyMessage.text);
          finalReplyTo = {
            id: replyMessage.id,
            senderId: replyMessage.sender_id,
            senderName: replySenderName,
            text: replyText || replyMessage.text,
          };
        }

        return {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          text: messageText,
          read: msg.read,
          status: msg.status || 'sent',
          deletedAt: msg.deleted_at || undefined,
          replyTo: finalReplyTo,
          attachments: parsedAttachments,
          createdAt: msg.created_at,
        };
      });

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
    if (!id || !presenceChannelRef.current) return;
    
    // Update typing status via presence channel
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      presenceChannelRef.current.track({
        user_id: user?.id,
        user_name: user?.fullName,
        online: true,
        typing: true,
      });
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          user_id: user?.id,
          user_name: user?.fullName,
          online: true,
          typing: false,
        });
      }
    }, 2000);
  };

  const handleSend = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !id || sending) {
      console.log('handleSend: Early return', { trimmedText, id, sending });
      return;
    }

    setIsTyping(false);
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({
        user_id: user?.id,
        user_name: user?.fullName,
        online: true,
        typing: false,
      });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    Keyboard.dismiss();

    const textToSend = trimmedText;
    
    // Prepare reply data if replying
    const replyData = replyingTo ? {
      id: replyingTo.id,
      senderId: replyingTo.senderId,
      senderName: replyingTo.senderId === user?.id 
        ? 'You' 
        : otherUser?.fullName || 'User',
      text: replyingTo.text,
    } : undefined;
    
    // Clear input immediately for better UX
    setInputText('');
    setReplyingTo(null); // Clear reply
    setSending(true);

    try {
      console.log('handleSend: Sending message', { id, textToSend, hasReply: !!replyData });
      const response = await sendMessage(id, textToSend, replyData);
      console.log('handleSend: Response', response);
      
      if (!response.success) {
        // Restore input text on error
        setInputText(textToSend);
        Alert.alert('Error', response.error || 'Failed to send message');
      } else {
        // Keep the view pinned to bottom for your own sends too
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }
    } catch (error: any) {
      console.error('handleSend: Error', error);
      setInputText(textToSend);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleUserTap = () => {
    if (otherUser) setShowProfileActionSheet(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImagePicker = async () => {
    try {
      // Show action sheet for camera or gallery
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
          },
          async (buttonIndex) => {
            if (buttonIndex === 1) {
              // Camera - request camera permissions
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
                return;
              }
              
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setImagePreview({ uri: result.assets[0].uri, type: 'image' });
              }
            } else if (buttonIndex === 2) {
              // Gallery - request media library permissions
              const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (libraryStatus.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant photo library permissions to select images.');
                return;
              }
              
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setImagePreview({ uri: result.assets[0].uri, type: 'image' });
              }
            }
          }
        );
      } else {
        // Android - show alert
        Alert.alert(
          'Select Image',
          '',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Camera',
              onPress: async () => {
                // Request camera permissions
                const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraStatus.status !== 'granted') {
                  Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
                  return;
                }
                
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setImagePreview({ uri: result.assets[0].uri, type: 'image' });
                }
              },
            },
            {
              text: 'Gallery',
              onPress: async () => {
                // Request media library permissions
                const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (libraryStatus.status !== 'granted') {
                  Alert.alert('Permission needed', 'Please grant photo library permissions to select images.');
                  return;
                }
                
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setImagePreview({ uri: result.assets[0].uri, type: 'image' });
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      // Compress and resize image
      const manipulatedImage = await manipulateAsync(
        uri,
        [{ resize: { width: 1920 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      // Create filename
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${id}/${filename}`;

      // Read file as base64 using fetch + FileReader (SDK 54 compatible)
      const response = await fetch(manipulatedImage.uri);
      if (!response.ok) {
        throw new Error('File does not exist or cannot be read');
      }
      
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Strip data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Convert base64 to ArrayBuffer for Supabase
      const arrayBuffer = decode(base64);

      // Upload to Supabase Storage (using existing post-images bucket)
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSendWithImage = async () => {
    if (!imagePreview || !id || sending || uploadingImage) return;

    try {
      setSending(true);
      const imageUrl = await uploadImage(imagePreview.uri);
      
      if (!imageUrl) {
        // uploadImage already handles errors and resets uploadingImage
        return;
      }

      // Send message with attachment
      const textToSend = inputText.trim() || '';
      
      // Prepare reply data if replying
      const replyData = replyingTo ? {
        id: replyingTo.id,
        senderId: replyingTo.senderId,
        senderName: replyingTo.senderId === user?.id 
          ? 'You' 
          : otherUser?.fullName || 'User',
        text: replyingTo.text,
      } : undefined;
      
      const attachments = [{
        type: 'image' as const,
        url: imageUrl,
        thumbnail: imageUrl, // Use same URL as thumbnail for now
      }];
      
      const response = await sendMessage(id, textToSend, replyData, attachments);
      
      if (response.success) {
        setImagePreview(null);
        setInputText('');
        setReplyingTo(null);
        
        // Scroll to bottom
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to send image');
      }
    } catch (error: any) {
      console.error('Error sending image:', error);
      Alert.alert('Error', error.message || 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  const handleSwipeToReply = (message: Message) => {
    if (message.deletedAt) return; // Can't reply to deleted messages
    setReplyingTo(message);
    Keyboard.dismiss(); // Dismiss keyboard to show reply bar
  };

  const handleLongPressToDelete = (message: Message) => {
    const isMyMessage = message.senderId === user?.id;
    const isDeleted = !!message.deletedAt;
    
    // Can't delete if not yours or already deleted
    if (!isMyMessage || isDeleted) return;

    // Check if within time limit
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const oneHour = 60 * 60 * 1000;
    
    if (messageAge > oneHour) {
      Alert.alert(
        'Cannot Delete',
        'You can only delete messages within 1 hour of sending.'
      );
      return;
    }

    // Show confirmation
    Alert.alert(
      'Delete Message',
      'Delete this message for everyone? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteMessage(message.id);
            
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    const isDeleted = !!item.deletedAt;
    const replySenderName = item.replyTo?.senderId === user?.id 
      ? 'You' 
      : otherUser?.fullName || 'User';
    
    const hasAttachments = item.attachments && item.attachments.length > 0;
    const hasText = item.text && item.text.trim().length > 0;
    
    return (
      <SwipeableMessage
        onSwipeRight={() => handleSwipeToReply(item)}
        disabled={isDeleted}
      >
        <TouchableOpacity
          style={[styles.messageContainer, isMe && styles.messageContainerMe]}
          onLongPress={() => handleLongPressToDelete(item)}
          delayLongPress={500}
          activeOpacity={0.9}
          disabled={!isMe || isDeleted}
        >
          <View style={[
            styles.messageBubble, 
            isMe && styles.messageBubbleMe,
            isDeleted && styles.messageBubbleDeleted
          ]}>
          {/* Reply Quote Preview */}
          {item.replyTo && !isDeleted && (
            <View style={[styles.replyQuote, isMe && styles.replyQuoteMe]}>
              <View style={styles.replyQuoteBorder} />
              <View style={styles.replyQuoteContent}>
                <Text style={[styles.replyQuoteName, isMe && styles.replyQuoteNameMe]}>
                  {replySenderName}
                </Text>
                <Text 
                  style={[styles.replyQuoteText, isMe && styles.replyQuoteTextMe]}
                  numberOfLines={2}
                >
                  {item.replyTo.text}
                </Text>
              </View>
            </View>
          )}
          
          {/* Attachments - WhatsApp Style (Edge-to-Edge) */}
          {hasAttachments && (
            <View style={styles.attachmentsContainer}>
              {item.attachments!.map((attachment, index) => {
                if (attachment.type === 'image') {
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        // Open full-screen image viewer for already-sent images
                        setViewingImage(attachment.url);
                      }}
                      activeOpacity={0.9}
                      style={styles.imageAttachmentWrapper}
                    >
                      <Image
                        source={{ uri: attachment.thumbnail || attachment.url }}
                        style={[
                          styles.messageImage,
                          // Apply bubble corners to image - sharp bottom corner if no text below
                          !hasText ? (
                            isMe 
                              ? { borderBottomRightRadius: 0 } // Sharp corner bottom-right for sent
                              : { borderBottomLeftRadius: 0 }  // Sharp corner bottom-left for received
                          ) : undefined
                        ]}
                        resizeMode="cover"
                      />
                      {/* Timestamp overlay on image - WhatsApp style */}
                      <View style={styles.imageTimestampOverlay}>
                        <View style={styles.imageTimestampBadge}>
                          <Text style={styles.imageTimestampText}>
                            {formatTime(item.createdAt)}
                          </Text>
                          {isMe && item.status && <MessageStatus status={item.status} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }
                return null;
              })}
            </View>
          )}
          
          {/* Message Text - Only show if there's text */}
          {hasText && (
            <>
              <Text style={[
                styles.messageText, 
                isMe && styles.messageTextMe,
                isDeleted && styles.messageTextDeleted
              ]}>
                {isDeleted ? '🚫 This message was deleted' : item.text}
              </Text>
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && !isDeleted && item.status && <MessageStatus status={item.status} />}
              </View>
            </>
          )}
          
          {/* If only image (no text), no additional footer needed - timestamp is on image */}
        </View>
      </TouchableOpacity>
    </SwipeableMessage>
    );
  };

  if (!conversation || !otherUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Conversation not found</Text>
      </View>
    );
  }

  // Calculate header height for keyboard offset
  const headerHeight = insets.top + 60; // insets.top + header content height

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        enabled={Platform.OS === 'ios'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.light.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerUser} 
          onPress={handleUserTap}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWithStatus}>
            <UserAvatar
              avatarUrl={otherUser.avatarUrl || null}
              fullName={otherUser.fullName}
              size="md"
              role={otherUser.role || 'volunteer'}
              membershipTier={otherUser.membershipTier || 'free'}
              membershipStatus={otherUser.membershipStatus || 'inactive'}
            />
            {otherUserOnline && (
              <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                <OnlineStatusDot isOnline={true} size={12} />
              </View>
            )}
          </View>
          <View>
            <UserNameWithBadge
              name={otherUser.fullName}
              role={otherUser.role || 'volunteer'}
              membershipTier={otherUser.membershipTier || 'free'}
              style={styles.headerName}
            />
            {otherUserOnline && <Text style={styles.onlineText}>Online</Text>}
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
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: 16 } // Fixed padding, keyboard handled by input container
            ]}
            inverted={true}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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

      {/* Reply Preview Bar - shows ABOVE input */}
      {replyingTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <View style={styles.replyIndicator} />
            <View style={styles.replyTextContainer}>
              <Text style={styles.replyName}>
                Replying to {replyingTo.senderId === user?.id ? 'yourself' : otherUser?.fullName || 'User'}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {replyingTo.text}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setReplyingTo(null)}
            style={styles.replyCancelButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Container - WhatsApp Style with ultra smooth keyboard transition */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            paddingBottom: keyboardAnim.interpolate({
              inputRange: [0, 1000],
              outputRange: [insets.bottom, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <View style={styles.inputWrapper}>
          {/* Emoji Button - Always visible */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowEmojiPicker(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Smile size={24} color={Colors.light.textSecondary} />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? "Type a reply..." : "Message"}
            placeholderTextColor={Colors.light.textSecondary}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
            returnKeyType="default"
            blurOnSubmit={false}
            textAlignVertical="center"
          />

          {/* Right Side Buttons - Conditional based on typing state */}
          {inputText.trim() ? (
            // When typing: Show Send button
            <TouchableOpacity
              style={[
                styles.sendButton,
                sending && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : (
            // When not typing: Show Camera button
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleImagePicker}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Paperclip size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Image Preview Modal */}
      <Modal
        visible={!!imagePreview}
        transparent
        animationType="slide"
        onRequestClose={() => setImagePreview(null)}
      >
        <View style={styles.imagePreviewModal}>
          <View style={styles.imagePreviewContent}>
            <View style={styles.imagePreviewHeader}>
              <Text style={styles.imagePreviewTitle}>Preview Image</Text>
              <TouchableOpacity onPress={() => setImagePreview(null)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            {imagePreview && (
              <Image source={{ uri: imagePreview.uri }} style={styles.imagePreviewImage} />
            )}
            <View style={styles.imagePreviewActions}>
              <TouchableOpacity
                style={[styles.imagePreviewButton, styles.imagePreviewCancelButton]}
                onPress={() => setImagePreview(null)}
              >
                <Text style={styles.imagePreviewCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imagePreviewButton, styles.imagePreviewSendButton]}
                onPress={handleSendWithImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.imagePreviewSendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Image Viewer Modal - For viewing already-sent images */}
      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <View style={styles.imageViewerModal}>
          {/* Close button - positioned with safe area insets */}
          <TouchableOpacity
            style={[styles.imageViewerCloseButton, { top: insets.top + 10 }]}
            onPress={() => setViewingImage(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Full-screen image */}
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <View style={styles.emojiPickerModal}>
          <View style={styles.emojiPickerContent}>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Choose an emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.emojiScrollView}
              contentContainerStyle={styles.emojiGrid}
              showsVerticalScrollIndicator={true}
            >
              {[
                '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
                '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
                '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
                '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
                '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
                '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
                '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '😵‍💫', '🤯',
                '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
                '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧',
                '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
                '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠',
                '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
                '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹',
                '😻', '😼', '😽', '🙀', '😿', '😾', '❤️', '🧡',
                '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
                '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
                '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
                '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
                '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
                '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '💘',
                '💝', '💖', '💗', '💓', '💞', '💕', '❣️', '💔',
                '❤️‍🔥', '❤️‍🩹', '🧡', '💛', '💚', '💙', '💜', '🖤',
                '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨',
                '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
                '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
                '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
                '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
                '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
                '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
              ].map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => handleEmojiSelect(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

// WhatsApp-style colors (customized for app theme)
const WHATSAPP_COLORS = {
  sentBubble: Colors.light.primary, // Blue like app theme
  receivedBubble: '#FFFFFF',
  background: '#ECE5DD',
  sendButton: '#25D366', // Green for send button
  timestamp: 'rgba(0, 0, 0, 0.45)',
  messageTick: '#25D366', // Green for read receipts
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHATSAPP_COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: WHATSAPP_COLORS.background,
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
    color: Colors.light.primary, // Blue like app theme
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
    marginBottom: 4,
    flexDirection: 'row',
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: WHATSAPP_COLORS.receivedBubble,
    borderRadius: 8,
    borderBottomLeftRadius: 0, // Sharp corner on left (received)
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 6,
  },
  messageBubbleMe: {
    backgroundColor: WHATSAPP_COLORS.sentBubble,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0, // Sharp corner on right (sent)
  },
  messageBubbleDeleted: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF', // White text on blue background
  },
  messageTextDeleted: {
    fontStyle: 'italic',
    color: Colors.light.textSecondary,
    fontSize: 14,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    color: WHATSAPP_COLORS.timestamp,
  },
  messageTimeMe: {
    color: WHATSAPP_COLORS.timestamp,
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 8,
    paddingTop: 8,
    // paddingBottom handled by Animated.View for smooth keyboard transitions
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 10,
    fontSize: 16,
    color: Colors.light.text,
    maxHeight: 100,
    minHeight: 40,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHATSAPP_COLORS.sendButton,
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
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  replyBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  replyIndicator: {
    width: 3,
    height: 40,
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },
  replyTextContainer: {
    flex: 1,
  },
  replyName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  replyCancelButton: {
    padding: 4,
  },
  replyQuote: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: WHATSAPP_COLORS.sendButton,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginRight: -4,
    marginLeft: -4,
  },
  replyQuoteMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyQuoteBorder: {
    width: 3,
    backgroundColor: WHATSAPP_COLORS.sendButton,
    marginRight: 8,
    borderRadius: 2,
  },
  replyQuoteContent: {
    flex: 1,
  },
  replyQuoteName: {
    fontSize: 12,
    fontWeight: '600',
    color: WHATSAPP_COLORS.sendButton,
    marginBottom: 2,
  },
  replyQuoteNameMe: {
    color: WHATSAPP_COLORS.sendButton,
  },
  replyQuoteText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  replyQuoteTextMe: {
    color: Colors.light.textSecondary,
  },
  imagePreviewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  imagePreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  imagePreviewImage: {
    width: '100%',
    height: '80%', // Use percentage instead of Dimensions
    resizeMode: 'contain',
  },
  imagePreviewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  imagePreviewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewCancelButton: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  imagePreviewCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  imagePreviewSendButton: {
    backgroundColor: WHATSAPP_COLORS.sendButton,
  },
  imagePreviewSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  attachmentsContainer: {
    marginBottom: 0,
    gap: 0,
    marginHorizontal: -12, // Negative margin to extend to bubble edges
    marginTop: -8, // Adjust to align with bubble top
    overflow: 'hidden',
  },
  imageAttachmentWrapper: {
    position: 'relative',
    width: '100%',
  },
  messageImage: {
    width: 250,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  imageTimestampOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageTimestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  imageTimestampText: {
    fontSize: 11,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Full-screen image viewer styles
  imageViewerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  // Emoji picker styles
  emojiPickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  emojiPickerContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 20,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emojiScrollView: {
    maxHeight: 300,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  emojiButton: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  emojiText: {
    fontSize: 28,
  },
});
