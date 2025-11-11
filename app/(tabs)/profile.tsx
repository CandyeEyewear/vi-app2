/**
 * Profile Tab Screen
 * User's profile with stats, achievements, and settings
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import { Shield } from 'lucide-react-native';
import StreakBadge from '../../components/StreakBadge';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.card }]} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 32, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.avatarSection}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={[styles.avatar, { borderColor: colors.primary }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user.fullName}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
        {user.location && (
          <Text style={[styles.location, { color: colors.textSecondary }]}>{user.location}</Text>
        )}
      </View>

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

      {/* Admin Dashboard Access - Only visible to admins */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.adminCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/admin-dashboard')}
          activeOpacity={0.8}
        >
          <View style={styles.adminCardContent}>
            <Shield size={32} color="#FFFFFF" strokeWidth={2} />
            <View style={styles.adminCardText}>
              <Text style={styles.adminCardTitle}>Admin Dashboard</Text>
              <Text style={styles.adminCardSubtitle}>
                Manage opportunities, posts, and users
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Bio */}
      {user.bio && (
        <View style={styles.section}>
          <Text style={styles.bio}>{user.bio}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Impact Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user.totalHours}</Text>
            <Text style={styles.statLabel}>Hours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user.activitiesCompleted}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user.organizationsHelped}</Text>
            <Text style={styles.statLabel}>Organizations</Text>
          </View>
        </View>
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
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/edit-profile')}
        >
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.actionButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
    fontSize: 14,
    color: Colors.light.textSecondary,
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
  actionButton: {
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
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