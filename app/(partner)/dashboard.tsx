/**
 * Partner Dashboard Screen
 * Scoped metrics and quick actions for partner organizations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import {
  Building2,
  Users,
  Clock,
  Award,
  Mail,
  ChevronLeft,
  UserPlus,
} from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const PARTNER_COLOR = '#F59E0B';

interface DashboardStats {
  teamMemberCount: number;
  totalTeamHours: number;
  totalActivitiesCompleted: number;
  pendingInvites: number;
}

export default function PartnerDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isPartner } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const surfaceShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    web: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    default: {},
  });

  const orgName = user?.organization_data?.organization_name || user?.fullName || 'Partner';

  useEffect(() => {
    if (user?.id) loadDashboardStats();
  }, [user?.id]);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // Team members count
      const { count: memberCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('partner_org_id', user!.id);

      // Team hours and activities
      const { data: teamData } = await supabase
        .from('users')
        .select('total_hours, activities_completed')
        .eq('partner_org_id', user!.id);

      const totalHours = teamData?.reduce((sum, m) => sum + (m.total_hours || 0), 0) || 0;
      const totalActivities = teamData?.reduce((sum, m) => sum + (m.activities_completed || 0), 0) || 0;

      // Pending invites
      const { count: inviteCount } = await supabase
        .from('partner_invites')
        .select('*', { count: 'exact', head: true })
        .eq('partner_org_id', user!.id)
        .eq('status', 'pending');

      setStats({
        teamMemberCount: memberCount || 0,
        totalTeamHours: totalHours,
        totalActivitiesCompleted: totalActivities,
        pendingInvites: inviteCount || 0,
      });
    } catch (error) {
      console.error('[PARTNER DASHBOARD] Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isPartner) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </AnimatedPressable>
        </View>
        <View style={styles.errorContainer}>
          <Building2 size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            Access Denied
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            Partner organization access required
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <Building2 size={28} color={PARTNER_COLOR} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Partner Dashboard
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            {orgName}
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Manage your team and track volunteer activity
          </Text>
        </View>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PARTNER_COLOR} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading dashboard...
            </Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {/* Team Members */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: PARTNER_COLOR + '15' }]}>
                <Users size={24} color={PARTNER_COLOR} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.teamMemberCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Team Members
              </Text>
            </LinearGradient>

            {/* Total Hours */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#10B981' + '15' }]}>
                <Clock size={24} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalTeamHours || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Team Hours
              </Text>
            </LinearGradient>

            {/* Activities Completed */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#6366F1' + '15' }]}>
                <Award size={24} color="#6366F1" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalActivitiesCompleted || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Activities
              </Text>
            </LinearGradient>

            {/* Pending Invites */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#EC4899' + '15' }]}>
                <Mail size={24} color="#EC4899" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.pendingInvites || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Pending Invites
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </Text>

          {/* Invite Team Members */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(partner)/invite-members')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: PARTNER_COLOR + '15' }]}>
              <UserPlus size={24} color={PARTNER_COLOR} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Invite Team Members
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Send invitations to join your organization
              </Text>
            </View>
          </AnimatedPressable>

          {/* View Team */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(partner)/team-members')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#10B981' + '15' }]}>
              <Users size={24} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                View Team
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                See all team members and their activity
              </Text>
            </View>
          </AnimatedPressable>
        </View>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    gap: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
});
