/**
 * Opportunity Review Detail Screen
 * Admin screen to review and approve/reject opportunity proposals
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/colors';
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Edit,
  FileText,
  ExternalLink,
  AlertCircle,
} from 'lucide-react-native';
import { supabase } from '../../../services/supabase';
import CustomAlert from '../../../components/CustomAlert';
import { sendNotificationToUser } from '../../../services/pushNotifications';

interface OpportunityData {
  id: string;
  title: string;
  organization_name: string;
  category: string;
  description: string;
  location: string;
  date_start: string;
  date_end: string;
  time_start: string;
  time_end: string;
  spots_total: number;
  spots_available: number;
  requirements: string[] | null;
  skills_needed: string[] | null;
  impact_statement: string | null;
  links: Array<{ label: string; url: string }> | null;
  image_url: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  proposal_status: string;
  submitted_by: string;
  created_at: string;
  submitted_by_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    email?: string;
  };
}

export default function OpportunityReviewDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const params = useLocalSearchParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
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

  useEffect(() => {
    if (opportunityId) {
      loadOpportunityDetails();
    }
  }, [opportunityId]);

  const loadOpportunityDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          submitted_by_user:users!submitted_by (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('id', opportunityId)
        .single();

      if (error) throw error;
      setOpportunity(data);
    } catch (error: any) {
      console.error('Error loading opportunity:', error);
      showAlert('Error', 'Failed to load opportunity details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!opportunity || !user) return;

    try {
      setSubmitting(true);

      // Update opportunity status
      // Set date field for backward compatibility if not already set
      const dateValue = opportunity.date_start || new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          proposal_status: 'approved',
          status: 'active',
          organization_verified: true,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          date: dateValue, // Ensure date field is set for backward compatibility
        })
        .eq('id', opportunityId);

      if (updateError) throw updateError;

      // Create notification for volunteer
      if (opportunity.submitted_by) {
        await supabase.from('notifications').insert({
          user_id: opportunity.submitted_by,
          type: 'opportunity',
          title: 'Opportunity Approved',
          message: `Your opportunity proposal "${opportunity.title}" has been approved!`,
          link: `/opportunity/${opportunityId}`,
          related_id: opportunityId,
          is_read: false,
        });

        // Send push notification
        try {
          await sendNotificationToUser(opportunity.submitted_by, {
            type: 'opportunity',
            id: opportunityId,
            title: 'Opportunity Approved',
            body: `Your proposal "${opportunity.title}" has been approved!`,
          });
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
        }
      }

      showAlert('Success!', 'Opportunity has been approved and is now active', 'success');
      
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      console.error('Error approving opportunity:', error);
      showAlert('Error', error.message || 'Failed to approve opportunity', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!opportunity || !user || !rejectionReason.trim()) {
      showAlert('Error', 'Please provide a reason for rejection', 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Update opportunity status
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          proposal_status: 'rejected',
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);

      if (updateError) throw updateError;

      // Create notification for volunteer
      if (opportunity.submitted_by) {
        await supabase.from('notifications').insert({
          user_id: opportunity.submitted_by,
          type: 'opportunity',
          title: 'Opportunity Rejected',
          message: `Your opportunity proposal "${opportunity.title}" was rejected. Reason: ${rejectionReason.trim()}`,
          link: `/propose-opportunity`,
          related_id: opportunityId,
          is_read: false,
        });

        // Send push notification
        try {
          await sendNotificationToUser(opportunity.submitted_by, {
            type: 'opportunity',
            id: opportunityId,
            title: 'Opportunity Rejected',
            body: `Your proposal "${opportunity.title}" was rejected. See details in the app.`,
          });
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
        }
      }

      setRejectModalVisible(false);
      setRejectionReason('');
      showAlert('Rejected', 'Opportunity has been rejected and the volunteer has been notified', 'success');
      
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      console.error('Error rejecting opportunity:', error);
      showAlert('Error', error.message || 'Failed to reject opportunity', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/edit-opportunity/${opportunityId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryLabel = (category: string) => {
    const categories: { [key: string]: string } = {
      environment: 'Environment',
      education: 'Education',
      healthcare: 'Healthcare',
      poorRelief: 'Poor Relief',
      community: 'Community',
      viEngage: 'VI Engage',
    };
    return categories[category] || category;
  };

  // Safety check
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Access Denied
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Review Opportunity</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading opportunity details...
          </Text>
        </View>
      </View>
    );
  }

  if (!opportunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Review Opportunity</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Opportunity not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review Opportunity</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Submitted By Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Submitted By</Text>
          <View style={styles.submittedByRow}>
            {opportunity.submitted_by_user?.avatar_url ? (
              <Image
                source={{ uri: opportunity.submitted_by_user.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <User size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.submittedByInfo}>
              <Text style={[styles.submittedByName, { color: colors.text }]}>
                {opportunity.submitted_by_user?.full_name || 'Unknown User'}
              </Text>
              <Text style={[styles.submittedByDate, { color: colors.textSecondary }]}>
                Submitted {formatDate(opportunity.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Image */}
        {opportunity.image_url && (
          <Image source={{ uri: opportunity.image_url }} style={styles.image} />
        )}

        {/* Title and Organization */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{opportunity.title}</Text>
          <Text style={[styles.organization, { color: colors.textSecondary }]}>
            {opportunity.organization_name}
          </Text>
          <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {getCategoryLabel(opportunity.category)}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
          <Text style={[styles.description, { color: colors.text }]}>{opportunity.description}</Text>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MapPin size={20} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{opportunity.location}</Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Calendar size={20} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(opportunity.date_start)}
              {opportunity.date_end && opportunity.date_end !== opportunity.date_start
                ? ` - ${formatDate(opportunity.date_end)}`
                : ''}
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Clock size={20} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Time</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {opportunity.time_start} - {opportunity.time_end}
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={20} color={colors.primary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Spots</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {opportunity.spots_total} total
            </Text>
          </View>
        </View>

        {/* Requirements */}
        {opportunity.requirements && opportunity.requirements.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Requirements</Text>
            {opportunity.requirements.map((req, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.listText, { color: colors.text }]}>{req}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills Needed */}
        {opportunity.skills_needed && opportunity.skills_needed.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Skills Needed</Text>
            <View style={styles.skillsContainer}>
              {opportunity.skills_needed.map((skill, index) => (
                <View key={index} style={[styles.skillTag, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.skillText, { color: colors.primary }]}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Impact Statement */}
        {opportunity.impact_statement && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Impact Statement</Text>
            <Text style={[styles.description, { color: colors.text }]}>
              {opportunity.impact_statement}
            </Text>
          </View>
        )}

        {/* Links */}
        {opportunity.links && opportunity.links.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Links</Text>
            {opportunity.links.map((link, index) => (
              <TouchableOpacity
                key={index}
                style={styles.linkItem}
                onPress={() => Linking.openURL(link.url)}
              >
                <ExternalLink size={16} color={colors.primary} />
                <Text style={[styles.linkText, { color: colors.primary }]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Contact Person */}
        {(opportunity.contact_person_name || opportunity.contact_person_phone) && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Person</Text>
            {opportunity.contact_person_name && (
              <Text style={[styles.description, { color: colors.text }]}>
                {opportunity.contact_person_name}
              </Text>
            )}
            {opportunity.contact_person_phone && (
              <Text style={[styles.description, { color: colors.text }]}>
                {opportunity.contact_person_phone}
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.approveButton, { backgroundColor: '#10B981' }]}
            onPress={handleApprove}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectButton, { backgroundColor: colors.error }]}
            onPress={() => setRejectModalVisible(true)}
            disabled={submitting}
          >
            <XCircle size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={handleEdit}
            disabled={submitting}
          >
            <Edit size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rejection Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Reject Opportunity</Text>
              <TouchableOpacity
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectionReason('');
                }}
              >
                <ChevronLeft size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Please provide a reason for rejecting this opportunity proposal. The volunteer will be notified.
            </Text>

            <TextInput
              style={[styles.reasonInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectionReason('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.error }]}
                onPress={handleReject}
                disabled={submitting || !rejectionReason.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  submittedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedByInfo: {
    flex: 1,
  },
  submittedByName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  submittedByDate: {
    fontSize: 13,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organization: {
    fontSize: 16,
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listBullet: {
    fontSize: 18,
    marginRight: 8,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

