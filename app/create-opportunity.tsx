/**
 * Create Opportunity Screen
 * Form for admins to create new volunteering opportunities
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useThemeStyles } from '../hooks/useThemeStyles';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
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
import { supabase } from '../services/supabase';
import { geocodeLocation, GeocodeResult } from '../services/geocoding';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import CrossPlatformDateTimePicker from '../components/CrossPlatformDateTimePicker';
import CustomAlert from '../components/CustomAlert';
import { sendNotificationToUser } from '../services/pushNotifications';
import WebContainer from '../components/WebContainer';
import { VisibilityType } from '../types';

const CATEGORIES = [
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
  { value: 'viEngage', label: 'VI Engage' },
];

export default function CreateOpportunityScreen() {
  const { colors, responsive } = useThemeStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

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
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');

  // Array fields
  const [requirements, setRequirements] = useState<string[]>([]);
  const [currentRequirement, setCurrentRequirement] = useState('');
  const [skillsNeeded, setSkillsNeeded] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [currentLinkLabel, setCurrentLinkLabel] = useState('');
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });
  const [isOnline, setIsOnline] = useState(true);
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);

  // Geocoding state
  const [geocodingLocation, setGeocodingLocation] = useState<GeocodeResult | null>(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  // Check network connectivity
  const checkNetworkStatus = async () => {
    try {
      // Simple connectivity check by attempting a lightweight Supabase query
      const { error } = await supabase.from('opportunities').select('id').limit(1);
      setIsOnline(!error || error.code !== 'PGRST301');
    } catch (error) {
      setIsOnline(false);
    }
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
          
          console.log('[CREATE_OPP] 📍 Geocoding result:', {
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
    
    console.log('[CREATE_OPP] 📍 Location confirmed:', {
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

  useEffect(() => {
    checkNetworkStatus();
    // Check network status periodically
    const interval = setInterval(checkNetworkStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to get user-friendly error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'An unexpected error occurred';
    
    // Network/connectivity errors
    if (error.message?.includes('network') || error.message?.includes('fetch') || error.code === 'PGRST301') {
      return 'No internet connection. Please check your network and try again.';
    }
    
    // Supabase specific errors
    if (error.code === '23505') {
      return 'This opportunity already exists. Please use a different title.';
    }
    if (error.code === '42501') {
      return 'You do not have permission to perform this action.';
    }
    if (error.code === 'PGRST116') {
      return 'The requested resource was not found.';
    }
    
    // Storage errors
    if (error.message?.includes('storage') || error.message?.includes('upload')) {
      return 'Failed to upload image. Please try again or use a different image.';
    }
    
    // File errors
    if (error.message?.includes('File') || error.message?.includes('file')) {
      return 'There was an issue with the selected file. Please try a different image.';
    }
    
    // Generic error messages
    if (error.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  const handlePickImage = async () => {
    try {
      // Check permissions first
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
        setImageUri(result.assets[0].uri);
        showAlert('Success', 'Image selected successfully', 'success');
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      const errorMessage = error.message?.includes('permission') 
        ? 'Permission to access photos was denied. Please enable it in settings.'
        : 'Failed to pick image. Please try again.';
      showAlert('Error', errorMessage, 'error');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      // Check network before upload
      await checkNetworkStatus();
      if (!isOnline) {
        throw new Error('No internet connection');
      }

      // SDK 54: Use fetch + blob for existence and size
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Selected file does not exist. Please choose a different image.');
      }
      const blob = await response.blob();

      // Check file size (limit to 10MB)
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('Image is too large. Please use an image smaller than 10MB.');
      }
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

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
          throw new Error('An image with this name already exists. Please try again.');
        }
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('post-images').getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      const errorMessage = getErrorMessage(error);
      showAlert('Upload Failed', errorMessage, 'error');
      return null;
    } finally {
      setUploadingImage(false);
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

  const validateForm = (): { isValid: boolean; errorMessage?: string } => {
    if (!title.trim()) {
      return { isValid: false, errorMessage: 'Please enter a title for the opportunity' };
    }
    if (title.trim().length < 3) {
      return { isValid: false, errorMessage: 'Title must be at least 3 characters long' };
    }
    if (!organizationName.trim()) {
      return { isValid: false, errorMessage: 'Please enter an organization name' };
    }
    if (!category) {
      return { isValid: false, errorMessage: 'Please select a category' };
    }
    if (!description.trim()) {
      return { isValid: false, errorMessage: 'Please enter a description' };
    }
    if (description.trim().length < 10) {
      return { isValid: false, errorMessage: 'Description must be at least 10 characters long' };
    }
    if (!location.trim()) {
      return { isValid: false, errorMessage: 'Please enter a location' };
    }
    if (endDate < startDate) {
      return { isValid: false, errorMessage: 'End date must be on or after the start date' };
    }
    if (!startTime.trim() || !endTime.trim()) {
      return { isValid: false, errorMessage: 'Please enter both start and end times' };
    }
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime.trim())) {
      return { isValid: false, errorMessage: 'Start time must be in HH:MM format (e.g., 09:00)' };
    }
    if (!timeRegex.test(endTime.trim())) {
      return { isValid: false, errorMessage: 'End time must be in HH:MM format (e.g., 17:00)' };
    }
    if (!spotsTotal || parseInt(spotsTotal) <= 0) {
      return { isValid: false, errorMessage: 'Please enter a valid number of spots (must be greater than 0)' };
    }
    if (parseInt(spotsTotal) > 10000) {
      return { isValid: false, errorMessage: 'Number of spots cannot exceed 10,000' };
    }
    return { isValid: true };
  };

  const handleCreate = async () => {
    // Validate form
    const validation = validateForm();
    if (!validation.isValid) {
      showAlert('Validation Error', validation.errorMessage || 'Please check your input', 'error');
      return;
    }

    // Check network connectivity
    await checkNetworkStatus();
    if (!isOnline) {
      showAlert(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        'error'
      );
      return;
    }

    try {
      setLoading(true);

      // Upload image if provided
      let imageUrl = null;
      if (imageUri) {
        showAlert('Uploading', 'Uploading image, please wait...', 'warning');
        imageUrl = await uploadImage(imageUri);
        if (!imageUrl) {
          // User can still proceed without image
          showAlert(
            'Image Upload Failed',
            'The opportunity will be created without an image. You can add one later.',
            'warning'
          );
        }
      }

      const spotsNum = parseInt(spotsTotal);

      // Validate user is still authenticated
      if (!user?.id) {
        throw new Error('You must be logged in to create an opportunity. Please log in and try again.');
      }

      // Validate geocoding was successful
      if (!geocodingLocation || !geocodingLocation.success) {
        showAlert(
          'Location Error',
          'Please enter a valid location and wait for coordinates to be found.',
          'error'
        );
        return;
      }

      // Create opportunity
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          title: title.trim(),
          organization_name: organizationName.trim(),
          organization_verified: true, // Admin-created opportunities are verified
          category,
          description: description.trim(),
          location: location.trim(),
          latitude: geocodingLocation.latitude,
          longitude: geocodingLocation.longitude,
          map_link: mapLink.trim() || null,
          date_start: startDate.toISOString(),
          date_end: endDate.toISOString(),
          time_start: startTime.trim(),
          time_end: endTime.trim(),
          spots_total: spotsNum,
          spots_available: spotsNum, // Initially all spots are available
          requirements: requirements.length > 0 ? requirements : null,
          skills_needed: skillsNeeded.length > 0 ? skillsNeeded : null,
          impact_statement: impactStatement.trim() || null,
          links: links.length > 0 ? links : null,
          image_url: imageUrl,
          contact_person_name: contactPersonName.trim() || null,
          contact_person_phone: contactPersonPhone.trim() || null,
          status: 'active',
          created_by: user.id,
          visibility,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to create opportunity. No data returned from server.');
      }

      // Notify all users who have opportunity notifications enabled
      if (data) {
        // Create notification records using RPC function
        const { data: userIds, error: notifError } = await supabase.rpc(
          'create_opportunity_notifications',
          {
            p_opportunity_id: data.id,
            p_title: title.trim(),
            p_organization_name: organizationName.trim(),
            p_sender_id: user?.id,
          }
        );

        if (!notifError && userIds && Array.isArray(userIds) && userIds.length > 0) {
          console.log('🔔 Starting push notification process for opportunity...');
          console.log('📊 Users to notify:', userIds.length);
          
          // Get all users with push tokens
          const userIdsArray = userIds.map(u => u.user_id);
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, push_token')
            .in('id', userIdsArray)
            .not('push_token', 'is', null);

          console.log('📊 Users query result:', { 
            error: usersError, 
            userCount: users?.length || 0 
          });

          if (!usersError && users) {
            console.log('✅ Found', users.length, 'users with push tokens');
            
            // Get notification settings for these users
            const { data: settingsData, error: settingsError } = await supabase
              .from('user_notification_settings')
              .select('user_id, opportunities_enabled')
              .in('user_id', users.map(u => u.id));

            console.log('📊 Settings query result:', { 
              error: settingsError, 
              settingsCount: settingsData?.length || 0 
            });

            if (!settingsError && settingsData) {
              // Filter users who have opportunities enabled
              const settingsMap = new Map(settingsData.map(s => [s.user_id, s.opportunities_enabled]));
              
              const enabledUsers = users.filter(user => {
                const setting = settingsMap.get(user.id);
                return setting === true || setting === undefined;
              });

              console.log('✅ Found', enabledUsers.length, 'users with opportunities enabled');

              for (const userObj of enabledUsers) {
                console.log('📤 Sending push to user:', userObj.id.substring(0, 8) + '...');
                try {
                  await sendNotificationToUser(userObj.id, {
                    type: 'opportunity',
                    id: data.id,
                    title: 'New Opportunity Available',
                    body: `${title.trim()} - ${organizationName.trim()}`,
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

      // Show success message
      showAlert(
        'Success!',
        'Opportunity created successfully. Volunteers will be notified.',
        'success'
      );

      // Wait a bit then navigate back
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      const errorMessage = getErrorMessage(error);
      showAlert('Failed to Create Opportunity', errorMessage, 'error');
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
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + responsive.spacing.lg,
            borderBottomColor: colors.border,
            paddingHorizontal: responsive.spacing.lg,
          },
        ]}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.roundedIconButton,
            {
              backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
            },
          ]}
          onPress={() => router.back()}
        >
          <ChevronLeft size={responsive.iconSize.lg} color={colors.text} />
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Opportunity</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Network Status Indicator */}
      {!isOnline && (
        <View style={[styles.networkBanner, { backgroundColor: colors.error }]}>
          <Text style={[styles.networkBannerText, { color: colors.textOnPrimary }]}>
            ⚠️ No internet connection. Some features may not work.
          </Text>
        </View>
      )}

      <WebContainer>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingHorizontal: responsive.spacing.lg,
          paddingBottom: responsive.spacing.xl + insets.bottom + responsive.spacing.xxl,
          paddingTop: responsive.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
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
          <AnimatedPressable
            style={[styles.input, styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={[styles.selectButtonText, { color: category ? colors.text : colors.textSecondary }]}>
              {category ? CATEGORIES.find(c => c.value === category)?.label : 'Select category'}
            </Text>
          </AnimatedPressable>
          {showCategoryPicker && (
            <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {CATEGORIES.map(cat => (
                <AnimatedPressable
                  key={cat.value}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{cat.label}</Text>
                </AnimatedPressable>
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
          <View style={[styles.iconInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                <AnimatedPressable
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
                </AnimatedPressable>
              ))}
            </View>
          )}
          
          {/* Success Message After Selection */}
          {geocodingLocation && geocodingLocation.success && !showSuggestions && (
            <View
              style={{
                marginTop: responsive.spacing.xs,
                padding: responsive.spacing.sm,
                backgroundColor: colors.successSoft,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: responsive.fontSize.sm, color: colors.successDark, fontWeight: '600' }}>
                ✅ Location confirmed
              </Text>
              <Text style={{ fontSize: responsive.fontSize.xs, color: colors.successText, marginTop: 4 }}>
                {geocodingLocation.formattedAddress}
              </Text>
            </View>
          )}
          
          {/* Error Message */}
          {geocodingLocation && !geocodingLocation.success && location.trim().length >= 3 && !showSuggestions && (
            <View
              style={{
                marginTop: responsive.spacing.xs,
                padding: responsive.spacing.sm,
                backgroundColor: colors.errorSoft,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: responsive.fontSize.sm, color: colors.errorDark, fontWeight: '600' }}>
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
          <View style={[styles.iconInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            <View style={[styles.iconInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FileText size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.inputWithIcon, { color: colors.text }]}
                value={currentRequirement}
                onChangeText={setCurrentRequirement}
                placeholder="e.g., Must be 18+"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={addRequirement}
              />
              <AnimatedPressable onPress={addRequirement} style={styles.addButton}>
                <Plus size={responsive.iconSize.md} color={colors.primary} />
              </AnimatedPressable>
            </View>
          </View>
          {requirements.length > 0 && (
            <View style={styles.chipsContainer}>
              {requirements.map((req, index) => (
                <View key={index} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{req}</Text>
                  <AnimatedPressable onPress={() => removeRequirement(index)}>
                    <X size={responsive.iconSize.sm} color={colors.textSecondary} />
                  </AnimatedPressable>
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
            <View style={[styles.iconInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FileText size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.inputWithIcon, { color: colors.text }]}
                value={currentSkill}
                onChangeText={setCurrentSkill}
                placeholder="e.g., First Aid"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={addSkill}
              />
              <AnimatedPressable onPress={addSkill} style={styles.addButton}>
                <Plus size={responsive.iconSize.md} color={colors.primary} />
              </AnimatedPressable>
            </View>
          </View>
          {skillsNeeded.length > 0 && (
            <View style={styles.chipsContainer}>
              {skillsNeeded.map((skill, index) => (
                <View key={index} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{skill}</Text>
                  <AnimatedPressable onPress={() => removeSkill(index)}>
                    <X size={responsive.iconSize.sm} color={colors.textSecondary} />
                  </AnimatedPressable>
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
            <AnimatedPressable
              onPress={addLink}
              style={[styles.addLinkButton, { backgroundColor: colors.primary }]}
              disabled={!currentLinkLabel.trim() || !currentLinkUrl.trim()}
            >
              <Plus size={responsive.iconSize.md} color={colors.textOnPrimary} />
              <Text style={[styles.addLinkButtonText, { color: colors.textOnPrimary }]}>Add Link</Text>
            </AnimatedPressable>
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
                  <AnimatedPressable onPress={() => removeLink(index)}>
                    <X size={responsive.iconSize.md} color={colors.error} />
                  </AnimatedPressable>
                </View>
              ))}
            </View>
          )}
        </View>
{/* Contact Person */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Contact Person (Optional)
          </Text>
          <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>
            Provide a lead contact for volunteers to reach out to
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, marginTop: 8 }]}
            value={contactPersonName}
            onChangeText={setContactPersonName}
            placeholder="Contact person name"
            placeholderTextColor={colors.textSecondary}
          />

          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, marginTop: 8 }]}
            value={contactPersonPhone}
            onChangeText={setContactPersonPhone}
            placeholder="Phone number (e.g., +1876-555-1234)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Image Upload */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Image (Optional)
          </Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <AnimatedPressable
                style={styles.removeImageButton}
                onPress={() => setImageUri(null)}
              >
                <X size={responsive.iconSize.md} color={colors.textOnPrimary} />
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable
              style={[styles.imagePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                    Uploading image...
                  </Text>
                </>
              ) : (
                <>
                  <ImageIcon size={32} color={colors.textSecondary} />
                  <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                    Tap to upload image
                  </Text>
                </>
              )}
            </AnimatedPressable>
          )}
        </View>

        {/* Visibility */}
        <View style={[styles.field, { marginTop: 16 }]}>
          <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.toggleInfo}>
              {visibility === 'public' ? (
                <Globe size={responsive.iconSize.md} color={colors.success} />
              ) : (
                <Lock size={responsive.iconSize.md} color={colors.warning} />
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
        </View>

        {/* Create Button */}
        <AnimatedPressable
          style={[styles.createButton, (loading || !isOnline) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading || !isOnline}
        >
          <LinearGradient
            colors={
              loading || !isOnline
                ? [colors.textSecondary, colors.textSecondary]
                : [colors.primary, colors.primaryDark]
            }
            style={[
              styles.createButtonGradient,
              {
                height: responsive.buttonHeight,
                paddingHorizontal: responsive.spacing.xl,
              },
            ]}
          >
            {loading ? (
              <View style={styles.buttonLoadingContainer}>
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
                <Text style={[styles.createButtonText, { color: colors.textOnPrimary }]}>
                  Creating Opportunity...
                </Text>
              </View>
            ) : (
              <Text style={[styles.createButtonText, { color: colors.textOnPrimary }]}>
                {!isOnline ? 'No Internet Connection' : 'Create Opportunity'}
              </Text>
            )}
          </LinearGradient>
        </AnimatedPressable>
      </ScrollView>
      </WebContainer>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  roundedIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
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
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  createButtonGradient: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fieldDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
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
  networkBanner: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});