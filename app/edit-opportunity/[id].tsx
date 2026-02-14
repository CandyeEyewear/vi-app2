/**
 * Edit Opportunity Screen
 * Form for admins to edit existing volunteering opportunities
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  FileText,
  Image as ImageIcon,
  X,
  Plus,
  Link as LinkIcon,
  Globe,
  Lock,
} from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { geocodeLocation, GeocodeResult } from '../../services/geocoding';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import CrossPlatformDateTimePicker from '../../components/CrossPlatformDateTimePicker';
import CustomAlert from '../../components/CustomAlert';
import ImageCropperModal from '../../components/ImageCropperModal';
import { VisibilityType } from '../../types';

const CATEGORIES = [
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
  { value: 'viEngage', label: 'VI Engage' },
];

export default function EditOpportunityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const opportunityId = params.id as string;

  // Form state
  const [title, setTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  // Helper function to convert HH:MM string to Date object
  const timeStringToDate = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 9, minutes || 0, 0, 0);
    return date;
  };

  // Helper function to convert Date object to HH:MM string
  const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const [spotsTotal, setSpotsTotal] = useState('');
  const [impactStatement, setImpactStatement] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [rawImageUri, setRawImageUri] = useState<string | null>(null);
  const [cropperVisible, setCropperVisible] = useState(false);

  // Array fields
  const [requirements, setRequirements] = useState<string[]>([]);
  const [currentRequirement, setCurrentRequirement] = useState('');
  const [skillsNeeded, setSkillsNeeded] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [currentLinkLabel, setCurrentLinkLabel] = useState('');
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [opportunitySlug, setOpportunitySlug] = useState<string | null>(null);

  // Geocoding state
  const [geocodingLocation, setGeocodingLocation] = useState<GeocodeResult | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Notification state
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  const navigateBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(`/opportunity/${opportunitySlug || opportunityId}`);
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  // Debounced geocoding with suggestions
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLocationChange = (text: string) => {
    setLocation(text);

    // Clear previous timeout
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    // Only geocode if location has at least 3 characters
    if (text.trim().length < 3) {
      setGeocodingLocation(null);
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Keep keyboard open for 1000ms or until user presses Enter
    setShowSuggestions(true);

    // Set new timeout - geocode only after user stops typing (800ms)
    geocodeTimeoutRef.current = setTimeout(async () => {
      setIsGeocodingLocation(true);
      try {
        const result = await geocodeLocation(text);
        setGeocodingLocation(result);

        if (result.success) {
          // Show suggestion for user to confirm
          setLocationSuggestions([{
            formattedAddress: result.formattedAddress,
            latitude: result.latitude,
            longitude: result.longitude,
          }]);
          setShowSuggestions(true);

          console.log('[EDIT_OPP] 📍 Geocoding result:', {
            location: result.formattedAddress,
            latitude: result.latitude,
            longitude: result.longitude,
          });
        } else {
          setLocationSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setIsGeocodingLocation(false);
      }
    }, 800);
  };

  const handleSelectLocation = (suggestion: any) => {
    // User clicked on a suggestion - populate the fields
    setLocation(suggestion.formattedAddress);
    setManualLatitude(suggestion.latitude.toString());
    setManualLongitude(suggestion.longitude.toString());

    // Auto-populate mapLink with Google Maps URL
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`;
    setMapLink(googleMapsUrl);

    setGeocodingLocation({
      success: true,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      formattedAddress: suggestion.formattedAddress,
    });
    setShowSuggestions(false);

    console.log('[EDIT_OPP] 📍 Location confirmed:', {
      location: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      mapLink: googleMapsUrl,
    });
  };

  const handleLocationKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') {
      setShowSuggestions(false);
    }
  };

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  // Load existing opportunity data
  useEffect(() => {
    loadOpportunityData();
  }, [opportunityId]);

  const loadOpportunityData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (error) throw error;

      // Pre-fill all form fields
      setTitle(data.title);
      setOrganizationName(data.organization_name);
      setCategory(data.category);
      setDescription(data.description);
      setLocation(data.location);
      setMapLink(data.map_link || '');
      setStartDate(new Date(data.date_start || data.date));
      setEndDate(new Date(data.date_end || data.date));
      setStartTime(data.time_start || '09:00');
      setEndTime(data.time_end || '17:00');
      setSpotsTotal(data.spots_total.toString());
      setImpactStatement(data.impact_statement || '');
      setImageUri(data.image_url);
      setRequirements(data.requirements || []);
      setSkillsNeeded(data.skills_needed || []);
      setLinks(data.links || []);
      setVisibility(data.visibility || 'public');
      setOpportunitySlug(data.slug);
    } catch (error) {
      console.error('Error loading opportunity:', error);
      showAlert('Error', 'Failed to load opportunity data', 'error');
      setTimeout(() => navigateBackSafely(), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'We need access to your photo library to upload images. Please enable it in your device settings.',
          'warning'
        );
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
      showAlert('Error', 'Failed to pick image', 'error');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      // SDK 54: Validate using fetch + blob
      const headResponse = await fetch(uri);
      if (!headResponse.ok) {
        throw new Error('File does not exist');
      }

      const response = headResponse;
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

      const fileName = `opportunity-${Date.now()}.jpg`;
      const filePath = `opportunities/${fileName}`;

      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  // Helper function to decode base64
  const decode = (base64: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bufferLength = base64.length * 0.75;
    let p = 0;
    let encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === '=') {
      bufferLength--;
      if (base64[base64.length - 2] === '=') {
        bufferLength--;
      }
    }

    const bytes = new Uint8Array(bufferLength);

    for (let i = 0; i < base64.length; i += 4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i + 1]);
      encoded3 = chars.indexOf(base64[i + 2]);
      encoded4 = chars.indexOf(base64[i + 3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return bytes;
  };

  const addRequirement = () => {
    if (currentRequirement.trim()) {
      setRequirements([...requirements, currentRequirement.trim()]);
      setCurrentRequirement('');
    }
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const addSkill = () => {
    if (currentSkill.trim()) {
      setSkillsNeeded([...skillsNeeded, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const removeSkill = (index: number) => {
    setSkillsNeeded(skillsNeeded.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (currentLinkLabel.trim() && currentLinkUrl.trim()) {
      setLinks([...links, { label: currentLinkLabel.trim(), url: currentLinkUrl.trim() }]);
      setCurrentLinkLabel('');
      setCurrentLinkUrl('');
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!title.trim()) {
      showAlert('Validation Error', 'Please enter a title', 'error');
      return false;
    }
    if (!organizationName.trim()) {
      showAlert('Validation Error', 'Please enter an organization name', 'error');
      return false;
    }
    if (!category) {
      showAlert('Validation Error', 'Please select a category', 'error');
      return false;
    }
    if (!description.trim()) {
      showAlert('Validation Error', 'Please enter a description', 'error');
      return false;
    }
    if (!location.trim()) {
      showAlert('Validation Error', 'Please enter a location', 'error');
      return false;
    }
    if (endDate < startDate) {
      showAlert('Validation Error', 'End date must be after start date', 'error');
      return false;
    }
    if (!startTime.trim() || !endTime.trim()) {
      showAlert('Validation Error', 'Please enter both start and end times', 'error');
      return false;
    }
    if (!spotsTotal || parseInt(spotsTotal) <= 0) {
      showAlert('Validation Error', 'Please enter a valid number of spots', 'error');
      return false;
    }
    return true;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Only upload new image if user selected a new one (uri starts with 'file://')
      let imageUrl = imageUri;
      if (imageUri && imageUri.startsWith('file://')) {
        imageUrl = await uploadImage(imageUri);
      }

      const spotsNum = parseInt(spotsTotal);

      const { data, error } = await supabase
        .from('opportunities')
        .update({
          title: title.trim(),
          organization_name: organizationName.trim(),
          category,
          description: description.trim(),
          location: location.trim(),
          latitude: geocodingLocation?.latitude || null,
          longitude: geocodingLocation?.longitude || null,
          map_link: mapLink.trim() || null,
          date_start: startDate.toISOString(),
          date_end: endDate.toISOString(),
          time_start: startTime.trim(),
          time_end: endTime.trim(),
          spots_total: spotsNum,
          requirements: requirements.length > 0 ? requirements : null,
          skills_needed: skillsNeeded.length > 0 ? skillsNeeded : null,
          impact_statement: impactStatement.trim() || null,
          links: links.length > 0 ? links : null,
          image_url: imageUrl,
          visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
        .select()
        .single();

      if (error) throw error;

      // Handle Notifications
      if (notifyUsers) {
        console.log('[DEBUG] Attempting to call notify_opportunity_update RPC');
        try {
          const { error: notifyError, data: notifyData } = await supabase.rpc('notify_opportunity_update', {
            p_opportunity_id: opportunityId,
            p_title: title.trim(),
            p_changes: updateMessage.trim() || 'Details have been updated.'
          });

          console.log('[DEBUG] RPC result:', { notifyError, notifyData });

          if (notifyError) {
            console.error('Error sending notifications:', notifyError);
            // Don't block success - just warn
            showAlert('Warning', 'Opportunity updated but failed to notify users', 'warning');
            return;
          }
        } catch (err) {
          console.error('Notification exception:', err);
        }
      }

      showAlert(
        'Success!',
        'Opportunity updated successfully' + (notifyUsers ? ' and users notified.' : '.'),
        'success'
      );

      // Navigate back to opportunity details page
      setTimeout(() => {
        router.replace(`/opportunity/${opportunitySlug || opportunityId}`);
      }, 1500);
    } catch (error: any) {
      console.error('Error updating opportunity:', error);
      showAlert(
        'Error',
        error.message || 'Failed to update opportunity',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={navigateBackSafely} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Edit Opportunity
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading opportunity...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (styles.scrollContent as any).paddingBottom + insets.bottom + 80 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Title <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Beach Cleanup Drive"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Organization Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Organization Name <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={organizationName}
              onChangeText={setOrganizationName}
              placeholder="e.g., Volunteers Incorporated"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Category <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={[styles.selectButtonText, { color: category ? colors.text : colors.textSecondary }]}>
                {category ? CATEGORIES.find(c => c.value === category)?.label : 'Select category'}
              </Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setCategory(cat.value);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Description <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the opportunity..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Location Field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
            <View style={styles.iconInput}>
              <MapPin size={20} color={colors.text} />
              <TextInput
                placeholder="e.g., Kingston, Jamaica"
                value={location}
                onChangeText={handleLocationChange}
                onSubmitEditing={handleLocationKeyPress}
                style={[styles.inputWithIcon, { color: colors.text }]}
                editable={!isGeocodingLocation}
                returnKeyType="done"
              />
            </View>

            {/* Geocoding Status */}
            {isGeocodingLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text }}>Finding locations...</Text>
              </View>
            )}

            {/* Location Suggestions */}
            {showSuggestions && locationSuggestions.length > 0 && (
              <View style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                backgroundColor: colors.card,
                overflow: 'hidden'
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  padding: 8,
                  paddingBottom: 4,
                  color: colors.text
                }}>
                  Select a location:
                </Text>
                {locationSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{
                      padding: 12,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                    }}
                    onPress={() => handleSelectLocation(suggestion)}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: colors.text,
                      fontWeight: '500',
                    }}>
                      ✅ {suggestion.formattedAddress}
                    </Text>
                    <Text style={{
                      fontSize: 11,
                      color: colors.text,
                      opacity: 0.6,
                      marginTop: 4,
                    }}>
                      Lat: {suggestion.latitude.toFixed(4)}, Lon: {suggestion.longitude.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Success Message After Selection */}
            {geocodingLocation && geocodingLocation.success && !showSuggestions && (
              <View style={{
                marginTop: 8,
                padding: 8,
                backgroundColor: '#E8F5E9',
                borderRadius: 8
              }}>
                <Text style={{ fontSize: 12, color: '#2E7D32', fontWeight: '500' }}>
                  ✅ Location confirmed
                </Text>
                <Text style={{ fontSize: 11, color: '#558B2F', marginTop: 4 }}>
                  {geocodingLocation.formattedAddress}
                </Text>
              </View>
            )}

            {/* Error Message */}
            {geocodingLocation && !geocodingLocation.success && location.trim().length >= 3 && !showSuggestions && (
              <View style={{
                marginTop: 8,
                padding: 8,
                backgroundColor: '#FFEBEE',
                borderRadius: 8
              }}>
                <Text style={{ fontSize: 12, color: '#C62828', fontWeight: '500' }}>
                  ⚠️ {geocodingLocation.error}
                </Text>
              </View>
            )}
          </View>

          {/* Google Maps Link */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Google Maps Link (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="https://maps.google.com/?q=18.0179,-76.8099"
              placeholderTextColor={colors.textSecondary}
              value={mapLink}
              onChangeText={setMapLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Paste a Google Maps link so volunteers can easily find the location
            </Text>
          </View>

          {/* Date Range */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Date Range <Text style={{ color: colors.error }}>*</Text>
            </Text>

            <View style={styles.dateRangeRow}>
              <View style={styles.dateRangeItem}>
                <CrossPlatformDateTimePicker
                  mode="date"
                  value={startDate}
                  onChange={(date) => {
                    if (date) {
                      setStartDate(date);
                      // Auto-set end date if it's before start date
                      if (endDate < date) {
                        setEndDate(date);
                      }
                    }
                  }}
                  minimumDate={new Date()}
                  label="Start Date"
                  colors={colors}
                />
              </View>

              <View style={styles.dateRangeItem}>
                <CrossPlatformDateTimePicker
                  mode="date"
                  value={endDate}
                  onChange={(date) => date && setEndDate(date)}
                  minimumDate={startDate}
                  label="End Date"
                  colors={colors}
                />
              </View>
            </View>
          </View>

          {/* Time Range */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Time Range <Text style={{ color: colors.error }}>*</Text>
            </Text>

            <View style={styles.timeRangeRow}>
              <View style={styles.timeRangeItem}>
                <CrossPlatformDateTimePicker
                  mode="time"
                  value={timeStringToDate(startTime)}
                  onChange={(date) => date && setStartTime(dateToTimeString(date))}
                  label="Start Time"
                  colors={colors}
                />
              </View>

              <View style={styles.timeRangeItem}>
                <CrossPlatformDateTimePicker
                  mode="time"
                  value={timeStringToDate(endTime)}
                  onChange={(date) => date && setEndTime(dateToTimeString(date))}
                  label="End Time"
                  colors={colors}
                />
              </View>
            </View>
          </View>

          {/* Total Spots */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Total Spots <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={styles.iconInput}>
              <Users size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.inputWithIcon, { color: colors.text }]}
                value={spotsTotal}
                onChangeText={setSpotsTotal}
                placeholder="e.g., 20"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Requirements */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Requirements (Optional)
            </Text>
            <View style={styles.arrayInputContainer}>
              <View style={styles.iconInput}>
                <FileText size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.inputWithIcon, { color: colors.text }]}
                  value={currentRequirement}
                  onChangeText={setCurrentRequirement}
                  placeholder="e.g., Must be 18+"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={addRequirement}
                />
                <TouchableOpacity onPress={addRequirement} style={styles.addButton}>
                  <Plus size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {requirements.length > 0 && (
              <View style={styles.chipsContainer}>
                {requirements.map((req, index) => (
                  <View key={index} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{req}</Text>
                    <TouchableOpacity onPress={() => removeRequirement(index)}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Skills Needed */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Skills Needed (Optional)
            </Text>
            <View style={styles.arrayInputContainer}>
              <View style={styles.iconInput}>
                <FileText size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.inputWithIcon, { color: colors.text }]}
                  value={currentSkill}
                  onChangeText={setCurrentSkill}
                  placeholder="e.g., First Aid"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={addSkill}
                />
                <TouchableOpacity onPress={addSkill} style={styles.addButton}>
                  <Plus size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {skillsNeeded.length > 0 && (
              <View style={styles.chipsContainer}>
                {skillsNeeded.map((skill, index) => (
                  <View key={index} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{skill}</Text>
                    <TouchableOpacity onPress={() => removeSkill(index)}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Impact Statement */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Impact Statement (Optional)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={impactStatement}
              onChangeText={setImpactStatement}
              placeholder="Describe the impact this opportunity will have..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Links */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Links (Optional)
            </Text>
            <View style={styles.linkInputContainer}>
              <TextInput
                style={[styles.linkInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={currentLinkLabel}
                onChangeText={setCurrentLinkLabel}
                placeholder="Label (e.g., Website, Facebook)"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={[styles.linkInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, marginTop: 8 }]}
                value={currentLinkUrl}
                onChangeText={setCurrentLinkUrl}
                placeholder="URL (e.g., https://example.com)"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity
                onPress={addLink}
                style={[styles.addLinkButton, { backgroundColor: colors.primary }]}
                disabled={!currentLinkLabel.trim() || !currentLinkUrl.trim()}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addLinkButtonText}>Add Link</Text>
              </TouchableOpacity>
            </View>
            {links.length > 0 && (
              <View style={styles.linksListContainer}>
                {links.map((link, index) => (
                  <View key={index} style={[styles.linkItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.linkItemContent}>
                      <LinkIcon size={16} color={colors.primary} />
                      <View style={styles.linkItemText}>
                        <Text style={[styles.linkLabel, { color: colors.text }]}>{link.label}</Text>
                        <Text style={[styles.linkUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                          {link.url}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeLink(index)}>
                      <X size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Image Upload */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Image (Optional)
            </Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                >
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.imagePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handlePickImage}
              >
                <ImageIcon size={32} color={colors.textSecondary} />
                <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                  Tap to upload image
                </Text>
              </TouchableOpacity>
            )}
          </View>



          {/* Visibility */}
          <View style={[styles.field, { marginTop: 16 }]}>
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                {visibility === 'public' ? (
                  <Globe size={20} color="#4CAF50" />
                ) : (
                  <Lock size={20} color="#FF9800" />
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
                trackColor={{ false: colors.border, true: '#FF9800' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Notification Settings */}
          <View style={[styles.field, { marginTop: 16 }]}>
            <Text style={[styles.label, { color: colors.text }]}>Notification Settings</Text>
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <Users size={20} color={notifyUsers ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Notify Volunteers</Text>
                  <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                    Send a push notification to all signed-up volunteers about this update.
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
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { color: colors.text, fontSize: 13 }]}>
                  Message to Volunteers <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, fontSize: 14 }]}
                  value={updateMessage}
                  onChangeText={setUpdateMessage}
                  placeholder="e.g., The start time has been changed to 10:00 AM"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }, loading && styles.createButtonDisabled]}
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Updating...' : 'Update Opportunity'}
            </Text>
          </TouchableOpacity>
        </ScrollView >
      )
      }

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
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView >
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: Colors.light.card,
    borderColor: Colors.light.border,
  },
  inputWithIcon: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
  },
  pickerButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
  },
  arrayInputContainer: {
    marginBottom: 8,
  },
  addButton: {
    padding: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  linkInputContainer: {
    gap: 8,
  },
  linkInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  addLinkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  linksListContainer: {
    marginTop: 12,
    gap: 8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  linkItemText: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkUrl: {
    fontSize: 12,
  },
  imagePickerButton: {
    height: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  imagePickerText: {
    fontSize: 14,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  createButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
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
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateRangeItem: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  timeRangeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeRangeItem: {
    flex: 1,
  },
  timeRangeLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
});
