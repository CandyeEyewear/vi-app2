/**
 * Create Opportunity Screen
 * Form for admins to create new volunteering opportunities
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
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
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert from '../components/CustomAlert';
import { sendNotificationToUser } from '../services/pushNotifications';

const CATEGORIES = [
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
];

export default function CreateOpportunityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState('');
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
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('Error', 'Failed to pick image', 'error');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `opportunity-${Date.now()}.jpg`;
      const filePath = `opportunities/${fileName}`;

      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('post-images').getPublicUrl(filePath);

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
    if (!duration.trim()) {
      showAlert('Validation Error', 'Please enter a duration', 'error');
      return false;
    }
    if (!spotsTotal || parseInt(spotsTotal) <= 0) {
      showAlert('Validation Error', 'Please enter a valid number of spots', 'error');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      let imageUrl = null;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      const spotsNum = parseInt(spotsTotal);

      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          title: title.trim(),
          organization_name: organizationName.trim(),
          organization_verified: true, // Admin-created opportunities are verified
          category,
          description: description.trim(),
          location: location.trim(),
          date: date.toISOString(),
          duration: duration.trim(),
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
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Notify all users who have opportunity notifications enabled
      if (data) {
        const { data: userIds, error: notifError } = await supabase.rpc(
          'create_opportunity_notifications',
          {
            p_opportunity_id: data.id,
            p_title: title.trim(),
            p_organization_name: organizationName.trim(),
            p_sender_id: user?.id,
          }
        );

        if (!notifError && userIds && userIds.length > 0) {
          // Send push notifications using the returned user IDs
          for (const userIdObj of userIds) {
            await sendNotificationToUser(userIdObj.user_id, {
              type: 'opportunity',
              id: data.id,
              title: 'New Opportunity Available',
              body: `${title.trim()} - ${organizationName.trim()}`,
            });
          }
        }
      }

      showAlert('Success!', 'Opportunity created successfully', 'success');

      // Wait a bit then navigate back
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      showAlert('Error', error.message || 'Failed to create opportunity', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Opportunity</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{cat.label}</Text>
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

        {/* Location */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Location <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <View style={styles.iconInput}>
            <MapPin size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.inputWithIcon, { color: colors.text }]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Hellshire Beach, St. Catherine"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Date <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.input, styles.selectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.selectButtonText, { color: colors.text }]}>
              {date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Duration <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <View style={styles.iconInput}>
            <Clock size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.inputWithIcon, { color: colors.text }]}
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 3 hours, Full day"
              placeholderTextColor={colors.textSecondary}
            />
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

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Opportunity'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
  fieldDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});