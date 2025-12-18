/**
 * Supervisor Dashboard Screen
 * Limited control panel for supervisors (opportunities, events, announcements only)
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
  Calendar,
  Megaphone,
  ChevronLeft,
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../components/AnimatedPressable';

interface DashboardStats {
  activeOpportunities: number;
  totalEvents: number;
  totalAnnouncements: number;
}

export default function SupervisorDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isSup } = useAuth();
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

      // Get active opportunities
      const { count: opportunitiesCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total events
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      // Get total announcements
      const { count: announcementsCount } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true });

      setStats({
        activeOpportunities: opportunitiesCount || 0,
        totalEvents: eventsCount || 0,
        totalAnnouncements: announcementsCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safety check - shouldn't happen since we check in profile
  if (!isSup) {
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
          <Shield size={28} color="#10B981" />
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
            Manage opportunities, events, and announcements
          </Text>
        </View>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading dashboard...
            </Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
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

            {/* Total Events */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' + '15' }]}>
                <Calendar size={24} color="#FF9800" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalEvents || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Events
              </Text>
            </LinearGradient>

            {/* Total Announcements */}
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
                <Megaphone size={24} color="#9C27B0" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats?.totalAnnouncements || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Announcements
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
            onPress={() => router.push('/supervisor-opportunity')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#10B981' + '15' }]}>
              <Calendar size={24} color="#10B981" />
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

          {/* Events */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/supervisor-event')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' + '15' }]}>
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

          {/* Announcements */}
          <AnimatedPressable
            style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/supervisor-announcement')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
              <Megaphone size={24} color="#9C27B0" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                Announcements
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Create and manage announcements
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
    minWidth: '30%',
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

