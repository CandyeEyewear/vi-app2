/**
 * Admin Dashboard Screen
 * Main control panel for administrators
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
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { 
  Shield, 
  Users, 
  Calendar,
  FileText,
  Megaphone,
  Settings,
  ChevronLeft,
  TrendingUp,
  Clock,
  MapPin,
  MessageSquare,
  Heart,
  CreditCard,
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import { calculateTotalRaisedAllCauses } from '../services/causesService';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../components/AnimatedPressable';

interface DashboardStats {
  totalVolunteers: number;
  activeOpportunities: number;
  pendingPosts: number;
  totalPosts: number;
  totalVolunteerHours: number;
  pendingOpportunityProposals: number;
  totalCauses: number;
  totalRaised: number;
  pendingOrganizations: number; // NEW
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
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

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // Get total volunteers (users with role = 'volunteer')
      const { count: volunteersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'volunteer');

      // Get active opportunities
      const { count: opportunitiesCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total posts
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Get total volunteer hours from all users
      const { data: usersData } = await supabase
        .from('users')
        .select('total_hours');

      const totalHours = usersData?.reduce((sum, user) => sum + (user.total_hours || 0), 0) || 0;

      // Get pending opportunity proposals
      const { count: pendingProposalsCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('proposal_status', 'pending');

      // Get total active causes
      const { count: causesCount } = await supabase
        .from('causes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total amount raised across all causes from actual donations (single source of truth)
      const totalRaised = await calculateTotalRaisedAllCauses();

      // Get pending organization applications
      const { count: pendingOrgsCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'organization')
        .eq('approval_status', 'pending');

      setStats({
        totalVolunteers: volunteersCount || 0,
        activeOpportunities: opportunitiesCount || 0,
        pendingPosts: 0, // We'll implement moderation later
        totalPosts: postsCount || 0,
        totalVolunteerHours: totalHours,
        pendingOpportunityProposals: pendingProposalsCount || 0,
        totalCauses: causesCount || 0,
        totalRaised: totalRaised,
        pendingOrganizations: pendingOrgsCount || 0, // NEW
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safety check - shouldn't happen since we check in profile
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </AnimatedPressable>
        </View>
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            Access Denied
          </Text>
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
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <Shield size={28} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Admin Dashboard
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
            Welcome back, {user?.fullName}
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Here's what's happening with VIbe today
          </Text>
        </View>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading dashboard...
            </Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {/* Total Volunteers */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Users size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalVolunteers || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Volunteers
              </Text>
            </LinearGradient>

            {/* Active Opportunities */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#10B981' + '15' }]}>
                <Calendar size={24} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.activeOpportunities || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Opportunities
              </Text>
            </LinearGradient>

            {/* Total Posts */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#F59E0B' + '15' }]}>
                <MessageSquare size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalPosts || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Posts
              </Text>
            </LinearGradient>

            {/* Total Volunteer Hours */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#8B5CF6' + '15' }]}>
                <Clock size={24} color="#8B5CF6" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalVolunteerHours || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Volunteer Hours
              </Text>
            </LinearGradient>

            {/* Total Causes */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#E91E63' + '15' }]}>
                <Heart size={24} color="#E91E63" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalCauses || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Causes
              </Text>
            </LinearGradient>

            {/* Total Raised */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' + '15' }]}>
                <TrendingUp size={24} color="#4CAF50" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                J${((stats?.totalRaised || 0) / 1000).toFixed(0)}K
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Raised
              </Text>
            </LinearGradient>

            {/* Pending Organizations */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#FFC107' + '15' }]}>
                <Users size={24} color="#FFC107" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.pendingOrganizations || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Pending Organizations
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </Text>

          {/* Opportunities */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/admin-opportunity')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Calendar size={24} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Opportunities
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage or create volunteering opportunities
              </Text>
            </View>
          </AnimatedPressable>

          {/* Causes */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/admin-cause')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#E91E63' + '15' }]}>
              <Heart size={24} color="#E91E63" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Causes
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage or create fundraising campaigns
              </Text>
            </View>
          </AnimatedPressable>

          {/* Events */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/admin-event')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
              <Calendar size={24} color="#FF9800" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Events
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage or create community events
              </Text>
            </View>
          </AnimatedPressable>

          {/* Post Moderation */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/moderation-dashboard')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.error + '15' }]}>
              <Shield size={28} color={colors.error} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Post Moderation
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Review and manage community posts
              </Text>
            </View>
          </AnimatedPressable>

          {/* Create Announcement */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/create-announcement')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#10B981' + '15' }]}>
              <Megaphone size={24} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Create Announcement
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Post important updates to all volunteers
              </Text>
            </View>
          </AnimatedPressable>

          {/* Opportunity Reviews */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/opportunity-reviews')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#F59E0B' + '15' }]}>
              <FileText size={24} color="#F59E0B" />
              {stats && stats.pendingOpportunityProposals > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {stats.pendingOpportunityProposals > 99 ? '99+' : stats.pendingOpportunityProposals}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Opportunity Reviews
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Review pending opportunity proposals
                {stats && stats.pendingOpportunityProposals > 0 && (
                  <Text style={{ fontWeight: '600', color: colors.error }}>
                    {' '}({stats.pendingOpportunityProposals} pending)
                  </Text>
                )}
              </Text>
            </View>
          </AnimatedPressable>

          {/* User Management */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/user-management')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Users size={24} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                User Management
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage volunteer accounts and permissions
              </Text>
            </View>
          </AnimatedPressable>

          {/* Subscriptions */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/subscriptions')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#3B82F6' + '15' }]}>
              <CreditCard size={24} color="#3B82F6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Subscriptions
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage plans and manually assign memberships
              </Text>
            </View>
          </AnimatedPressable>

          {/* Organization Applications */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/organization-applications')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFC107' + '15' }]}>
              <Users size={24} color="#FFC107" />
              {stats && stats.pendingOrganizations > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {stats.pendingOrganizations > 99 ? '99+' : stats.pendingOrganizations}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Organization Applications
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Review pending partner organization requests
                {stats && stats.pendingOrganizations > 0 && (
                  <Text style={{ fontWeight: '600', color: colors.error }}>
                    {' '}({stats.pendingOrganizations} pending)
                  </Text>
                )}
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
    paddingBottom: 32,
  },
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    width: '48%',
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
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
