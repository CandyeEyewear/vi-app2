/**
 * MentionInput Component
 * A TextInput wrapper that enables @mention functionality
 * Shows a user picker when @ is typed
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  useColorScheme,
  Keyboard,
  TextInputProps,
} from 'react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getTypingMention, insertMention, MentionUser, mentionToDisplayText } from '../utils/mentions';
import debounce from 'lodash/debounce';

interface MentionInputProps extends Omit<TextInputProps, 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput>;
}

interface SearchUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
  location?: string;
}

export default function MentionInput({
  value,
  onChangeText,
  placeholder = "What's on your mind?",
  inputRef: externalRef,
  ...textInputProps
}: MentionInputProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user: currentUser } = useAuth();

  const internalRef = useRef<TextInput>(null);
  const inputRef = externalRef || internalRef;

  // Mention picker state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [displayText, setDisplayText] = useState(mentionToDisplayText(value));

  useEffect(() => {
    // Only update display text if value changed externally (not from our own edits)
    const newDisplayText = mentionToDisplayText(value);
    if (newDisplayText !== displayText && !showMentionPicker) {
      setDisplayText(newDisplayText);
    }
  }, [value, displayText, showMentionPicker]);

  // Debounced user search
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        // Show recent/suggested users when @ is typed with no query
        loadSuggestedUsers();
        return;
      }

      try {
        setSearching(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, location')
          .neq('id', currentUser?.id || '')
          .ilike('full_name', `%${query}%`)
          .limit(10);

        if (error) throw error;

        const users: SearchUser[] = (data || []).map((u) => ({
          id: u.id,
          fullName: u.full_name,
          avatarUrl: u.avatar_url,
          location: u.location,
        }));

        setSearchResults(users);
      } catch (error) {
        console.error('[MENTION] Error searching users:', error);
      } finally {
        setSearching(false);
      }
    }, 200),
    [currentUser?.id]
  );

  const loadSuggestedUsers = async () => {
    try {
      setSearching(true);
      // Load users the current user has interacted with recently
      // For now, just load some active users
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, location')
        .neq('id', currentUser?.id || '')
        .limit(8)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const users: SearchUser[] = (data || []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatarUrl: u.avatar_url,
        location: u.location,
      }));

      setSearchResults(users);
    } catch (error) {
      console.error('[MENTION] Error loading suggested users:', error);
    } finally {
      setSearching(false);
    }
  };

  // Handle text change and detect @ mentions
  const handleTextChange = (newDisplayText: string) => {
    setDisplayText(newDisplayText);
    
    // Check if user is typing a mention
    const typingMention = getTypingMention(newDisplayText, cursorPosition + (newDisplayText.length - displayText.length));

    if (typingMention !== null) {
      setShowMentionPicker(true);
      setMentionSearch(typingMention);
      searchUsers(typingMention);
    } else {
      setShowMentionPicker(false);
      setMentionSearch('');
    }
    
    // For simple text changes (no mentions being edited), sync to parent
    // We'll rebuild the raw format when mentions are inserted
    onChangeText(newDisplayText);
  };

  // Handle cursor position changes
  const handleSelectionChange = (event: any) => {
    const position = event.nativeEvent.selection.end;
    setCursorPosition(position);

    // Check for mention in display text
    const typingMention = getTypingMention(displayText, position);
    if (typingMention !== null) {
      setShowMentionPicker(true);
      setMentionSearch(typingMention);
      searchUsers(typingMention);
    } else {
      setShowMentionPicker(false);
    }
  };

  // Handle user selection from picker
  const handleSelectUser = (user: SearchUser) => {
    const mentionUser: MentionUser = {
      id: user.id,
      fullName: user.fullName,
    };

    // Insert raw format into the actual value (for data extraction)
    const { newText: newRawText, newCursorPosition } = insertMention(value, cursorPosition, mentionUser);
    
    // Calculate the display version
    const newDisplayTextValue = mentionToDisplayText(newRawText);
    
    // Update both
    setDisplayText(newDisplayTextValue);
    onChangeText(newRawText);
    
    // Calculate new cursor position for display text
    // The display text is shorter, so we need to adjust
    const rawMentionLength = `@[${user.fullName}](${user.id}) `.length;
    const displayMentionLength = `@${user.fullName} `.length;
    const adjustedCursor = newCursorPosition - (rawMentionLength - displayMentionLength);
    
    setCursorPosition(adjustedCursor);
    setShowMentionPicker(false);
    setMentionSearch('');

    // Keep keyboard open and focus
    inputRef.current?.focus();
  };

  // Close picker when keyboard hides
  useEffect(() => {
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setShowMentionPicker(false);
    });

    return () => {
      hideSubscription.remove();
    };
  }, []);

  const renderUserItem = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.userAvatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.userAvatarText}>
            {item.fullName?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>{item.fullName}</Text>
        {item.location && (
          <Text style={[styles.userLocation, { color: colors.textSecondary }]}>
            📍 {item.location}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Mention Picker Dropdown */}
      {showMentionPicker && (
        <View style={[styles.mentionPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.mentionHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.mentionHeaderText, { color: colors.textSecondary }]}>
              {mentionSearch ? `Searching "${mentionSearch}"...` : 'Mention someone'}
            </Text>
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              keyboardShouldPersistTaps="handled"
              style={styles.userList}
              showsVerticalScrollIndicator={false}
            />
          ) : !searching ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {mentionSearch ? 'No users found' : 'Type a name to search'}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Text Input */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          { color: colors.text },
          textInputProps.style,
        ]}
        value={displayText}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
        {...textInputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  mentionPicker: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 250,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  mentionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  mentionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  userList: {
    maxHeight: 200,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
