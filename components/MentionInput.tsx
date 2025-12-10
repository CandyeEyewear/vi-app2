/**
 * MentionInput Component
 * A TextInput wrapper that enables @mention functionality
 * Shows friendly @Name while typing, but stores @[Name](userId) format
 */

import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
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
import debounce from 'lodash/debounce';

interface MentionInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

interface SearchUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
  location?: string;
}

interface InsertedMention {
  userId: string;
  fullName: string;
  displayText: string; // @Name
  rawText: string; // @[Name](userId)
}

// Convert raw format to display format
const rawToDisplay = (text: string): string => {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
};

// Check if user is typing a mention
const getTypingMention = (text: string, cursorPosition: number): string | null => {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const match = textBeforeCursor.match(/@(\w*)$/);
  return match ? match[1] : null;
};

const MentionInput = forwardRef<TextInput, MentionInputProps>(({ 
  value,
  onChangeText,
  placeholder = "What's on your mind?",
  ...textInputProps
}, ref) => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user: currentUser } = useAuth();
  
  const inputRef = useRef<TextInput>(null);
  
  // Expose ref to parent
  useImperativeHandle(ref, () => inputRef.current as TextInput);
  
  // The display text (what user sees) - derived from value
  const [displayText, setDisplayText] = useState(() => rawToDisplay(value));
  
  // Track cursor position
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Mention picker state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Track the mapping between display positions and raw format
  // This helps us reconstruct raw text when user types
  const mentionMapRef = useRef<Map<string, InsertedMention>>(new Map());

  // Sync display text when value changes externally
  useEffect(() => {
    const newDisplay = rawToDisplay(value);
    if (newDisplay !== displayText) {
      setDisplayText(newDisplay);
      // Rebuild mention map from value
      rebuildMentionMap(value);
    }
  }, [value]);

  const rebuildMentionMap = (rawText: string) => {
    const map = new Map<string, InsertedMention>();
    const pattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = pattern.exec(rawText)) !== null) {
      const fullName = match[1];
      const userId = match[2];
      const displayText = `@${fullName}`;
      const rawTextPart = match[0];
      
      map.set(displayText, {
        userId,
        fullName,
        displayText,
        rawText: rawTextPart,
      });
    }
    
    mentionMapRef.current = map;
  };

  // Convert display text back to raw format using mention map
  const displayToRaw = (display: string): string => {
    let raw = display;
    
    // Sort by length descending to replace longer names first (avoid partial matches)
    const mentions = Array.from(mentionMapRef.current.values())
      .sort((a, b) => b.displayText.length - a.displayText.length);
    
    for (const mention of mentions) {
      // Only replace if the mention still exists in the text
      if (raw.includes(mention.displayText)) {
        raw = raw.replace(mention.displayText, mention.rawText);
      }
    }
    
    return raw;
  };

  // Debounced user search
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
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
    
    // Convert back to raw format and update parent
    const rawText = displayToRaw(newDisplayText);
    onChangeText(rawText);
  };

  const handleSelectionChange = (event: any) => {
    const position = event.nativeEvent.selection.end;
    setCursorPosition(position);
    
    const typingMention = getTypingMention(displayText, position);
    if (typingMention !== null) {
      setShowMentionPicker(true);
      setMentionSearch(typingMention);
      searchUsers(typingMention);
    } else {
      setShowMentionPicker(false);
    }
  };

  const handleSelectUser = (user: SearchUser) => {
    // Find the @ position
    const textBeforeCursor = displayText.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex === -1) return;
    
    const textBefore = displayText.slice(0, atIndex);
    const textAfter = displayText.slice(cursorPosition);
    
    // Create mention texts
    const displayMention = `@${user.fullName}`;
    const rawMention = `@[${user.fullName}](${user.id})`;
    
    // Store in mention map
    mentionMapRef.current.set(displayMention, {
      userId: user.id,
      fullName: user.fullName,
      displayText: displayMention,
      rawText: rawMention,
    });
    
    // Build new texts
    const newDisplayText = textBefore + displayMention + ' ' + textAfter;
    const newRawText = displayToRaw(newDisplayText);
    
    // Update states
    setDisplayText(newDisplayText);
    onChangeText(newRawText);
    setCursorPosition(textBefore.length + displayMention.length + 1);
    
    setShowMentionPicker(false);
    setMentionSearch('');
    
    inputRef.current?.focus();
  };

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
});

MentionInput.displayName = 'MentionInput';

export default MentionInput;

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