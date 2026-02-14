/**
 * Edit Event Screen
 * Admin form to edit existing events
 * File: app/(admin)/events/edit/[id].tsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import CrossPlatformDateTimePicker from '../../../../components/CrossPlatformDateTimePicker';
import CustomAlert from '../../../../components/CustomAlert';
import ImageCropperModal from '../../../../components/ImageCropperModal';
import { geocodeLocation, GeocodeResult } from '../../../../services/geocoding';
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
  Save,
  Star,
  Trash2,
  Upload,
  X,
  Globe,
  Lock,
} from 'lucide-react-native';
import { Colors } from '../../../../constants/colors';
import { Event, EventCategory, EventStatus, PaymentMethodPreference, VisibilityType } from '../../../../types';
import { getEventById, updateEvent, deleteEvent } from '../../../../services/eventsService';
import { useAuth } from '../../../../contexts/AuthContext';
import WebContainer from '../../../../components/WebContainer';
import { supabase } from '../../../../services/supabase';
import { decode } from 'base64-arraybuffer';

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

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodPreference; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Try integrated checkout first, then fallback to manual link.' },
  { value: 'integrated', label: 'Integrated Only', description: 'Use integrated checkout only.' },
  { value: 'manual_link', label: 'Manual Link Only', description: 'Open your eZee dashboard button/payment link.' },
];

// Status options - colors will be retrieved from theme
const getStatusOptions = (colors: any): { value: EventStatus; label: string; color: string }[] => [
  { value: 'draft', label: 'Draft', color: colors.textSecondary },
  { value: 'upcoming', label: 'Upcoming', color: colors.primary },
  { value: 'ongoing', label: 'Ongoing', color: colors.success },
  { value: 'completed', label: 'Completed', color: colors.textTertiary },
  { value: 'cancelled', label: 'Cancelled', color: colors.error },
];

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // Loading state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('meetup');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [status, setStatus] = useState<EventStatus>('upcoming');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [rawImageUri, setRawImageUri] = useState<string | null>(null);
  const [cropperVisible, setCropperVisible] = useState(false);

  // Notification state
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

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
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);

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

  // Pricing
  const [isFree, setIsFree] = useState(true);
  const [ticketPrice, setTicketPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodPreference>('auto');
  const [manualPaymentLink, setManualPaymentLink] = useState('');

  // Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    onConfirm: undefined as (() => void) | undefined,
  });

  const showAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    onConfirm?: () => void
  ) => {
    setAlertConfig({ type, title, message, onConfirm });
    setAlertVisible(true);
  };

  const isValidUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());

  // Load event data
  useEffect(() => {
    async function loadEvent() {
      if (!id) return;

      try {
        const response = await getEventById(id);
        if (response.success && response.data) {
          const event = response.data;

          setTitle(event.title);
          setDescription(event.description);
          setCategory(event.category);
          setStatus(event.status);
          setIsFeatured(event.isFeatured);
          setVisibility(event.visibility || 'public');
          setImageUrl(event.imageUrl || '');
          setImageUri(event.imageUrl ? null : null); // Don't set imageUri from existing URL
          setIsVirtual(event.isVirtual);
          setLocation(event.isVirtual ? '' : event.location);
          setLocationAddress(event.locationAddress || '');
          setVirtualLink(event.virtualLink || '');
          setMapLink(event.mapLink || '');
          setLatitude(event.latitude || null);
          setLongitude(event.longitude || null);
          // Parse date and time
          if (event.eventDate) {
            const eventDateObj = new Date(event.eventDate);
            setEventDate(eventDateObj);
          }
          if (event.startTime) {
            setStartTime(timeStringToDate(event.startTime));
          }
          if (event.endTime) {
            setEndTime(timeStringToDate(event.endTime));
          }
          setHasCapacity(!!event.capacity);
          setCapacity(event.capacity?.toString() || '');
          setRegistrationRequired(event.registrationRequired);
          if (event.registrationDeadline) {
            setRegistrationDeadline(new Date(event.registrationDeadline));
          }
          setIsFree(event.isFree);
          setTicketPrice(event.ticketPrice?.toString() || '');
          setPaymentMethod(event.paymentMethod || 'auto');
          setManualPaymentLink(event.manualPaymentLink || event.paymentLink || '');
          setContactName(event.contactName || '');
          setContactEmail(event.contactEmail || '');
          setContactPhone(event.contactPhone || '');
        } else {
          showAlert('error', 'Error', 'Failed to load event');
          router.back();
        }
      } catch (error) {
        console.error('Error loading event:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [id, router]);

  // Handle image picker
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('warning', 'Permission Denied', 'We need access to your photos to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setRawImageUri(result.assets[0].uri);
        setCropperVisible(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('error', 'Error', 'Failed to pick image. Please try again.');
    }
  }, [showAlert]);

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

      console.log('[EditEvent] Image uploaded successfully:');
      console.log('  - Path:', data.path);
      console.log('  - Public URL:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert('error', 'Error', 'Failed to upload image. Please try again.');
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
      showAlert('warning', 'Required', 'Please enter an event title');
      return false;
    }
    if (!description.trim()) {
      showAlert('warning', 'Required', 'Please enter a description');
      return false;
    }
    if (!isVirtual && !location.trim()) {
      showAlert('warning', 'Required', 'Please enter a location');
      return false;
    }
    if (isVirtual && !virtualLink.trim()) {
      showAlert('warning', 'Required', 'Please enter a virtual meeting link');
      return false;
    }
    if (!eventDate) {
      showAlert('warning', 'Required', 'Please enter the event date');
      return false;
    }
    if (!startTime) {
      showAlert('warning', 'Required', 'Please enter the start time');
      return false;
    }
    if (hasCapacity && (!capacity || parseInt(capacity) <= 0)) {
      showAlert('warning', 'Invalid', 'Please enter a valid capacity');
      return false;
    }
    if (!isFree && (!ticketPrice || parseFloat(ticketPrice) <= 0)) {
      showAlert('warning', 'Invalid', 'Please enter a valid ticket price');
      return false;
    }
    if (!isFree && paymentMethod === 'manual_link' && !isValidUrl(manualPaymentLink)) {
      showAlert('warning', 'Invalid', 'Please enter a valid manual payment link (https://...)');
      return false;
    }
    return true;
  }, [title, description, isVirtual, location, virtualLink, eventDate, startTime, hasCapacity, capacity, isFree, ticketPrice, paymentMethod, manualPaymentLink]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm() || !id) return;

    setSubmitting(true);

    try {
      // Upload new image if one was selected
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

      const response = await updateEvent(id, {
        title: title.trim(),
        description: description.trim(),
        category,
        status,
        isFeatured,
        visibility,
        imageUrl: imageUri ? finalImageUrl : (imageUrl ? imageUrl.trim() : undefined),
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
        paymentMethod: !isFree ? paymentMethod : 'auto',
        manualPaymentLink: !isFree ? (manualPaymentLink.trim() || null) : null,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });

      if (response.success) {
        const eventPathId = response.data?.slug || id;
        // Handle Notifications
        if (notifyUsers) {
          try {
            const { error: notifyError } = await supabase.rpc('notify_event_update', {
              p_event_id: id,
              p_title: title.trim(),
              p_changes: updateMessage.trim() || 'Details have been updated.'
            });

            if (notifyError) {
              console.error('Error sending notifications:', notifyError);
              showAlert(
                'warning',
                'Saved with Warning',
                'Event updated but failed to notify attendees.',
                () => router.replace(`/events/${eventPathId}`)
              );
              return;
            }
          } catch (err) {
            console.error('Notification exception:', err);
          }
        }

        showAlert(
          'success',
          'Saved!',
          'Event has been updated successfully' + (notifyUsers ? ' and attendees notified.' : '.'),
          () => router.replace(`/events/${eventPathId}`)
        );
      } else {
        showAlert('error', 'Error', response.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Update event error:', error);
      showAlert('error', 'Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validateForm, id, title, description, category, status, isFeatured, imageUri, imageUrl, isVirtual, location, locationAddress, mapLink, latitude, longitude, virtualLink, eventDate, startTime, endTime, hasCapacity, capacity, registrationRequired, registrationDeadline, isFree, ticketPrice, paymentMethod, manualPaymentLink, contactName, contactEmail, contactPhone, router, uploadImageToStorage, dateToString, dateToTimeString]);

  // Handle delete
  const handleDelete = useCallback(() => {
    setAlertConfig({
      type: 'error',
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event? This cannot be undone.',
      onConfirm: async () => {
        if (!id) return;
        const response = await deleteEvent(id);
        if (response.success) {
          showAlert('success', 'Deleted', 'Event has been deleted', () => router.replace('/events'));
        } else {
          showAlert('error', 'Error', response.error || 'Failed to delete event');
        }
      },
    });
    setAlertVisible(true);
  }, [id, router]);

  const STATUS_OPTIONS = getStatusOptions(colors);
  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === category);
  const selectedStatus = STATUS_OPTIONS.find(s => s.value === status);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Event</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Event</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={22} color={colors.error} />
        </TouchableOpacity>
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
            {/* Status & Featured Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>

              {/* Status Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Event Status</Text>
                <TouchableOpacity
                  style={[styles.selectContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowStatusPicker(!showStatusPicker)}
                >
                  <View style={[styles.statusDot, { backgroundColor: selectedStatus?.color }]} />
                  <Text style={[styles.selectText, { color: colors.text }]}>
                    {selectedStatus?.label}
                  </Text>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {showStatusPicker && (
                  <View style={[styles.pickerOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {STATUS_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.pickerOption, status === option.value && { backgroundColor: colors.background }]}
                        onPress={() => {
                          setStatus(option.value);
                          setShowStatusPicker(false);
                        }}
                      >
                        <View style={styles.statusOptionRow}>
                          <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                          <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                            {option.label}
                          </Text>
                        </View>
                        {status === option.value && <Check size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Visibility */}
              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  {visibility === 'public' ? (
                    <Globe size={20} color={colors.success} />
                  ) : (
                    <Lock size={20} color={colors.warning} />
                  )}
                  <View style={{ flex: 1 }}>
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
                  trackColor={{ false: colors.border, true: colors.warning }}
                  thumbColor={colors.textOnPrimary}
                />
              </View>

              {/* Featured Toggle */}
              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Star size={20} color={isFeatured ? colors.eventFeaturedGold : colors.textSecondary} fill={isFeatured ? colors.eventFeaturedGold : 'none'} />
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Featured Event</Text>
                    <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                      Highlight on the Events page
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isFeatured}
                  onValueChange={setIsFeatured}
                  trackColor={{ false: colors.border, true: colors.eventFeaturedGold }}
                  thumbColor={colors.textOnPrimary}
                />
              </View>
            </View>

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
                        {category === option.value && <Check size={18} color={colors.primary} />}
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
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Upload size={20} color={colors.primary} />
                        <Text style={[styles.uploadButtonText, { color: colors.primary }]}>Upload Image</Text>
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
                      <X size={18} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.changeImageButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={handlePickImage}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <ImageIcon size={16} color={colors.primary} />
                          <Text style={[styles.changeImageText, { color: colors.primary }]}>Change</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Location Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>

              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Video size={20} color={isVirtual ? colors.primary : colors.textSecondary} />
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
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.textOnPrimary}
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
                          }, 800);
                        }}
                      />
                      {isGeocodingLocation && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                    </View>
                    {geocodingLocation && !geocodingLocation.success && (
                      <Text style={[styles.errorText, { color: colors.error }]}>
                        {geocodingLocation.error}
                      </Text>
                    )}
                    {geocodingLocation?.success && geocodingLocation.formattedAddress && (
                      <Text style={[styles.successText, { color: colors.success }]}>
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

              <CrossPlatformDateTimePicker
                mode="date"
                value={eventDate}
                onChange={(date) => date && setEventDate(date)}
                minimumDate={new Date()}
                label="Event Date *"
                colors={colors}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <CrossPlatformDateTimePicker
                    mode="time"
                    value={startTime}
                    onChange={(date) => date && setStartTime(date)}
                    label="Start Time *"
                    colors={colors}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <CrossPlatformDateTimePicker
                    mode="time"
                    value={endTime || new Date()}
                    onChange={(date) => setEndTime(date)}
                    label="End Time"
                    placeholder="Not set"
                    colors={colors}
                  />
                </View>
              </View>
            </View>

            {/* Capacity Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Capacity & Registration</Text>

              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Users size={20} color={hasCapacity ? colors.primary : colors.textSecondary} />
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Limited Capacity</Text>
                  </View>
                </View>
                <Switch
                  value={hasCapacity}
                  onValueChange={setHasCapacity}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.textOnPrimary}
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
                  <FileText size={20} color={registrationRequired ? colors.primary : colors.textSecondary} />
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
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.textOnPrimary}
                />
              </View>

              {registrationRequired && (
                <CrossPlatformDateTimePicker
                  mode="date"
                  value={registrationDeadline || new Date()}
                  onChange={(date) => setRegistrationDeadline(date)}
                  minimumDate={new Date()}
                  label="Registration Deadline"
                  placeholder="Not set (optional)"
                  colors={colors}
                />
              )}
            </View>

            {/* Pricing Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pricing</Text>

              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <DollarSign size={20} color={isFree ? colors.success : colors.textSecondary} />
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Free Event</Text>
                  </View>
                </View>
                <Switch
                  value={isFree}
                  onValueChange={setIsFree}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.textOnPrimary}
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
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Payment Method</Text>
                    <View style={[styles.pickerOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={styles.pickerOption}
                          onPress={() => setPaymentMethod(option.value)}
                        >
                          <View>
                            <Text style={[styles.pickerOptionText, { color: colors.text }]}>{option.label}</Text>
                            <Text style={[styles.inputHint, { color: colors.textSecondary }]}>{option.description}</Text>
                          </View>
                          {paymentMethod === option.value && <Check size={18} color={colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {paymentMethod !== 'integrated' && (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>
                        Manual Payment Link {paymentMethod === 'manual_link' ? '*' : '(Optional)'}
                      </Text>
                      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Link size={20} color={colors.textSecondary} />
                        <TextInput
                          style={[styles.input, { color: colors.text }]}
                          placeholder="https://my.ezeepayments.com/..."
                          placeholderTextColor={colors.textSecondary}
                          value={manualPaymentLink}
                          onChangeText={setManualPaymentLink}
                          autoCapitalize="none"
                          keyboardType="url"
                        />
                      </View>
                      <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                        Used when manual mode is selected or as fallback in auto mode.
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    Payments are processed securely via eZeePayments
                  </Text>
                </>
              )}
            </View>

            {/* Contact Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>

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



            {/* Notification Settings */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Settings</Text>

              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleInfo}>
                  <Users size={20} color={notifyUsers ? colors.primary : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Notify Attendees</Text>
                    <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                      Send a push notification to all registered attendees about this update.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={notifyUsers}
                  onValueChange={setNotifyUsers}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={'#FFF'}
                />
              </View>

              {notifyUsers && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Message to Attendees *</Text>
                  <View style={[styles.textAreaContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.textArea, { color: colors.text, minHeight: 80 }]}
                      value={updateMessage}
                      onChangeText={setUpdateMessage}
                      placeholder="e.g., The start time has been changed to 10:00 AM"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                    />
                  </View>
                </View>
              )}
            </View>

          </ScrollView>
        </WebContainer>
      </KeyboardAvoidingView>

      {/* Save Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && styles.submitButtonDisabled]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Save size={22} color={colors.textOnPrimary} />
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Image Cropper */}
      <ImageCropperModal
        visible={cropperVisible}
        imageUri={rawImageUri}
        aspectRatio={16 / 9}
        onCrop={(croppedUri) => {
          setImageUri(croppedUri);
          setCropperVisible(false);
          setRawImageUri(null);
        }}
        onSkip={(originalUri) => {
          setImageUri(originalUri);
          setCropperVisible(false);
          setRawImageUri(null);
        }}
        onCancel={() => {
          setCropperVisible(false);
          setRawImageUri(null);
        }}
      />

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfig.onConfirm}
        showCancel={!!alertConfig.onConfirm}
      />
    </View >
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
  deleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

