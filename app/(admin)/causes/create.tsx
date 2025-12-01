/**
 * Create Cause Screen
 * Admin form to create new fundraising causes
 * File: app/admin/causes/create.tsx
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ArrowLeft,
  Heart,
  FileText,
  Target,
  Calendar,
  Image as ImageIcon,
  DollarSign,
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  Check,
  ChevronDown,
  AlertCircle,
  Upload,
  X,
  Globe,
  Lock,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { CauseCategory, VisibilityType } from '../../../types';
import { createCause } from '../../../services/causesService';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import WebContainer from '../../../components/WebContainer';
import { decode } from 'base64-arraybuffer';
import { sendNotificationToUser } from '../../../services/pushNotifications';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category options
const CATEGORY_OPTIONS: { value: CauseCategory; label: string; emoji: string }[] = [
  { value: 'disaster_relief', label: 'Disaster Relief', emoji: '🆘' },
  { value: 'education', label: 'Education', emoji: '📚' },
  { value: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { value: 'environment', label: 'Environment', emoji: '🌱' },
  { value: 'community', label: 'Community', emoji: '🏘️' },
  { value: 'poverty', label: 'Poverty Relief', emoji: '💝' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

export default function CreateCauseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isAdmin } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CauseCategory>('community');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [goalAmount, setGoalAmount] = useState('');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDonationsPublic, setIsDonationsPublic] = useState(true);
  const [allowRecurring, setAllowRecurring] = useState(true);
  const [minimumDonation, setMinimumDonation] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function for date conversion
  const dateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get selected category info
  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === category);

  // Handle image picker
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  // Upload image to Supabase Storage
  const uploadImageToStorage = useCallback(async (uri: string): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      setUploadingImage(true);

      // Read file as base64 using fetch + FileReader
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Create unique filename
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `causes/${user.id}/${Date.now()}.${ext}`;

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Determine content type
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Upload to Supabase Storage (using post-images bucket or create a causes bucket)
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, arrayBuffer, {
          contentType: contentType,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  }, [user]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    const goal = parseFloat(goalAmount);
    if (!goalAmount || isNaN(goal) || goal <= 0) {
      newErrors.goalAmount = 'Please enter a valid goal amount';
    }

    if (endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      if (end <= today) {
        newErrors.endDate = 'End date must be in the future';
      }
    }

    if (minimumDonation) {
      const min = parseFloat(minimumDonation);
      if (isNaN(min) || min < 0) {
        newErrors.minimumDonation = 'Please enter a valid minimum amount';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, description, goalAmount, endDate, minimumDonation]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create a cause');
      return;
    }

    setSubmitting(true);

    try {
      // Upload image if one was selected
      let finalImageUrl = imageUrl.trim() || undefined;
      if (imageUri && !imageUrl) {
        const uploadedUrl = await uploadImageToStorage(imageUri);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const response = await createCause({
        title: title.trim(),
        description: description.trim(),
        category,
        goalAmount: parseFloat(goalAmount),
        endDate: endDate ? dateToString(endDate) : undefined,
        imageUrl: finalImageUrl,
        isDonationsPublic,
        allowRecurring,
        minimumDonation: minimumDonation ? parseFloat(minimumDonation) : 0,
        createdBy: user.id,
        visibility,
      });

      if (response.success && response.data) {
        const causeId = response.data.id;
        const causeTitle = response.data.title;

        console.log('✅ Cause created successfully!');
        console.log('📊 Cause ID:', causeId);

        // Create notifications for all users
        console.log('🔔 Starting notification process...');
        
        try {
          // Get all users (except the creator)
          const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select('id')
            .neq('id', user.id);

          if (!usersError && allUsers && allUsers.length > 0) {
            console.log('✅ Found', allUsers.length, 'users to notify');

            // Create notifications for all users
            const notifications = allUsers.map(u => ({
              user_id: u.id,
              type: 'cause',
              title: 'New Fundraising Cause',
              message: `${causeTitle} - Help make a difference!`,
              link: `/causes/${causeId}`,
              related_id: causeId,
              is_read: false,
            }));

            const { error: notifError } = await supabase
              .from('notifications')
              .insert(notifications);

            if (notifError) {
              console.error('❌ Error creating notifications:', notifError);
            } else {
              console.log('✅ Created', notifications.length, 'notifications');

              // Send push notifications to users with causes notifications enabled
              console.log('🔔 Starting push notification process...');
              
              // Get all users with push tokens
              const { data: usersWithTokens, error: tokensError } = await supabase
                .from('users')
                .select('id, push_token')
                .neq('id', user.id)
                .not('push_token', 'is', null);

              console.log('📊 Users with push tokens:', usersWithTokens?.length || 0);

              if (!tokensError && usersWithTokens && usersWithTokens.length > 0) {
                // Get notification settings for these users
                const { data: settingsData, error: settingsError } = await supabase
                  .from('user_notification_settings')
                  .select('user_id, causes_enabled')
                  .in('user_id', usersWithTokens.map(u => u.id));

                if (!settingsError && settingsData) {
                  // Filter users who have causes notifications enabled
                  // Default to enabled if setting doesn't exist
                  const settingsMap = new Map(settingsData.map(s => [s.user_id, s.causes_enabled]));
                  
                  const enabledUsers = usersWithTokens.filter(userObj => {
                    const setting = settingsMap.get(userObj.id);
                    return setting === true || setting === undefined;
                  });

                  console.log('✅ Found', enabledUsers.length, 'users with causes notifications enabled');

                  // Send push notifications
                  for (const userObj of enabledUsers) {
                    try {
                      await sendNotificationToUser(userObj.id, {
                        type: 'cause',
                        id: causeId,
                        title: 'New Fundraising Cause',
                        body: `${causeTitle} - Help make a difference!`,
                      });
                      console.log('✅ Push sent to user:', userObj.id.substring(0, 8) + '...');
                    } catch (pushError) {
                      console.error('❌ Failed to send push to user:', userObj.id, pushError);
                    }
                  }
                  
                  console.log('🎉 Push notification process complete!');
                }
              }
            }
          }
        } catch (notifErr) {
          console.error('❌ Error in notification process:', notifErr);
          // Don't fail the whole operation if notifications fail
        }

        Alert.alert(
          'Success! 🎉',
          `"${causeTitle}" has been created successfully. Volunteers will be notified.`,
          [
            {
              text: 'View Cause',
              onPress: () => router.replace(`/causes/${causeId}`),
            },
            {
              text: 'Create Another',
              onPress: () => {
                // Reset form
                setTitle('');
                setDescription('');
                setCategory('community');
                setGoalAmount('');
                setEndDate(null);
                setImageUri(null);
                setImageUrl('');
                setIsDonationsPublic(true);
                setAllowRecurring(true);
                setMinimumDonation('');
                setIsFeatured(false);
              },
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to create cause');
      }
    } catch (error) {
      console.error('Error creating cause:', error);
      Alert.alert('Error', 'Failed to create cause. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, user, title, description, category, goalAmount, endDate, imageUri, imageUrl, isDonationsPublic, allowRecurring, minimumDonation, isFeatured, visibility, router, uploadImageToStorage]);

  // Access check
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Cause</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            Only administrators can create causes
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Cause</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <WebContainer>
        <ScrollView
          style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: colors.card, borderColor: errors.title ? colors.error : colors.border }
            ]}>
              <Heart size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Give your cause a compelling title"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>
            {errors.title && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.title}</Text>
            )}
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{title.length}/100</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <View style={[
              styles.textAreaContainer, 
              { backgroundColor: colors.card, borderColor: errors.description ? colors.error : colors.border }
            ]}>
              <TextInput
                style={[styles.textArea, { color: colors.text }]}
                placeholder="Describe your cause in detail. Explain what the funds will be used for and how donors can make a difference."
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
              />
            </View>
            {errors.description && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.description}</Text>
            )}
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{description.length}/2000</Text>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.selector, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={[styles.selectorText, { color: colors.text }]}>
                {selectedCategory?.emoji} {selectedCategory?.label}
              </Text>
              <ChevronDown size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showCategoryPicker && (
              <View style={[styles.pickerOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {CATEGORY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.pickerOption,
                      category === option.value && { backgroundColor: colors.background },
                    ]}
                    onPress={() => {
                      setCategory(option.value);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                      {option.emoji} {option.label}
                    </Text>
                    {category === option.value && <Check size={20} color="#38B6FF" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Goal Amount */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Fundraising Goal (JMD) <Text style={styles.required}>*</Text>
            </Text>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: colors.card, borderColor: errors.goalAmount ? colors.error : colors.border }
            ]}>
              <Target size={20} color={colors.textSecondary} />
              <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>J$</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="500,000"
                placeholderTextColor={colors.textSecondary}
                value={goalAmount}
                onChangeText={(text) => setGoalAmount(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>
            {errors.goalAmount && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.goalAmount}</Text>
            )}
          </View>

          {/* End Date */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>End Date (Optional)</Text>
            <TouchableOpacity
              style={[
                styles.inputContainer, 
                { backgroundColor: colors.card, borderColor: errors.endDate ? colors.error : colors.border }
              ]}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Calendar size={20} color={colors.textSecondary} />
              <Text style={[styles.input, { color: colors.text }]}>
                {endDate ? dateToString(endDate) : 'Not set (optional)'}
              </Text>
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setEndDate(selectedDate);
                  } else if (Platform.OS === 'android' && event.type === 'dismissed') {
                    setEndDate(null);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
            {errors.endDate && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.endDate}</Text>
            )}
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Leave empty for ongoing campaigns
            </Text>
          </View>

          {/* Minimum Donation */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Minimum Donation (Optional)</Text>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: colors.card, borderColor: errors.minimumDonation ? colors.error : colors.border }
            ]}>
              <DollarSign size={20} color={colors.textSecondary} />
              <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>J$</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="100"
                placeholderTextColor={colors.textSecondary}
                value={minimumDonation}
                onChangeText={(text) => setMinimumDonation(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>
            {errors.minimumDonation && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.minimumDonation}</Text>
            )}
          </View>

          {/* Image Upload */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Cause Image (Optional)</Text>
            
            {!imageUri && !imageUrl ? (
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <Upload size={24} color={colors.textSecondary} />
                <View style={styles.uploadButtonText}>
                  <Text style={[styles.uploadButtonTitle, { color: colors.text }]}>
                    Upload Image
                  </Text>
                  <Text style={[styles.uploadButtonSubtitle, { color: colors.textSecondary }]}>
                    Tap to select from gallery
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.imagePreviewContainer}>
                <View style={styles.imagePreview}>
                  <Image
                    source={{ uri: imageUri || imageUrl }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setImageUri(null);
                      setImageUrl('');
                    }}
                  >
                    <X size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {uploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
              </View>
            )}
            
            {errors.imageUrl && (
              <Text style={[styles.errorMessage, { color: colors.error }]}>{errors.imageUrl}</Text>
            )}
          </View>

          {/* Toggle Options */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>

            {/* Public Donations */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                {isDonationsPublic ? (
                  <Eye size={20} color="#38B6FF" />
                ) : (
                  <EyeOff size={20} color={colors.textSecondary} />
                )}
                <View style={styles.toggleTextContainer}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Show Donors Publicly</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Display donor names and amounts on the cause page
                  </Text>
                </View>
              </View>
              <Switch
                value={isDonationsPublic}
                onValueChange={setIsDonationsPublic}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Allow Recurring */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <RefreshCw size={20} color={allowRecurring ? '#38B6FF' : colors.textSecondary} />
                <View style={styles.toggleTextContainer}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Allow Recurring Donations</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Let donors set up weekly/monthly giving
                  </Text>
                </View>
              </View>
              <Switch
                value={allowRecurring}
                onValueChange={setAllowRecurring}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Visibility */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                {visibility === 'public' ? (
                  <Globe size={20} color="#4CAF50" />
                ) : (
                  <Lock size={20} color="#FF9800" />
                )}
                <View style={styles.toggleTextContainer}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    {visibility === 'public' ? 'Public' : 'Members Only'}
                  </Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    {visibility === 'public' 
                      ? 'Visible to everyone, including visitors' 
                      : 'Only visible to logged-in members'}
                  </Text>
                </View>
              </View>
              <Switch
                value={visibility === 'members_only'}
                onValueChange={(value) => setVisibility(value ? 'members_only' : 'public')}
                trackColor={{ false: colors.border, true: '#FF9800' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Featured */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <Star size={20} color={isFeatured ? '#FFD700' : colors.textSecondary} />
                <View style={styles.toggleTextContainer}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Featured Cause</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Highlight this cause at the top of the list
                  </Text>
                </View>
              </View>
              <Switch
                value={isFeatured}
                onValueChange={setIsFeatured}
                trackColor={{ false: colors.border, true: '#FFD700' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

        </ScrollView>
        </WebContainer>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: '#38B6FF' }, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Heart size={22} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Create Cause</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#E53935',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
  },
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  textArea: {
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  helperText: {
    fontSize: 13,
    marginTop: 6,
  },
  errorMessage: {
    fontSize: 13,
    marginTop: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: {
    fontSize: 16,
  },
  pickerOptions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 24,
    gap: 16,
  },
  uploadButtonText: {
    flex: 1,
  },
  uploadButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadButtonSubtitle: {
    fontSize: 13,
  },
  imagePreviewContainer: {
    marginTop: 0,
    position: 'relative',
  },
  imagePreview: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    gap: 8,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
