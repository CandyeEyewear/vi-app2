/**
 * Admin Dashboard Screen
 * Main control panel for administrators
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
  MessageSquare
} from 'lucide-react-native';
import { supabase } from '../services/supabase';

interface DashboardStats {
  totalVolunteers: number;
  activeOpportunities: number;
  pendingPosts: number;
  totalPosts: number;
  totalVolunteerHours: number;
  pendingOpportunityProposals: number;
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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

      setStats({
        totalVolunteers: volunteersCount || 0,
        activeOpportunities: opportunitiesCount || 0,
        pendingPosts: 0, // We'll implement moderation later
        totalPosts: postsCount || 0,
        totalVolunteerHours: totalHours,
        pendingOpportunityProposals: pendingProposalsCount || 0,
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
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
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Users size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalVolunteers || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Volunteers
              </Text>
            </View>

            {/* Active Opportunities */}
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#10B981' + '15' }]}>
                <Calendar size={24} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.activeOpportunities || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Opportunities
              </Text>
            </View>

            {/* Total Posts */}
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#F59E0B' + '15' }]}>
                <MessageSquare size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalPosts || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Posts
              </Text>
            </View>

            {/* Total Volunteer Hours */}
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#8B5CF6' + '15' }]}>
                <Clock size={24} color="#8B5CF6" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalVolunteerHours || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Volunteer Hours
              </Text>
            </View>
          </View>
        )}

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </Text>

          {/* Create Opportunity */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/create-opportunity')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Calendar size={24} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Create Opportunity
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Add a new volunteering opportunity
              </Text>
            </View>
          </TouchableOpacity>

          {/* Post Moderation */}
          <TouchableOpacity
  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
  onPress={() => router.push('/moderation-dashboard')}
>
  <View style={[styles.actionIcon, { backgroundColor: colors.error + '15' }]}>
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
          </TouchableOpacity>

          {/* Create Announcement */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/create-announcement')}
            activeOpacity={0.7}
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
          </TouchableOpacity>

          {/* Opportunity Reviews */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(admin)/opportunity-reviews')}
            activeOpacity={0.7}
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
          </TouchableOpacity>

          {/* User Management */}
          <TouchableOpacity
  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
  onPress={() => router.push('/user-management')}
>
  <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
    <Users size={28} color={colors.primary} />
  </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                User Management
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Manage volunteer accounts and permissions
              </Text>
            </View>
          </TouchableOpacity>
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
