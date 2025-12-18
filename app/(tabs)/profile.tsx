/**
 * Profile Tab Screen
 * User's profile with stats, achievements, and settings
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  useColorScheme,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import { Shield, ShoppingBag, Plus, Edit, Settings, Calendar, Crown, Heart, ChevronRight } from 'lucide-react-native';
import StreakBadge from '../../components/StreakBadge';
import { UserAvatar, UserNameWithBadge } from '../../components/index';
import Head from 'expo-router/head';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../components/AnimatedPressable';

// ============================================
// WEB-COMPATIBLE ALERT HELPERS
// ============================================
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'OK', onPress: onConfirm },
    ]);
  }
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { user, signOut, isAdmin, isSup, refreshUser } = useAuth();
  const isPremium = user?.membershipTier === 'premium' && user?.membershipStatus === 'active';
  const isOfficialMember = isPremium || isAdmin;
  const hasProposeAccess = isOfficialMember;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        try {
            await signOut();
            router.replace('/login');
        } catch (error) {
          console.error('Logout error:', error);
          showAlert(
            'Logout Error',
            'Failed to logout. Please try again.'
          );
        }
      }
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Not logged in</Text>
      </View>
    );
  }

  const getAchievements = () => {
    const achievements = [];
    
    if (user.totalHours >= 10) {
      achievements.push({
        id: '1',
        name: 'Time Keeper',
        description: '10+ hours volunteered',
      });
    }
    
    if (user.activitiesCompleted >= 5) {
      achievements.push({
        id: '2',
        name: 'Community Hero',
        description: '5+ activities completed',
      });
    }
    
    if (user.organizationsHelped >= 3) {
      achievements.push({
        id: '3',
        name: 'Impact Maker',
        description: '3+ organizations helped',
      });
    }

    return achievements;
  };

  const achievements = getAchievements();

  const surfaceShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    web: {
      // RN-web supports `shadow*` inconsistently; keep it simple.
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    default: {},
  });

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.card }]} 
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Head>
        <title>Profile | VIbe</title>
      </Head>
      {!isDesktop && (
        <View style={[styles.header, { paddingTop: insets.top + 32, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.avatarSection}>
          <UserAvatar
            avatarUrl={user.avatarUrl || null}
            fullName={user.fullName}
            size={100}
            role={user.role || 'volunteer'}
            membershipTier={user.membershipTier || 'free'}
            membershipStatus={user.membershipStatus || 'inactive'}
            isPartnerOrganization={user.is_partner_organization}
          />
        </View>
        <UserNameWithBadge
          name={user.fullName}
          role={user.role || 'volunteer'}
          membershipTier={user.membershipTier || 'free'}
          membershipStatus={user.membershipStatus || 'inactive'}
          isPartnerOrganization={user.is_partner_organization}
          nameStyle={[styles.name, { color: colors.text }]}
          badgeSize={20}
        />
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
        {user.location && (
          <Text style={[styles.location, { color: colors.textSecondary }]}>{user.location}</Text>
        )}
        {user.dateOfBirth && (
          <View style={[styles.ageRow, { marginTop: 8 }]}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={[styles.ageText, { color: colors.textSecondary, marginLeft: 8 }]}>
              {(() => {
                const calculateAge = (dob: string) => {
                  const today = new Date();
                  const birthDate = new Date(dob);
                  let age = today.getFullYear() - birthDate.getFullYear();
                  const monthDiff = today.getMonth() - birthDate.getMonth();
                  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                  }
                  return age;
                };
                return `${calculateAge(user.dateOfBirth)} years old`;
              })()}
            </Text>
          </View>
        )}
      </View>
      )}

      {/* 🔥 STREAK BADGE - Shows if user has a streak */}
      {user.currentStreak && user.currentStreak > 0 && (
        <View style={styles.streakSection}>
          <StreakBadge 
            currentStreak={user.currentStreak}
            longestStreak={user.longestStreak}
            size="medium"
          />
        </View>
      )}

      {/* Super Admin Dashboard Access - Only visible to super admins */}
      {isAdmin && (
        <AnimatedPressable
          style={[styles.adminCard, surfaceShadow, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/admin-dashboard')}
        >
          <View style={styles.adminCardContent}>
            <Shield size={32} color="#FFFFFF" strokeWidth={2} />
            <View style={styles.adminCardText}>
              <Text style={styles.adminCardTitle}>Super Admin Dashboard</Text>
              <Text style={styles.adminCardSubtitle}>
                Manage opportunities, posts, and users
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      )}

      {/* Admin Dashboard Access - Only visible to supervisors */}
      {isSup && (
        <AnimatedPressable
          style={[styles.adminCard, surfaceShadow, { backgroundColor: '#10B981' }]}
          onPress={() => router.push('/supervisor-dashboard')}
        >
          <View style={styles.adminCardContent}>
            <Shield size={32} color="#FFFFFF" strokeWidth={2} />
            <View style={styles.adminCardText}>
              <Text style={styles.adminCardTitle}>Admin Dashboard</Text>
              <Text style={styles.adminCardSubtitle}>
                Manage opportunities, events, and announcements
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      )}

      {/* Bio */}
      {user.bio && (
        <View style={styles.section}>
          <Text style={styles.bio}>{user.bio}</Text>
        </View>
      )}

      {/* Stats - Only visible to Official Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Impact Statistics</Text>
        {isOfficialMember ? (
          <View style={styles.statsGrid}>
            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>{user.totalHours}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
                Hours
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>{user.activitiesCompleted}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
                {user.activitiesCompleted === 1 ? 'Activity' : 'Activities'}
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={[colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>{user.organizationsHelped}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
                Entity/Org
              </Text>
            </LinearGradient>
          </View>
        ) : (
          <View style={[styles.membershipPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Crown size={32} color={colors.tint} />
            <Text style={[styles.membershipPromptTitle, { color: colors.text }]}>
              Become an Official Member
            </Text>
            <Text style={[styles.membershipPromptText, { color: colors.textSecondary }]}>
              Unlock your Impact Statistics and see your volunteer contributions
            </Text>
            <AnimatedPressable
              style={[styles.becomeMemberButton, surfaceShadow, { backgroundColor: colors.tint }]}
              onPress={() => router.push('/membership/subscribe')}
            >
              <Text style={styles.becomeMemberButtonText}>Become a Member</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>

      {/* Achievements */}
      {achievements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement) => (
              <View key={achievement.id} style={styles.achievementCard}>
                <Text style={styles.achievementName}>{achievement.name}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Additional Info */}
      {(user.education || (user.areasOfExpertise && user.areasOfExpertise.length > 0)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Info</Text>
          
          {user.education && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Education</Text>
              <Text style={styles.infoValue}>{user.education}</Text>
            </View>
          )}
          
          {user.areasOfExpertise && user.areasOfExpertise.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Areas of Expertise</Text>
              <View style={styles.expertiseContainer}>
                {user.areasOfExpertise.map((expertise, index) => (
                  <View key={index} style={styles.expertiseChip}>
                    <Text style={styles.expertiseText}>{expertise}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <View style={styles.actionButtonsContainer}>
          <AnimatedPressable
            style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={[styles.actionButtonIcon, { backgroundColor: colors.primary + '15' }]}>
              <Edit size={20} color={colors.primary} />
            </View>
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Edit Profile</Text>
          </AnimatedPressable>

          {!isAdmin && (
            <AnimatedPressable
              style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/propose-opportunity')}
            >
              <View style={[styles.actionButtonIcon, { backgroundColor: colors.primary + '15' }]}>
                <Plus size={20} color={colors.primary} />
              </View>
              <View style={styles.actionButtonTextContainer}>
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Propose Opportunity</Text>
                {!hasProposeAccess && (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color="#38B6FF" fill="#38B6FF" />
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                )}
              </View>
            </AnimatedPressable>
          )}

          <AnimatedPressable
            style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/vi-shopp-screen')}
          >
            <View style={[styles.actionButtonIcon, { backgroundColor: colors.primary + '15' }]}>
              <ShoppingBag size={20} color={colors.primary} />
            </View>
            <Text style={[styles.actionButtonText, { color: colors.text }]}>VI Shopp</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/settings')}
          >
            <View style={[styles.actionButtonIcon, { backgroundColor: colors.primary + '15' }]}>
              <Settings size={20} color={colors.primary} />
            </View>
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Settings</Text>
          </AnimatedPressable>

          {/* My Donations */}
          <AnimatedPressable
            style={[styles.menuItem, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/donation-history')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: '#E91E63' + '15' }]}>
              <Heart size={22} color="#E91E63" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>My Donations</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                View your donation history
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </AnimatedPressable>

          {/* My Events */}
          <AnimatedPressable
            style={[styles.menuItem, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/my-events')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Calendar size={22} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>My Events</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                View your registered events and tickets
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </AnimatedPressable>

          {/* Membership / Partner Membership */}
          <AnimatedPressable
            style={[styles.menuItem, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/membership')}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: user?.account_type === 'organization' ? '#FFC107' + '15' : '#38B6FF' + '15' }]}>
              <Crown size={22} color={user?.account_type === 'organization' ? '#FFC107' : '#38B6FF'} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                {user?.account_type === 'organization' 
                  ? (user?.is_partner_organization && user?.membershipStatus === 'active'
                      ? 'Partner Membership'
                      : 'Partner Membership')
                  : (user?.membershipTier === 'premium' && user?.membershipStatus === 'active'
                      ? 'View Membership'
                      : 'Upgrade Membership')}
              </Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                {user?.account_type === 'organization' 
                  ? (user?.is_partner_organization && user?.membershipStatus === 'active'
                      ? 'Partner Organization ✓'
                      : 'Complete Payment to Activate')
                  : (user?.membershipTier === 'premium' && user?.membershipStatus === 'active' 
                      ? 'Official Member ✓' 
                      : 'Upgrade to Full Membership')}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </AnimatedPressable>
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <AnimatedPressable style={[styles.logoutButton, surfaceShadow]} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </AnimatedPressable>
      </View>

      {/* Member Since */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Member since {new Date(user.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.card,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
  },
  // 🔥 Streak Section
  streakSection: {
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  // Admin Card Styles
  adminCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  adminCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adminCardText: {
    flex: 1,
  },
  adminCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  adminCardSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  section: {
    backgroundColor: Colors.light.background,
    padding: 16,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  bio: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  membershipPrompt: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  membershipPromptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  membershipPromptText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  becomeMemberButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  becomeMemberButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: '48%',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  achievementDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  infoRow: {
    marginBottom: 16,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageText: {
    fontSize: 14,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.light.text,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expertiseChip: {
    backgroundColor: Colors.light.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  expertiseText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  actionButtonsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#38B6FF15',
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38B6FF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
  },
  logoutSection: {
    padding: 16,
    paddingTop: 0,
  },
  logoutButton: {
    backgroundColor: Colors.light.error,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
    marginTop: 32,
  },
});