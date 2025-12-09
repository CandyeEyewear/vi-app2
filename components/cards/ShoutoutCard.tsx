/**
 * ShoutoutCard Component
 * A visually distinct card for shoutout posts that recognize volunteers
 * Features gradient borders, category styling, and prominent volunteer display
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'lucide-react-native';
import { Post } from '../../types';
import { Colors } from '../../constants/colors';

interface ShoutoutCardProps {
  post: Post;
  onReaction?: (postId: string, reactionType: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
}

export default function ShoutoutCard({ post, onReaction, onComment, onShare }: ShoutoutCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  // Get category data (with fallback)
  const category = post.shoutoutCategoryData || {
    id: 'team_player',
    label: 'Team Player',
    icon: '🤝',
    color: colors.primary,
    gradientStart: colors.primary,
    gradientEnd: colors.primaryDark,
  };

  const shoutoutUser = post.shoutoutUser;
  const postCreator = post.user;

  const handleUserPress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleEventPress = () => {
    if (post.event?.id) {
      router.push(`/events/${post.event.slug || post.event.id}`);
    }
  };

  // Format timestamp (copied from FeedPostCard)
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.cardWrapper}>
      {/* Gradient Border Effect */}
      <LinearGradient
        colors={[category.gradientStart, category.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
          {/* Header - Shoutout Label + Category */}
          <View style={styles.header}>
            <View style={styles.shoutoutLabel}>
              <Text style={styles.shoutoutIcon}>🌟</Text>
              <Text style={[styles.shoutoutText, { color: colors.text }]}>Shoutout</Text>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: category.color + '20' }]}>
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[styles.categoryText, { color: category.color }]}>
                {category.label}
              </Text>
            </View>
          </View>

          {/* Featured Volunteer Section */}
          {shoutoutUser && (
            <TouchableOpacity
              style={styles.featuredSection}
              onPress={() => handleUserPress(shoutoutUser.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.featuredAvatarContainer, { borderColor: category.color }]}>
                {shoutoutUser.avatarUrl ? (
                  <Image source={{ uri: shoutoutUser.avatarUrl }} style={styles.featuredAvatar} />
                ) : (
                  <View style={[styles.featuredAvatar, styles.avatarPlaceholder, { backgroundColor: category.color }]}>
                    <Text style={styles.avatarPlaceholderText}>
                      {shoutoutUser.fullName?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.featuredInfo}>
                <Text style={[styles.featuredName, { color: colors.text }]}>
                  {shoutoutUser.fullName}
                </Text>
                {shoutoutUser.location && (
                  <Text style={[styles.featuredLocation, { color: colors.textSecondary }]}>
                    📍 {shoutoutUser.location}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Recognition Message */}
          {post.text && (
            <View style={styles.messageSection}>
              <Text style={[styles.messageText, { color: colors.text }]}>
                "{post.text}"
              </Text>
            </View>
          )}

          {/* Event Tag (if linked to an event) */}
          {post.event && (
            <TouchableOpacity
              style={[styles.eventTag, { backgroundColor: colors.primarySoft }]}
              onPress={handleEventPress}
              activeOpacity={0.7}
            >
              <Calendar size={14} color={colors.primary} />
              <Text style={[styles.eventTagText, { color: colors.primary }]}>
                {post.event.title}
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer - Given By + Timestamp */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.givenBy}
              onPress={() => postCreator && handleUserPress(postCreator.id)}
              activeOpacity={0.7}
            >
              {postCreator?.avatarUrl ? (
                <Image source={{ uri: postCreator.avatarUrl }} style={styles.creatorAvatar} />
              ) : (
                <View style={[styles.creatorAvatar, styles.creatorAvatarPlaceholder, { backgroundColor: colors.textSecondary }]}>
                  <Text style={styles.creatorAvatarText}>
                    {postCreator?.fullName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <Text style={[styles.givenByText, { color: colors.textSecondary }]}>
                Given by <Text style={{ color: colors.text, fontWeight: '600' }}>{postCreator?.fullName}</Text>
              </Text>
            </TouchableOpacity>
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>

          {/* Reactions Section - You can reuse your existing reaction component here */}
          {/* For now, showing reaction summary */}
          {post.reactionSummary && post.reactionSummary.total > 0 && (
            <View style={[styles.reactionsBar, { borderTopColor: colors.border }]}>
              <Text style={[styles.reactionsText, { color: colors.textSecondary }]}>
                {post.reactionSummary.total} {post.reactionSummary.total === 1 ? 'reaction' : 'reactions'}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 3,
  },
  cardInner: {
    borderRadius: 13,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shoutoutLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shoutoutIcon: {
    fontSize: 18,
  },
  shoutoutText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  featuredSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    marginBottom: 12,
  },
  featuredAvatarContainer: {
    borderWidth: 3,
    borderRadius: 32,
    padding: 2,
  },
  featuredAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  featuredInfo: {
    marginLeft: 12,
    flex: 1,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: '700',
  },
  featuredLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  messageSection: {
    marginBottom: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  eventTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  eventTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  givenBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  creatorAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorAvatarText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  givenByText: {
    fontSize: 13,
  },
  timestamp: {
    fontSize: 12,
  },
  reactionsBar: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  reactionsText: {
    fontSize: 13,
  },
});
