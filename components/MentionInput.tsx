/**
 * MentionInput Component
 * A TextInput wrapper that enables @mention and #hashtag functionality
 * Shows user picker for @ and tabbed picker for # (Events/Causes/Opportunities)
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
import { HashtagItem, HashtagType, getTypingHashtag, insertHashtag } from '../utils/hashtags';
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
  displayText: string;
  rawText: string;
}

interface InsertedHashtag {
  id: string;
  name: string;
  type: HashtagType;
  displayText: string;
  rawText: string;
}

type PickerMode = 'none' | 'mention' | 'hashtag';

// Convert raw format to display format (both mentions and hashtags)
const rawToDisplay = (text: string): string => {
  // Convert mentions: @[Name](userId) -> @Name
  let result = text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  // Convert hashtags: #[Name](type:id) -> #Name
  result = result.replace(/#\[([^\]]+)\]\((event|cause|opportunity):[^)]+\)/g, '#$1');
  return result;
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
  useImperativeHandle(ref, () => inputRef.current as TextInput);
  
  // Display text (what user sees)
  const [displayText, setDisplayText] = useState(() => rawToDisplay(value));
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Picker state
  const [pickerMode, setPickerMode] = useState<PickerMode>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  
  // Mention state
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  
  // Hashtag state
  const [hashtagTab, setHashtagTab] = useState<HashtagType>('event');
  const [eventResults, setEventResults] = useState<HashtagItem[]>([]);
  const [causeResults, setCauseResults] = useState<HashtagItem[]>([]);
  const [opportunityResults, setOpportunityResults] = useState<HashtagItem[]>([]);
  
  // Track mappings for converting display <-> raw
  const mentionMapRef = useRef<Map<string, InsertedMention>>(new Map());
  const hashtagMapRef = useRef<Map<string, InsertedHashtag>>(new Map());

  // Sync display text when value changes externally
  useEffect(() => {
    const newDisplay = rawToDisplay(value);
    if (newDisplay !== displayText) {
      setDisplayText(newDisplay);
      rebuildMaps(value);
    }
  }, [value]);

  const rebuildMaps = (rawText: string) => {
    // Rebuild mention map
    const mentionMap = new Map<string, InsertedMention>();
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = mentionPattern.exec(rawText)) !== null) {
      const fullName = match[1];
      const userId = match[2];
      const displayText = `@${fullName}`;
      mentionMap.set(displayText, {
        userId,
        fullName,
        displayText,
        rawText: match[0],
      });
    }
    mentionMapRef.current = mentionMap;
    
    // Rebuild hashtag map
    const hashtagMap = new Map<string, InsertedHashtag>();
    const hashtagPattern = /#\[([^\]]+)\]\((event|cause|opportunity):([^)]+)\)/g;
    
    while ((match = hashtagPattern.exec(rawText)) !== null) {
      const name = match[1];
      const type = match[2] as HashtagType;
      const id = match[3];
      const displayText = `#${name}`;
      hashtagMap.set(displayText, {
        id,
        name,
        type,
        displayText,
        rawText: match[0],
      });
    }
    hashtagMapRef.current = hashtagMap;
  };

  // Convert display text back to raw format
  const displayToRaw = (display: string): string => {
    let raw = display;
    
    // Replace mentions (sort by length to avoid partial matches)
    const mentions = Array.from(mentionMapRef.current.values())
      .sort((a, b) => b.displayText.length - a.displayText.length);
    for (const mention of mentions) {
      if (raw.includes(mention.displayText)) {
        raw = raw.replace(mention.displayText, mention.rawText);
      }
    }
    
    // Replace hashtags
    const hashtags = Array.from(hashtagMapRef.current.values())
      .sort((a, b) => b.displayText.length - a.displayText.length);
    for (const hashtag of hashtags) {
      if (raw.includes(hashtag.displayText)) {
        raw = raw.replace(hashtag.displayText, hashtag.rawText);
      }
    }
    
    return raw;
  };

  // Search users for mentions
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      try {
        setSearching(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, location')
          .neq('id', currentUser?.id || '')
          .ilike('full_name', `%${query}%`)
          .limit(10);

        if (error) throw error;

        setUserResults((data || []).map((u) => ({
          id: u.id,
          fullName: u.full_name,
          avatarUrl: u.avatar_url,
          location: u.location,
        })));
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

      setUserResults((data || []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatarUrl: u.avatar_url,
        location: u.location,
      })));
    } catch (error) {
      console.error('[MENTION] Error loading suggested users:', error);
    } finally {
      setSearching(false);
    }
  };

  // Search events, causes, opportunities for hashtags
  const searchHashtags = useCallback(
    debounce(async (query: string, type: HashtagType) => {
      try {
        setSearching(true);
        
        if (type === 'event') {
          const { data, error } = await supabase
            .from('events')
            .select('id, title, description, image_url')
            .ilike('title', `%${query}%`)
            .eq('status', 'approved')
            .limit(10);

          if (error) throw error;

          setEventResults((data || []).map((e) => ({
            id: e.id,
            name: e.title,
            type: 'event' as HashtagType,
            description: e.description,
            imageUrl: e.image_url,
          })));
        } else if (type === 'cause') {
          const { data, error } = await supabase
            .from('causes')
            .select('id, title, description, image_url')
            .ilike('title', `%${query}%`)
            .eq('status', 'approved')
            .limit(10);

          if (error) throw error;

          setCauseResults((data || []).map((c) => ({
            id: c.id,
            name: c.title,
            type: 'cause' as HashtagType,
            description: c.description,
            imageUrl: c.image_url,
          })));
        } else if (type === 'opportunity') {
          const { data, error } = await supabase
            .from('opportunities')
            .select('id, title, description, image_url')
            .ilike('title', `%${query}%`)
            .eq('status', 'approved')
            .limit(10);

          if (error) throw error;

          setOpportunityResults((data || []).map((o) => ({
            id: o.id,
            name: o.title,
            type: 'opportunity' as HashtagType,
            description: o.description,
            imageUrl: o.image_url,
          })));
        }
      } catch (error) {
        console.error('[HASHTAG] Error searching:', error);
      } finally {
        setSearching(false);
      }
    }, 200),
    []
  );

  const loadSuggestedHashtags = async (type: HashtagType) => {
    try {
      setSearching(true);
      
      if (type === 'event') {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, description, image_url')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        setEventResults((data || []).map((e) => ({
          id: e.id,
          name: e.title,
          type: 'event' as HashtagType,
          description: e.description,
          imageUrl: e.image_url,
        })));
      } else if (type === 'cause') {
        const { data, error } = await supabase
          .from('causes')
          .select('id, title, description, image_url')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        setCauseResults((data || []).map((c) => ({
          id: c.id,
          name: c.title,
          type: 'cause' as HashtagType,
          description: c.description,
          imageUrl: c.image_url,
        })));
      } else if (type === 'opportunity') {
        const { data, error } = await supabase
          .from('opportunities')
          .select('id, title, description, image_url')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        setOpportunityResults((data || []).map((o) => ({
          id: o.id,
          name: o.title,
          type: 'opportunity' as HashtagType,
          description: o.description,
          imageUrl: o.image_url,
        })));
      }
    } catch (error) {
      console.error('[HASHTAG] Error loading suggested:', error);
    } finally {
      setSearching(false);
    }
  };

  // Handle text changes
  const handleTextChange = (newDisplayText: string) => {
    setDisplayText(newDisplayText);
    
    const newCursorPos = cursorPosition + (newDisplayText.length - displayText.length);
    
    // Check for @ mention
    const typingMention = getTypingMention(newDisplayText, newCursorPos);
    if (typingMention !== null) {
      setPickerMode('mention');
      setSearchQuery(typingMention);
      if (typingMention.length > 0) {
        searchUsers(typingMention);
      } else {
        loadSuggestedUsers();
      }
      onChangeText(displayToRaw(newDisplayText));
      return;
    }
    
    // Check for # hashtag
    const typingHashtag = getTypingHashtag(newDisplayText, newCursorPos);
    if (typingHashtag !== null) {
      setPickerMode('hashtag');
      setSearchQuery(typingHashtag);
      if (typingHashtag.length > 0) {
        searchHashtags(typingHashtag, hashtagTab);
      } else {
        loadSuggestedHashtags(hashtagTab);
      }
      onChangeText(displayToRaw(newDisplayText));
      return;
    }
    
    // No special character being typed
    setPickerMode('none');
    setSearchQuery('');
    onChangeText(displayToRaw(newDisplayText));
  };

  const handleSelectionChange = (event: any) => {
    const position = event.nativeEvent.selection.end;
    setCursorPosition(position);
    
    // Check for mention
    const typingMention = getTypingMention(displayText, position);
    if (typingMention !== null) {
      setPickerMode('mention');
      setSearchQuery(typingMention);
      if (typingMention.length > 0) {
        searchUsers(typingMention);
      } else {
        loadSuggestedUsers();
      }
      return;
    }
    
    // Check for hashtag
    const typingHashtag = getTypingHashtag(displayText, position);
    if (typingHashtag !== null) {
      setPickerMode('hashtag');
      setSearchQuery(typingHashtag);
      if (typingHashtag.length > 0) {
        searchHashtags(typingHashtag, hashtagTab);
      } else {
        loadSuggestedHashtags(hashtagTab);
      }
      return;
    }
    
    setPickerMode('none');
  };

  // Handle user selection (mention)
  const handleSelectUser = (user: SearchUser) => {
    const textBeforeCursor = displayText.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex === -1) return;
    
    const textBefore = displayText.slice(0, atIndex);
    const textAfter = displayText.slice(cursorPosition);
    
    const displayMention = `@${user.fullName}`;
    const rawMention = `@[${user.fullName}](${user.id})`;
    
    mentionMapRef.current.set(displayMention, {
      userId: user.id,
      fullName: user.fullName,
      displayText: displayMention,
      rawText: rawMention,
    });
    
    const newDisplayText = textBefore + displayMention + ' ' + textAfter;
    const newRawText = displayToRaw(newDisplayText);
    
    setDisplayText(newDisplayText);
    onChangeText(newRawText);
    setCursorPosition(textBefore.length + displayMention.length + 1);
    
    setPickerMode('none');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  // Handle hashtag selection
  const handleSelectHashtag = (item: HashtagItem) => {
    const textBeforeCursor = displayText.slice(0, cursorPosition);
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    
    if (hashIndex === -1) return;
    
    const textBefore = displayText.slice(0, hashIndex);
    const textAfter = displayText.slice(cursorPosition);
    
    const displayHashtag = `#${item.name}`;
    const rawHashtag = `#[${item.name}](${item.type}:${item.id})`;
    
    hashtagMapRef.current.set(displayHashtag, {
      id: item.id,
      name: item.name,
      type: item.type,
      displayText: displayHashtag,
      rawText: rawHashtag,
    });
    
    const newDisplayText = textBefore + displayHashtag + ' ' + textAfter;
    const newRawText = displayToRaw(newDisplayText);
    
    setDisplayText(newDisplayText);
    onChangeText(newRawText);
    setCursorPosition(textBefore.length + displayHashtag.length + 1);
    
    setPickerMode('none');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  // Handle tab change for hashtags
  const handleTabChange = (tab: HashtagType) => {
    setHashtagTab(tab);
    if (searchQuery.length > 0) {
      searchHashtags(searchQuery, tab);
    } else {
      loadSuggestedHashtags(tab);
    }
  };

  useEffect(() => {
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setPickerMode('none');
    });
    return () => hideSubscription.remove();
  }, []);

  // Get current hashtag results based on tab
  const getCurrentHashtagResults = () => {
    switch (hashtagTab) {
      case 'event': return eventResults;
      case 'cause': return causeResults;
      case 'opportunity': return opportunityResults;
      default: return [];
    }
  };

  const renderUserItem = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={[styles.pickerItem, { borderBottomColor: colors.border }]}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.itemAvatar} />
      ) : (
        <View style={[styles.itemAvatar, styles.itemAvatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.itemAvatarText}>{item.fullName?.charAt(0).toUpperCase() || '?'}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]}>{item.fullName}</Text>
        {item.location && (
          <Text style={[styles.itemSubtext, { color: colors.textSecondary }]}>📍 {item.location}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHashtagItem = ({ item }: { item: HashtagItem }) => (
    <TouchableOpacity
      style={[styles.pickerItem, { borderBottomColor: colors.border }]}
      onPress={() => handleSelectHashtag(item)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemAvatar} />
      ) : (
        <View style={[styles.itemAvatar, styles.itemAvatarPlaceholder, { backgroundColor: getHashtagColor(item.type) }]}>
          <Text style={styles.itemAvatarText}>{getHashtagIcon(item.type)}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        {item.description && (
          <Text style={[styles.itemSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const getHashtagColor = (type: HashtagType) => {
    switch (type) {
      case 'event': return '#4CAF50';
      case 'cause': return '#E91E63';
      case 'opportunity': return '#2196F3';
      default: return colors.primary;
    }
  };

  const getHashtagIcon = (type: HashtagType) => {
    switch (type) {
      case 'event': return '📅';
      case 'cause': return '❤️';
      case 'opportunity': return '🤝';
      default: return '#';
    }
  };

  return (
    <View style={styles.container}>
      {/* Mention Picker */}
      {pickerMode === 'mention' && (
        <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerHeaderText, { color: colors.textSecondary }]}>
              {searchQuery ? `Searching "${searchQuery}"...` : 'Mention someone'}
            </Text>
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          
          {userResults.length > 0 ? (
            <FlatList
              data={userResults}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
            />
          ) : !searching ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No users found' : 'Type a name to search'}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Hashtag Picker */}
      {pickerMode === 'hashtag' && (
        <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Tabs */}
          <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, hashtagTab === 'event' && { borderBottomColor: '#4CAF50', borderBottomWidth: 2 }]}
              onPress={() => handleTabChange('event')}
            >
              <Text style={[styles.tabText, { color: hashtagTab === 'event' ? '#4CAF50' : colors.textSecondary }]}> 
                📅 Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, hashtagTab === 'cause' && { borderBottomColor: '#E91E63', borderBottomWidth: 2 }]}
              onPress={() => handleTabChange('cause')}
            >
              <Text style={[styles.tabText, { color: hashtagTab === 'cause' ? '#E91E63' : colors.textSecondary }]}> 
                ❤️ Causes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, hashtagTab === 'opportunity' && { borderBottomColor: '#2196F3', borderBottomWidth: 2 }]}
              onPress={() => handleTabChange('opportunity')}
            >
              <Text style={[styles.tabText, { color: hashtagTab === 'opportunity' ? '#2196F3' : colors.textSecondary }]}> 
                🤝 Opps
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Search hint */}
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerHeaderText, { color: colors.textSecondary }]}>
              {searchQuery ? `Searching "${searchQuery}"...` : `Select a ${hashtagTab}`}
            </Text>
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          
          {getCurrentHashtagResults().length > 0 ? (
            <FlatList
              data={getCurrentHashtagResults()}
              keyExtractor={(item) => item.id}
              renderItem={renderHashtagItem}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
            />
          ) : !searching ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? `No ${hashtagTab}s found` : `No ${hashtagTab}s available`}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Text Input */}
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }, textInputProps.style]}
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
  picker: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 300,
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  pickerHeaderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pickerList: {
    maxHeight: 180,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
  },
  itemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  itemAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  itemInfo: {
    marginLeft: 10,
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
