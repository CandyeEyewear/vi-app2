/**
 * Skeleton Layouts Component
 * Pre-made skeleton layouts for common UI patterns
 * Facebook/Instagram-style loading placeholders
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { Colors } from '../constants/colors';

// ========== FEED POST SKELETON ==========
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.feedCard}>
          {/* Header */}
          <View style={styles.feedHeader}>
            <Skeleton variant="circle" width={40} height={40} />
            <View style={styles.feedHeaderText}>
              <Skeleton width={120} height={16} style={styles.feedName} />
              <Skeleton width={80} height={12} />
            </View>
          </View>

          {/* Post Text */}
          <View style={styles.feedText}>
            <Skeleton width="100%" height={14} style={styles.feedTextLine} />
            <Skeleton width="90%" height={14} style={styles.feedTextLine} />
            <Skeleton width="75%" height={14} />
          </View>

          {/* Image */}
          <Skeleton width="100%" height={300} borderRadius={0} />

          {/* Actions */}
          <View style={styles.feedActions}>
            <Skeleton width={60} height={20} />
            <Skeleton width={80} height={20} />
            <Skeleton width={60} height={20} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ========== OPPORTUNITY SKELETON ==========
export function OpportunitiesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.opportunityCard}>
          {/* Image */}
          <Skeleton width="100%" height={200} borderRadius={0} />

          {/* Content */}
          <View style={styles.opportunityContent}>
            <Skeleton width={100} height={20} style={styles.opportunityCategory} />
            <Skeleton width="85%" height={24} style={styles.opportunityTitle} />
            <Skeleton width="70%" height={18} style={styles.opportunityOrg} />

            <View style={styles.opportunityMeta}>
              <Skeleton width={120} height={16} />
              <Skeleton width={100} height={16} />
            </View>

            <Skeleton width="100%" height={14} style={styles.opportunityDesc} />
            <Skeleton width="90%" height={14} style={styles.opportunityDesc} />
            <Skeleton width="75%" height={14} />

            <Skeleton width="100%" height={44} borderRadius={8} style={styles.opportunityButton} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ========== NOTIFICATION SKELETON ==========
export function NotificationsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.notificationItem}>
          <Skeleton variant="circle" width={48} height={48} />
          <View style={styles.notificationContent}>
            <Skeleton width="75%" height={16} style={styles.notificationTitle} />
            <Skeleton width="90%" height={14} style={styles.notificationMessage} />
            <Skeleton width={80} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ========== CONVERSATION SKELETON ==========
export function ConversationsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.conversationItem}>
          <Skeleton variant="circle" width={56} height={56} />
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Skeleton width={120} height={18} />
              <Skeleton width={60} height={14} />
            </View>
            <Skeleton width="80%" height={16} style={styles.conversationPreview} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ========== USER PROFILE SKELETON ==========
export function UserProfileSkeleton() {
  return (
    <View style={styles.profileContainer}>
      {/* Header */}
      <View style={styles.profileHeader}>
        <Skeleton variant="circle" width={100} height={100} />
        <View style={styles.profileInfo}>
          <Skeleton width={150} height={24} style={styles.profileName} />
          <Skeleton width={120} height={16} style={styles.profileLocation} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={20} />
          <Skeleton width={60} height={14} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={20} />
          <Skeleton width={60} height={14} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={20} />
          <Skeleton width={60} height={14} />
        </View>
      </View>

      {/* Bio */}
      <View style={styles.profileBio}>
        <Skeleton width="100%" height={14} style={styles.profileBioLine} />
        <Skeleton width="95%" height={14} style={styles.profileBioLine} />
        <Skeleton width="85%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  // Feed Skeleton
  feedCard: {
    backgroundColor: Colors.light.background,
    marginBottom: 8,
    paddingBottom: 12,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  feedHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  feedName: {
    marginBottom: 6,
  },
  feedText: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  feedTextLine: {
    marginBottom: 6,
  },
  feedActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  // Opportunity Skeleton
  opportunityCard: {
    backgroundColor: Colors.light.background,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  opportunityContent: {
    padding: 16,
  },
  opportunityCategory: {
    marginBottom: 8,
  },
  opportunityTitle: {
    marginBottom: 6,
  },
  opportunityOrg: {
    marginBottom: 12,
  },
  opportunityMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  opportunityDesc: {
    marginBottom: 6,
  },
  opportunityButton: {
    marginTop: 16,
  },
  // Notification Skeleton
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    marginBottom: 6,
  },
  notificationMessage: {
    marginBottom: 6,
  },
  // Conversation Skeleton
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  conversationPreview: {
    marginTop: 4,
  },
  // Profile Skeleton
  profileContainer: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    marginBottom: 8,
  },
  profileLocation: {
    marginBottom: 4,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 24,
  },
  profileStat: {
    alignItems: 'center',
    gap: 6,
  },
  profileBio: {
    marginBottom: 16,
  },
  profileBioLine: {
    marginBottom: 6,
  },
});

