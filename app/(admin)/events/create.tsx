/**
 * Create Event Screen
 * Admin form to create new events
 * File: app/admin/events/create.tsx
 */

import React, { useState, useCallback, useRef } from 'react';
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
import { geocodeLocation, GeocodeResult } from '../../../services/geocoding';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  DollarSign,
  Image as ImageIcon,
  FileText,
  Phone,
  Mail,
  User,
  ChevronDown,
  Check,
  Link,
  Upload,
  X,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { EventCategory } from '../../../types';
import { createEvent } from '../../../services/eventsService';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import WebContainer from '../../../components/WebContainer';
import { decode } from 'base64-arraybuffer';
import { sendNotificationToUser } from '../../../services/pushNotifications';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category options
const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: 'meetup', label: 'Meetup' },
  { value: 'gala', label: 'Gala' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'networking', label: 'Networking' },
  { value: 'other', label: 'Other' },
];

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('meetup');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Location
  const [isVirtual, setIsVirtual] = useState(false);
  const [location, setLocation] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [geocodingLocation, setGeocodingLocation] = useState<GeocodeResult | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Date & Time
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // Helper functions for time conversion
  const timeStringToDate = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 9, minutes || 0, 0, 0);
    return date;
  };
  
  const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  const dateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Capacity
  const [hasCapacity, setHasCapacity] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [registrationRequired, setRegistrationRequired] = useState(true);
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | null>(null);
  const [showRegistrationDeadlinePicker, setShowRegistrationDeadlinePicker] = useState(false);
  
  // Pricing
  const [isFree, setIsFree] = useState(true);
  const [ticketPrice, setTicketPrice] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  
  // Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  // UI state
  const [submitting, setSubmitting] = useState(false);

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
      const fileName = `events/${user.id}/${Date.now()}.${ext}`;

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Determine content type
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  }, [user?.id]);

  // Handle location geocoding
  const handleLocationGeocode = useCallback(async (locationText: string) => {
    if (!locationText.trim() || isVirtual) return;
    
    setIsGeocodingLocation(true);
    try {
      const result = await geocodeLocation(locationText);
      setGeocodingLocation(result);
      if (result.success && result.latitude && result.longitude) {
        setLatitude(result.latitude);
        setLongitude(result.longitude);
        if (result.formattedAddress) {
          setLocationAddress(result.formattedAddress);
        }
        // Auto-populate mapLink with Google Maps URL
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`;
        setMapLink(googleMapsUrl);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocodingLocation(false);
    }
  }, [isVirtual]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event title');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description');
      return false;
    }
    if (!isVirtual && !location.trim()) {
      Alert.alert('Required', 'Please enter a location');
      return false;
    }
    if (isVirtual && !virtualLink.trim()) {
      Alert.alert('Required', 'Please enter a virtual meeting link');
      return false;
    }
    if (!eventDate) {
      Alert.alert('Required', 'Please enter the event date');
      return false;
    }
    if (!startTime) {
      Alert.alert('Required', 'Please enter the start time');
      return false;
    }
    if (hasCapacity && (!capacity || parseInt(capacity) <= 0)) {
      Alert.alert('Invalid', 'Please enter a valid capacity');
      return false;
    }
    if (!isFree && (!ticketPrice || parseFloat(ticketPrice) <= 0)) {
      Alert.alert('Invalid', 'Please enter a valid ticket price');
      return false;
    }
    if (!isFree && !paymentLink.trim()) {
      Alert.alert('Required', 'Please enter a payment link for paid events');
      return false;
    }
    return true;
  }, [title, description, isVirtual, location, virtualLink, eventDate, startTime, hasCapacity, capacity, isFree, ticketPrice, paymentLink]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !user) return;

    setSubmitting(true);

    try {
      // Upload image if a new one was selected
      let finalImageUrl = imageUrl;
      if (imageUri && !imageUrl) {
        const uploadedUrl = await uploadImageToStorage(imageUri);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          setSubmitting(false);
          return;
        }
      }

      const response = await createEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrl: finalImageUrl || undefined,
        location: isVirtual ? 'Virtual Event' : location.trim(),
        locationAddress: locationAddress.trim() || undefined,
        mapLink: mapLink.trim() || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        isVirtual,
        virtualLink: virtualLink.trim() || undefined,
        eventDate: dateToString(eventDate),
        startTime: dateToTimeString(startTime),
        endTime: endTime ? dateToTimeString(endTime) : undefined,
        capacity: hasCapacity ? parseInt(capacity) : undefined,
        registrationRequired,
        registrationDeadline: registrationDeadline ? dateToString(registrationDeadline) : undefined,
        isFree,
        ticketPrice: !isFree ? parseFloat(ticketPrice) : undefined,
        paymentLink: !isFree ? paymentLink.trim() || undefined : undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        createdBy: user.id,
      });

      if (response.success && response.data) {
        const eventId = response.data.id;
        const eventTitle = response.data.title;

        console.log('✅ Event created successfully!');
        console.log('📊 Event ID:', eventId);

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
              type: 'event',
              title: 'New Event',
              message: `${eventTitle} - Join us!`,
              link: `/events/${eventId}`,
              related_id: eventId,
              is_read: false,
            }));

            const { error: notifError } = await supabase
              .from('notifications')
              .insert(notifications);

            if (notifError) {
              console.error('❌ Error creating notifications:', notifError);
            } else {
              console.log('✅ Created', notifications.length, 'notifications');

              // Send push notifications to users with events notifications enabled
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
                  .select('user_id, events_enabled')
                  .in('user_id', usersWithTokens.map(u => u.id));

                if (!settingsError && settingsData) {
                  // Filter users who have events notifications enabled
                  // Default to enabled if setting doesn't exist
                  const settingsMap = new Map(settingsData.map(s => [s.user_id, s.events_enabled]));
                  
                  const enabledUsers = usersWithTokens.filter(userObj => {
                    const setting = settingsMap.get(userObj.id);
                    return setting === true || setting === undefined;
                  });

                  console.log('✅ Found', enabledUsers.length, 'users with events notifications enabled');

                  // Send push notifications
                  for (const userObj of enabledUsers) {
                    try {
                      await sendNotificationToUser(userObj.id, {
                        type: 'event',
                        id: eventId,
                        title: 'New Event',
                        body: `${eventTitle} - Join us!`,
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
          'Event Created! 🎉',
          `"${eventTitle}" has been created successfully. Volunteers will be notified.`,
          [
            { text: 'View Event', onPress: () => router.replace(`/events/${eventId}`) },
            { text: 'Done', onPress: () => router.back() },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Create event error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, user, title, description, category, imageUri, imageUrl, isVirtual, location, locationAddress, mapLink, latitude, longitude, virtualLink, eventDate, startTime, endTime, hasCapacity, capacity, registrationRequired, registrationDeadline, isFree, ticketPrice, paymentLink, contactName, contactEmail, contactPhone, router, uploadImageToStorage, dateToString, dateToTimeString]);

  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === category);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Event</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <WebContainer>
        <ScrollView
          style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>

            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Event Title *</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <FileText size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter event title"
                  placeholderTextColor={colors.textSecondary}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Category *</Text>
              <TouchableOpacity
                style={[styles.selectContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {selectedCategory?.label}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showCategoryPicker && (
                <View style={[styles.pickerOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.pickerOption, category === option.value && { backgroundColor: colors.background }]}
                      onPress={() => {
                        setCategory(option.value);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                        {option.label}
                      </Text>
                      {category === option.value && <Check size={18} color="#38B6FF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description *</Text>
              <View style={[styles.textAreaContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textArea, { color: colors.text }]}
                  placeholder="Describe your event..."
                  placeholderTextColor={colors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {description.length}/1000
              </Text>
            </View>

            {/* Image Upload */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Cover Image</Text>
              {!imageUri && !imageUrl ? (
                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#38B6FF" />
                  ) : (
                    <>
                      <Upload size={20} color="#38B6FF" />
                      <Text style={[styles.uploadButtonText, { color: '#38B6FF' }]}>Upload Image</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.imagePreviewContainer, { borderColor: colors.border }]}>
                  <Image
                    source={{ uri: imageUri || imageUrl }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setImageUri(null);
                      setImageUrl('');
                    }}
                  >
                    <X size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  {!imageUrl && (
                    <TouchableOpacity
                      style={[styles.changeImageButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={handlePickImage}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color="#38B6FF" />
                      ) : (
                        <>
                          <ImageIcon size={16} color="#38B6FF" />
                          <Text style={[styles.changeImageText, { color: '#38B6FF' }]}>Change</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>

            {/* Virtual Toggle */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <Video size={20} color={isVirtual ? '#38B6FF' : colors.textSecondary} />
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Virtual Event</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Online event via Zoom, Meet, etc.
                  </Text>
                </View>
              </View>
              <Switch
                value={isVirtual}
                onValueChange={setIsVirtual}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {isVirtual ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Meeting Link *</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Link size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="https://zoom.us/j/..."
                    placeholderTextColor={colors.textSecondary}
                    value={virtualLink}
                    onChangeText={setVirtualLink}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Location Name *</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <MapPin size={20} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="e.g., Devon House, Kingston"
                      placeholderTextColor={colors.textSecondary}
                      value={location}
                      onChangeText={(text) => {
                        setLocation(text);
                        // Clear previous timeout
                        if (geocodeTimeoutRef.current) {
                          clearTimeout(geocodeTimeoutRef.current);
                        }
                        // Auto-geocode after user stops typing
                        geocodeTimeoutRef.current = setTimeout(() => {
                          if (text.trim()) {
                            handleLocationGeocode(text);
                          }
                        }, 1000);
                      }}
                    />
                    {isGeocodingLocation && (
                      <ActivityIndicator size="small" color="#38B6FF" />
                    )}
                  </View>
                  {geocodingLocation && !geocodingLocation.success && (
                    <Text style={[styles.errorText, { color: '#F44336' }]}>
                      {geocodingLocation.error}
                    </Text>
                  )}
                  {geocodingLocation?.success && geocodingLocation.formattedAddress && (
                    <Text style={[styles.successText, { color: '#4CAF50' }]}>
                      ✓ {geocodingLocation.formattedAddress}
                    </Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Full Address</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <MapPin size={20} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Auto-filled from location or enter manually"
                      placeholderTextColor={colors.textSecondary}
                      value={locationAddress}
                      onChangeText={setLocationAddress}
                    />
                  </View>
                </View>

                {latitude && longitude && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Coordinates</Text>
                    <Text style={[styles.coordinateText, { color: colors.textSecondary }]}>
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Google Maps Link</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Link size={20} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="https://maps.google.com/..."
                      placeholderTextColor={colors.textSecondary}
                      value={mapLink}
                      onChangeText={setMapLink}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Date & Time Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Date & Time</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Event Date *</Text>
              <TouchableOpacity
                style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={20} color={colors.textSecondary} />
                <Text style={[styles.input, { color: colors.text }]}>
                  {dateToString(eventDate)}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setEventDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Start Time *</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={20} color={colors.textSecondary} />
                  <Text style={[styles.input, { color: colors.text }]}>
                    {dateToTimeString(startTime)}
                  </Text>
                </TouchableOpacity>
                {showStartTimePicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowStartTimePicker(Platform.OS === 'ios');
                      if (selectedTime) {
                        setStartTime(selectedTime);
                      }
                    }}
                    is24Hour={true}
                  />
                )}
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>End Time</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Clock size={20} color={colors.textSecondary} />
                  <Text style={[styles.input, { color: colors.text }]}>
                    {endTime ? dateToTimeString(endTime) : 'Not set'}
                  </Text>
                </TouchableOpacity>
                {showEndTimePicker && (
                  <DateTimePicker
                    value={endTime || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      setShowEndTimePicker(Platform.OS === 'ios');
                      if (selectedTime) {
                        setEndTime(selectedTime);
                      }
                    }}
                    is24Hour={true}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Capacity Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Capacity & Registration</Text>

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <Users size={20} color={hasCapacity ? '#38B6FF' : colors.textSecondary} />
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Limited Capacity</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Set maximum attendees
                  </Text>
                </View>
              </View>
              <Switch
                value={hasCapacity}
                onValueChange={setHasCapacity}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {hasCapacity && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Maximum Capacity *</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Users size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="e.g., 50"
                    placeholderTextColor={colors.textSecondary}
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <FileText size={20} color={registrationRequired ? '#38B6FF' : colors.textSecondary} />
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Require Registration</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Users must register to attend
                  </Text>
                </View>
              </View>
              <Switch
                value={registrationRequired}
                onValueChange={setRegistrationRequired}
                trackColor={{ false: colors.border, true: '#38B6FF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {registrationRequired && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Registration Deadline</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowRegistrationDeadlinePicker(true)}
                >
                  <Calendar size={20} color={colors.textSecondary} />
                  <Text style={[styles.input, { color: colors.text }]}>
                    {registrationDeadline ? dateToString(registrationDeadline) : 'Not set (optional)'}
                  </Text>
                </TouchableOpacity>
                {showRegistrationDeadlinePicker && (
                  <DateTimePicker
                    value={registrationDeadline || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowRegistrationDeadlinePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setRegistrationDeadline(selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                  />
                )}
              </View>
            )}
          </View>

          {/* Pricing Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pricing</Text>

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <DollarSign size={20} color={isFree ? '#4CAF50' : colors.textSecondary} />
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Free Event</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    No ticket price required
                  </Text>
                </View>
              </View>
              <Switch
                value={isFree}
                onValueChange={setIsFree}
                trackColor={{ false: colors.border, true: '#4CAF50' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {!isFree && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Ticket Price (JMD) *</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>J$</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      value={ticketPrice}
                      onChangeText={setTicketPrice}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Link *</Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Link size={20} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="https://payment.example.com/..."
                      placeholderTextColor={colors.textSecondary}
                      value={paymentLink}
                      onChangeText={setPaymentLink}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    Link to your payment page (e.g., eZeePayments, PayPal, etc.)
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Optional - displayed on event page
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Contact Name</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <User size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="John Smith"
                  placeholderTextColor={colors.textSecondary}
                  value={contactName}
                  onChangeText={setContactName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Contact Email</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Mail size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="contact@example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Contact Phone</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Phone size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="+1 876 555 0123"
                  placeholderTextColor={colors.textSecondary}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
              </View>
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
              <Calendar size={22} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Create Event</Text>
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  inputHint: {
    fontSize: 12,
    marginTop: 4,
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
    fontSize: 16,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectText: {
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
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
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
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  successText: {
    fontSize: 12,
    marginTop: 4,
  },
  coordinateText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
