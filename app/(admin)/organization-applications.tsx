/**
 * Organization Applications Screen
 * Review and approve/reject partner organization applications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import {
  ChevronLeft,
  Building2,
  Check,
  X,
  Clock,
  Mail,
  Phone,
  MapPin,
  Globe,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import { supabase } from '../../services/supabase';

interface OrganizationApplication {
  id: string;
  email: string;
  phone: string;
  location: string;
  country: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  organization_data: {
    organization_name: string;
    registration_number: string;
    organization_description: string;
    website_url?: string;
    contact_person_name: string;
    contact_person_role?: string;
    organization_size: string;
    industry_focus: string[];
  };
}

export default function OrganizationApplicationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [applications, setApplications] = useState<OrganizationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadApplications();
  }, [activeTab]);

  const loadApplications = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select('id, email, phone, location, country, approval_status, created_at, organization_data')
        .eq('account_type', 'organization')
        .eq('approval_status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      Alert.alert('Error', 'Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadApplications();
  }, [activeTab]);

  const handleApprove = async (applicationId: string, organizationName: string) => {
    Alert.alert(
      'Approve Organization',
      `Are you sure you want to approve "${organizationName}"? They will be notified via email with payment instructions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessingId(applicationId);
            try {
              const { error } = await supabase
                .from('users')
                .update({ approval_status: 'approved' })
                .eq('id', applicationId);

              if (error) throw error;

              Alert.alert(
                'Approved!',
                `${organizationName} has been approved. They will receive an email with payment instructions.`
              );

              // Reload applications
              loadApplications();
            } catch (error) {
              console.error('Error approving application:', error);
              Alert.alert('Error', 'Failed to approve application. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (applicationId: string, organizationName: string) => {
    Alert.alert(
      'Reject Organization',
      `Are you sure you want to reject "${organizationName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(applicationId);
            try {
              const { error } = await supabase
                .from('users')
                .update({ approval_status: 'rejected' })
                .eq('id', applicationId);

              if (error) throw error;

              Alert.alert('Rejected', `${organizationName} has been rejected.`);

              // Reload applications
              loadApplications();
            } catch (error) {
              console.error('Error rejecting application:', error);
              Alert.alert('Error', 'Failed to reject application. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Safety check
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            You don't have permission to access this area
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
        <View style={styles.headerContent}>
          <Building2 size={28} color="#FFC107" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Organization Applications</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('pending')}
        >
          <Clock size={18} color={activeTab === 'pending' ? colors.primary : colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'pending' ? colors.primary : colors.textSecondary },
            ]}
          >
            Pending
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'approved' && { borderBottomColor: '#10B981' }]}
          onPress={() => setActiveTab('approved')}
        >
          <CheckCircle size={18} color={activeTab === 'approved' ? '#10B981' : colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'approved' ? '#10B981' : colors.textSecondary },
            ]}
          >
            Approved
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'rejected' && { borderBottomColor: colors.error }]}
          onPress={() => setActiveTab('rejected')}
        >
          <XCircle size={18} color={activeTab === 'rejected' ? colors.error : colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'rejected' ? colors.error : colors.textSecondary },
            ]}
          >
            Rejected
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading applications...</Text>
          </View>
        ) : applications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Building2 size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No {activeTab} applications
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {activeTab === 'pending'
                ? 'New applications will appear here'
                : `No organizations have been ${activeTab}`}
            </Text>
          </View>
        ) : (
          applications.map((app) => (
            <View
              key={app.id}
              style={[styles.applicationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Organization Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.orgIcon, { backgroundColor: '#FFC107' + '15' }]}>
                  <Building2 size={24} color="#FFC107" />
                </View>
                <View style={styles.orgInfo}>
                  <Text style={[styles.orgName, { color: colors.text }]}>
                    {app.organization_data.organization_name}
                  </Text>
                  <Text style={[styles.orgRegistration, { color: colors.textSecondary }]}>
                    Reg: {app.organization_data.registration_number}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.description, { color: colors.text }]}>
                {app.organization_data.organization_description}
              </Text>

              {/* Details Grid */}
              <View style={styles.detailsGrid}>
                {/* Contact Person */}
                <View style={styles.detailItem}>
                  <Users size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {app.organization_data.contact_person_name}
                    {app.organization_data.contact_person_role &&
                      ` • ${app.organization_data.contact_person_role}`}
                  </Text>
                </View>

                {/* Email */}
                <View style={styles.detailItem}>
                  <Mail size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>{app.email}</Text>
                </View>

                {/* Phone */}
                <View style={styles.detailItem}>
                  <Phone size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>{app.phone}</Text>
                </View>

                {/* Location */}
                <View style={styles.detailItem}>
                  <MapPin size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {app.location}, {app.country}
                  </Text>
                </View>

                {/* Website (if exists) */}
                {app.organization_data.website_url && (
                  <View style={styles.detailItem}>
                    <Globe size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.primary }]}>
                      {app.organization_data.website_url}
                    </Text>
                  </View>
                )}

                {/* Organization Size */}
                <View style={styles.detailItem}>
                  <Users size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {app.organization_data.organization_size} employees
                  </Text>
                </View>
              </View>

              {/* Industry Focus Tags */}
              <View style={styles.tagsContainer}>
                {app.organization_data.industry_focus.map((focus, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{focus}</Text>
                  </View>
                ))}
              </View>

              {/* Application Date */}
              <Text style={[styles.appliedDate, { color: colors.textSecondary }]}>
                Applied {new Date(app.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>

              {/* Action Buttons (only for pending) */}
              {activeTab === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.rejectButton, { borderColor: colors.error }]}
                    onPress={() => handleReject(app.id, app.organization_data.organization_name)}
                    disabled={processingId === app.id}
                  >
                    {processingId === app.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <>
                        <X size={18} color={colors.error} />
                        <Text style={[styles.rejectButtonText, { color: colors.error }]}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: '#10B981' }]}
                    onPress={() => handleApprove(app.id, app.organization_data.organization_name)}
                    disabled={processingId === app.id}
                  >
                    {processingId === app.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Check size={18} color="#FFFFFF" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  applicationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  orgRegistration: {
    fontSize: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appliedDate: {
    fontSize: 12,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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