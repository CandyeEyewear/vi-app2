import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle, XCircle, Clock, User, Mail } from 'lucide-react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import CustomAlert from './CustomAlert';
import { UserAvatar, UserNameWithBadge } from './index';
import type { OpportunitySignupWithCheckIn, CheckInStats } from '../types';

interface ParticipantsListProps {
  opportunityId: string;
  isAdmin: boolean;
  onCheckInApproved?: () => void;
}

export default function ParticipantsList({ 
  opportunityId, 
  isAdmin,
  onCheckInApproved 
}: ParticipantsListProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [participants, setParticipants] = useState<OpportunitySignupWithCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<CheckInStats>({
    total_signups: 0,
    checked_in_count: 0,
    pending_approval_count: 0,
    approved_count: 0,
    not_checked_in_count: 0,
  });
  
  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    onConfirm?: () => void,
    showCancel?: boolean
  ) => {
    setAlertConfig({ title, message, type, onConfirm, showCancel });
    setAlertVisible(true);
  };

  useEffect(() => {
    loadParticipants();
    
    // Subscribe to real-time updates (narrowed events to reduce noise)
    const subscription = supabase
      .channel(`participants-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'opportunity_signups',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunity_signups',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'opportunity_signups',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [opportunityId]);

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunity_signups')
        .select(`
          *,
          user:users!opportunity_signups_user_id_fkey (
            id,
            full_name,
            email,
            avatar_url,
            phone,
            role,
            membership_tier,
            membership_status,
            is_partner_organization
          )
        `)
        .eq('opportunity_id', opportunityId)
        .order('signed_up_at', { ascending: false });

      if (error) throw error;

      const typedData = data as OpportunitySignupWithCheckIn[];
      setParticipants(typedData);

      // Calculate stats
      const newStats: CheckInStats = {
        total_signups: typedData.length,
        checked_in_count: typedData.filter(p => p.checked_in).length,
        pending_approval_count: typedData.filter(
          p => p.check_in_status === 'pending_approval'
        ).length,
        approved_count: typedData.filter(
          p => p.check_in_status === 'approved'
        ).length,
        not_checked_in_count: typedData.filter(
          p => p.check_in_status === 'not_checked_in'
        ).length,
      };
      setStats(newStats);
    } catch (error: any) {
      console.error('Error loading participants:', error);
      showAlert('Error', 'Failed to load participants', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (signup: OpportunitySignupWithCheckIn) => {
    if (!isAdmin || !user) return;

    try {
      // Get opportunity hours - FIXED: using 'hours' column
      const { data: opportunity, error: oppError } = await supabase
        .from('opportunities')
        .select('hours')
        .eq('id', opportunityId)
        .single();

      if (oppError) throw oppError;

      // Call the approve function
      const { data, error } = await supabase.rpc('approve_check_in', {
        p_signup_id: signup.id,
        p_admin_id: user.id,
        p_hours_earned: opportunity.hours,
      });

      if (error) throw error;

      showAlert(
        'Success',
        `Check-in approved! ${opportunity.hours} hours added to volunteer's profile.`,
        'success'
      );
      
      loadParticipants();
      onCheckInApproved?.();
    } catch (error: any) {
      console.error('Error approving check-in:', error);
      showAlert('Error', error.message || 'Failed to approve check-in', 'error');
    }
  };

  const handleReject = async (signup: OpportunitySignupWithCheckIn) => {
    if (!isAdmin || !user) return;

    showAlert(
      'Reject Check-In',
      'Are you sure you want to reject this check-in?',
      'error',
      async () => {
        try {
          const { data, error } = await supabase.rpc('reject_check_in', {
            p_signup_id: signup.id,
            p_admin_id: user.id,
            p_reason: 'Rejected by admin',
          });

          if (error) throw error;

          showAlert('Success', 'Check-in rejected', 'success');
          loadParticipants();
        } catch (error: any) {
          console.error('Error rejecting check-in:', error);
          showAlert('Error', error.message || 'Failed to reject check-in', 'error');
        }
      },
      true
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <View style={[styles.badge, styles.badgeApproved]}>
            <CheckCircle size={14} color={Colors.light.success} />
            <Text style={[styles.badgeText, { color: Colors.light.success }]}>
              Approved
            </Text>
          </View>
        );
      case 'pending_approval':
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Clock size={14} color={Colors.light.warning} />
            <Text style={[styles.badgeText, { color: Colors.light.warning }]}>
              Pending
            </Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.badge, styles.badgeRejected]}>
            <XCircle size={14} color={Colors.light.error} />
            <Text style={[styles.badgeText, { color: Colors.light.error }]}>
              Rejected
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeNotCheckedIn]}>
            <Text style={[styles.badgeText, { color: Colors.light.textSecondary }]}>
              Not Checked In
            </Text>
          </View>
        );
    }
  };

  const renderParticipant = ({ item }: { item: OpportunitySignupWithCheckIn }) => {
    const user = item.user;
    if (!user) return null;

    return (
      <View style={styles.participantCard}>
        <View style={styles.participantHeader}>
          <View style={styles.participantInfo}>
            <UserAvatar
              avatarUrl={user.avatar_url || null}
              fullName={user.full_name}
              size={50}
              role={user.role || 'volunteer'}
              membershipTier={user.membership_tier || 'free'}
              membershipStatus={user.membership_status || 'inactive'}
              isPartnerOrganization={user.is_partner_organization}
            />
            
            <View style={styles.participantDetails}>
              {/* ✅ FIXED: Made name clickable */}
              <TouchableOpacity onPress={() => router.push(`/profile/${user.slug || user.id}`)}>
                <UserNameWithBadge
                  name={user.full_name}
                  role={user.role || 'volunteer'}
                  membershipTier={user.membership_tier || 'free'}
                  membershipStatus={user.membership_status || 'inactive'}
                  isPartnerOrganization={user.is_partner_organization}
                  style={styles.participantName}
                  badgeSize={16}
                />
              </TouchableOpacity>
              {isAdmin && (
                <View style={styles.contactInfo}>
                  <Mail size={12} color={Colors.light.textSecondary} />
                  <Text style={styles.participantEmail}>{user.email}</Text>
                </View>
              )}
              <Text style={styles.signupDate}>
                Signed up: {new Date(item.signed_up_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {getStatusBadge(item.check_in_status || 'not_checked_in')}
        </View>

        {/* Admin Actions - Show only for pending approvals */}
        {isAdmin && item.check_in_status === 'pending_approval' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item)}
            >
              <CheckCircle size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item)}
            >
              <XCircle size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show check-in time if checked in */}
        {item.checked_in && item.checked_in_at && (
          <Text style={styles.checkedInTime}>
            Checked in: {new Date(item.checked_in_at).toLocaleString()}
            {item.check_in_method && ` via ${item.check_in_method.replace('_', ' ')}`}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Overview - Only show for admins */}
      {isAdmin && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total_signups}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.light.warning }]}>
              {stats.pending_approval_count}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.light.success }]}>
              {stats.approved_count}
            </Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
        </View>
      )}

      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadParticipants();
            }}
            tintColor={Colors.light.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <User size={48} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>No participants yet</Text>
          </View>
        }
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfig.onConfirm}
        showCancel={alertConfig.showCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  participantCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  participantEmail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  signupDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeApproved: {
    backgroundColor: Colors.light.success + '20',
  },
  badgePending: {
    backgroundColor: Colors.light.warning + '20',
  },
  badgeRejected: {
    backgroundColor: Colors.light.error + '20',
  },
  badgeNotCheckedIn: {
    backgroundColor: Colors.light.border,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: Colors.light.success,
  },
  rejectButton: {
    backgroundColor: Colors.light.error,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  checkedInTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
});