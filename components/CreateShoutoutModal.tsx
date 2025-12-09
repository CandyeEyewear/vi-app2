/**
 * CreateShoutoutModal Component
 * Modal for creating shoutout posts to recognize volunteers
 * Includes volunteer search, category selection, and message input
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  ActivityIndicator,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, ChevronRight, Calendar, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useFeed } from '../contexts/FeedContext';
import { useAuth } from '../contexts/AuthContext';
import { User, ShoutoutCategory, ShoutoutCategoryId } from '../types';
import debounce from 'lodash/debounce';

interface CreateShoutoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RecentEvent {
  id: string;
  title: string;
  eventDate: string;
}

// Fallback categories (in case DB fetch fails)
const DEFAULT_CATEGORIES: ShoutoutCategory[] = [
  { id: 'team_player', label: 'Team Player', icon: '🤝', color: '#3B82F6', gradientStart: '#3B82F6', gradientEnd: '#2563EB' },
  { id: 'above_and_beyond', label: 'Above & Beyond', icon: '🚀', color: '#A855F7', gradientStart: '#A855F7', gradientEnd: '#7C3AED' },
  { id: 'heart_of_gold', label: 'Heart of Gold', icon: '💛', color: '#F59E0B', gradientStart: '#F59E0B', gradientEnd: '#D97706' },
  { id: 'problem_solver', label: 'Problem Solver', icon: '🧠', color: '#22C55E', gradientStart: '#22C55E', gradientEnd: '#16A34A' },
  { id: 'first_timer_star', label: 'First Timer Star', icon: '⭐', color: '#EC4899', gradientStart: '#EC4899', gradientEnd: '#DB2777' },
  { id: 'inspiring_leader', label: 'Inspiring Leader', icon: '👑', color: '#F97316', gradientStart: '#F97316', gradientEnd: '#EA580C' },
];

type Step = 'select-user' | 'select-category' | 'write-message';

export default function CreateShoutoutModal({ visible, onClose, onSuccess }: CreateShoutoutModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { createShoutout } = useFeed();
  const { user: currentUser } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('select-user');

  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Category state
  const [categories, setCategories] = useState<ShoutoutCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<ShoutoutCategory | null>(null);

  // Message state
  const [message, setMessage] = useState('');

  // Event linking state
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RecentEvent | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Load categories from database
  useEffect(() => {
    if (visible) {
      loadCategories();
      loadRecentEvents();
    }
  }, [visible]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentStep('select-user');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setSelectedCategory(null);
      setMessage('');
      setSelectedEvent(null);
      setShowEventPicker(false);
    }
  }, [visible]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('shoutout_categories')
        .select('*')
        .order('id');

      if (error) throw error;

      if (data && data.length > 0) {
        const transformed: ShoutoutCategory[] = data.map((cat) => ({
          id: cat.id as ShoutoutCategoryId,
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          gradientStart: cat.gradient_start,
          gradientEnd: cat.gradient_end,
        }));
        setCategories(transformed);
      }
    } catch (error) {
      console.error('[SHOUTOUT] Error loading categories:', error);
      // Keep default categories as fallback
    }
  };

  const loadRecentEvents = async () => {
    if (!currentUser?.id) return;

    try {
      // Get events the user has attended recently (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date')
        .gte('event_date', thirtyDaysAgo.toISOString().split('T')[0])
        .lte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        setRecentEvents(data.map((e) => ({
          id: e.id,
          title: e.title,
          eventDate: e.event_date,
        })));
      }
    } catch (error) {
      console.error('[SHOUTOUT] Error loading recent events:', error);
    }
  };

  // Debounced search function
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      try {
        setSearching(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, location, email')
          .neq('id', currentUser?.id || '') // Exclude current user
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(20);

        if (error) throw error;

        const users: User[] = (data || []).map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          avatarUrl: u.avatar_url,
          location: u.location,
        } as User));

        setSearchResults(users);
      } catch (error) {
        console.error('[SHOUTOUT] Error searching users:', error);
      } finally {
        setSearching(false);
      }
    }, 300),
    [currentUser?.id]
  );

  useEffect(() => {
    searchUsers(searchQuery);
  }, [searchQuery, searchUsers]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setCurrentStep('select-category');
  };

  const handleSelectCategory = (category: ShoutoutCategory) => {
    setSelectedCategory(category);
    setCurrentStep('write-message');
  };

  const handleSubmit = async () => {
    if (!selectedUser || !selectedCategory || !message.trim()) return;

    try {
      setSubmitting(true);
      const result = await createShoutout(
        selectedUser.id,
        selectedCategory.id,
        message.trim(),
        selectedEvent?.id,
        'public'
      );

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        console.error('[SHOUTOUT] Error:', result.error);
        // You could show an alert here
      }
    } catch (error) {
      console.error('[SHOUTOUT] Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'select-category') {
      setCurrentStep('select-user');
      setSelectedCategory(null);
    } else if (currentStep === 'write-message') {
      setCurrentStep('select-category');
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, currentStep === 'select-user' && styles.stepDotActive, { backgroundColor: currentStep === 'select-user' ? colors.primary : colors.border }]} />
      <View style={[styles.stepLine, { backgroundColor: currentStep !== 'select-user' ? colors.primary : colors.border }]} />
      <View style={[styles.stepDot, currentStep === 'select-category' && styles.stepDotActive, { backgroundColor: currentStep === 'select-category' ? colors.primary : currentStep === 'write-message' ? colors.primary : colors.border }]} />
      <View style={[styles.stepLine, { backgroundColor: currentStep === 'write-message' ? colors.primary : colors.border }]} />
      <View style={[styles.stepDot, currentStep === 'write-message' && styles.stepDotActive, { backgroundColor: currentStep === 'write-message' ? colors.primary : colors.border }]} />
    </View>
  );

  const renderUserSearch = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Who do you want to recognize?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Search for a volunteer who made a difference
      </Text>

      <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search volunteers..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.userRow, { borderColor: colors.border }]}
            onPress={() => handleSelectUser(item)}
            activeOpacity={0.7}
          >
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.userAvatarText}>{item.fullName?.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{item.fullName}</Text>
              {item.location && (
                <Text style={[styles.userLocation, { color: colors.textSecondary }]}>📍 {item.location}</Text>
              )}
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          searchQuery.length >= 2 && !searching ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No volunteers found</Text>
          ) : searchQuery.length < 2 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Type at least 2 characters to search</Text>
          ) : null
        }
        style={styles.userList}
        contentContainerStyle={styles.userListContent}
      />
    </View>
  );

  const renderCategorySelection = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Why are you recognizing them?</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Choose the category that best describes their contribution
      </Text>

      <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { borderColor: colors.border }]}
            onPress={() => handleSelectCategory(category)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[category.gradientStart, category.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.categoryIconContainer}
            >
              <Text style={styles.categoryEmoji}>{category.icon}</Text>
            </LinearGradient>
            <View style={styles.categoryInfo}>
              <Text style={[styles.categoryLabel, { color: colors.text }]}>{category.label}</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderMessageInput = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Write your recognition</Text>

      {/* Selected user preview */}
      {selectedUser && (
        <View style={[styles.selectedPreview, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {selectedUser.avatarUrl ? (
            <Image source={{ uri: selectedUser.avatarUrl }} style={styles.previewAvatar} />
          ) : (
            <View style={[styles.previewAvatar, styles.userAvatarPlaceholder, { backgroundColor: selectedCategory?.color || colors.primary }]}>
              <Text style={styles.previewAvatarText}>{selectedUser.fullName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.previewInfo}>
            <Text style={[styles.previewName, { color: colors.text }]}>{selectedUser.fullName}</Text>
            <View style={[styles.previewBadge, { backgroundColor: (selectedCategory?.color || colors.primary) + '20' }]}>
              <Text style={{ fontSize: 12 }}>{selectedCategory?.icon}</Text>
              <Text style={[styles.previewBadgeText, { color: selectedCategory?.color || colors.primary }]}>
                {selectedCategory?.label}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Message input */}
      <TextInput
        style={[styles.messageInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
        placeholder="What did they do that stood out? Share why they deserve this recognition..."
        placeholderTextColor={colors.textSecondary}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={500}
      />
      <Text style={[styles.charCount, { color: colors.textTertiary }]}>{message.length}/500</Text>

      {/* Event linking (optional) */}
      {recentEvents.length > 0 && (
        <View style={styles.eventSection}>
          <Text style={[styles.eventSectionTitle, { color: colors.text }]}>Link to an event (optional)</Text>
          
          {selectedEvent ? (
            <TouchableOpacity
              style={[styles.selectedEventCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
              onPress={() => setSelectedEvent(null)}
            >
              <Calendar size={16} color={colors.primary} />
              <Text style={[styles.selectedEventText, { color: colors.primary }]}>{selectedEvent.title}</Text>
              <X size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.addEventButton, { borderColor: colors.border }]}
              onPress={() => setShowEventPicker(true)}
            >
              <Calendar size={18} color={colors.textSecondary} />
              <Text style={[styles.addEventText, { color: colors.textSecondary }]}>Add event</Text>
            </TouchableOpacity>
          )}

          {/* Event picker modal */}
          <Modal visible={showEventPicker} transparent animationType="fade">
            <View style={styles.eventPickerOverlay}>
              <View style={[styles.eventPickerContent, { backgroundColor: colors.card }]}>
                <Text style={[styles.eventPickerTitle, { color: colors.text }]}>Select an event</Text>
                {recentEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventPickerItem, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectedEvent(event);
                      setShowEventPicker(false);
                    }}
                  >
                    <Text style={[styles.eventPickerItemText, { color: colors.text }]}>{event.title}</Text>
                    <Text style={[styles.eventPickerItemDate, { color: colors.textSecondary }]}>
                      {new Date(event.eventDate).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.eventPickerCancel, { backgroundColor: colors.surface }]}
                  onPress={() => setShowEventPicker(false)}
                >
                  <Text style={[styles.eventPickerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* Submit button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: selectedCategory?.color || colors.primary },
          (!message.trim() || submitting) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!message.trim() || submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.submitButtonText}>🌟 Give Shoutout</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={currentStep === 'select-user' ? onClose : handleBack} style={styles.headerButton}>
            {currentStep === 'select-user' ? (
              <X size={24} color={colors.text} />
            ) : (
              <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Give a Shoutout</Text>
          <View style={styles.headerButton} />
        </View>

        {renderStepIndicator()}

        {/* Step Content */}
        {currentStep === 'select-user' && renderUserSearch()}
        {currentStep === 'select-category' && renderCategorySelection()}
        {currentStep === 'write-message' && renderMessageInput()}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 40,
    height: 2,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  userList: {
    flex: 1,
  },
  userListContent: {
    paddingBottom: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  categoryList: {
    flex: 1,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  categoryLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  selectedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  previewAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  previewInfo: {
    marginLeft: 12,
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 8,
    fontSize: 12,
  },
  eventSection: {
    marginTop: 20,
  },
  eventSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  addEventText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  selectedEventText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  eventPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  eventPickerContent: {
    width: '100%',
    maxHeight: '60%',
    borderRadius: 16,
    padding: 16,
  },
  eventPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  eventPickerItem: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  eventPickerItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventPickerItemDate: {
    fontSize: 13,
    marginTop: 4,
  },
  eventPickerCancel: {
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  eventPickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
