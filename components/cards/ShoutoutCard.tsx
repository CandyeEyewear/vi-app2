/**
 * ShoutoutCard Component
 * A visually distinct card for shoutout posts that recognize volunteers
 * Features gradient borders, category styling, and prominent volunteer display
 */

import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import MentionText from '../MentionText';

interface CoSigner {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

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
  
  // Co-Sign state and hooks
  const { user: currentUser } = useAuth();
  const [coSigners, setCoSigners] = useState<CoSigner[]>([]);
  const [hasCoSigned, setHasCoSigned] = useState(false);
  const [isCoSigning, setIsCoSigning] = useState(false);

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

  // Load co-signers
  useEffect(() => {
    loadCoSigners();
  }, [post.id]);

  const loadCoSigners = async () => {
    try {
      const { data, error } = await supabase
        .from('post_cosigns')
        .select(`
          user_id,
          user:users!post_cosigns_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        const signers: CoSigner[] = data.map((r: any) => ({
          id: r.user?.id || r.user_id,
          fullName: r.user?.full_name || 'Unknown',
          avatarUrl: r.user?.avatar_url,
        }));
        setCoSigners(signers);
        
        // Check if current user has co-signed
        if (currentUser) {
          setHasCoSigned(signers.some(s => s.id === currentUser.id));
        }
      }
    } catch (error) {
      console.error('[SHOUTOUT] Error loading co-signers:', error);
    }
  };

  const handleCoSign = async () => {
    if (!currentUser || isCoSigning) return;
    
    setIsCoSigning(true);
    try {
      if (hasCoSigned) {
        // Remove co-sign
        const { error } = await supabase
          .from('post_cosigns')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);
        if (error) throw error;
        setCoSigners(prev => prev.filter(s => s.id !== currentUser.id));
        setHasCoSigned(false);
      } else {
        // Add co-sign
        const { error } = await supabase
          .from('post_cosigns')
          .insert({
            post_id: post.id,
            user_id: currentUser.id,
          });
        if (error) throw error;
        setCoSigners(prev => [{
          id: currentUser.id,
          fullName: currentUser.fullName || 'You',
          avatarUrl: currentUser.avatarUrl,
        }, ...prev]);
        setHasCoSigned(true);
      }
    } catch (error) {
      console.error('[SHOUTOUT] Error toggling co-sign:', error);
    } finally {
      setIsCoSigning(false);
    }
  };

  const formatCoSigners = () => {
    if (coSigners.length === 0) return null;
    
    const names = coSigners.map(s => s.id === currentUser?.id ? 'You' : s.fullName.split(' ')[0]);
    
    if (names.length === 1) {
      return `Co-signed by ${names[0]}`;
    } else if (names.length === 2) {
      return `Co-signed by ${names[0]} and ${names[1]}`;
    } else if (names.length === 3) {
      return `Co-signed by ${names[0]}, ${names[1]}, and ${names[2]}`;
    } else {
      const othersCount = names.length - 2;
      return `Co-signed by ${names[0]}, ${names[1]}, and ${othersCount} other${othersCount > 1 ? 's' : ''}`;
    }
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
              <Text style={[styles.messageText, styles.messageQuote, { color: colors.text }]}>
                "
              </Text>
              <MentionText
                text={post.text || ''}
                style={[styles.messageText, styles.messageBody, { color: colors.text }]}
              />
              <Text style={[styles.messageText, styles.messageQuote, { color: colors.text }]}>
                "
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

          {/* Co-Sign Section */}
          <View style={[styles.coSignSection, { borderTopColor: colors.border }]}>
            {/* Co-Signers List */}
            {coSigners.length > 0 && (
              <View style={styles.coSignersRow}>
                {/* Avatar Stack */}
                <View style={styles.coSignerAvatars}>
                  {coSigners.slice(0, 3).map((signer, index) => (
                    <View 
                      key={signer.id} 
                      style={[
                        styles.coSignerAvatarContainer,
                        { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
                      ]}
                    >
                      {signer.avatarUrl ? (
                        <Image source={{ uri: signer.avatarUrl }} style={styles.coSignerAvatar} />
                      ) : (
                        <View style={[styles.coSignerAvatar, styles.coSignerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.coSignerAvatarText}>
                            {signer.fullName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                {/* Names */}
                <Text style={[styles.coSignersText, { color: colors.textSecondary }]}>
                  {formatCoSigners()}
                </Text>
              </View>
            )}
            
            {/* Co-Sign Button */}
            <TouchableOpacity
              style={[
                styles.coSignButton,
                hasCoSigned 
                  ? { backgroundColor: colors.primary } 
                  : { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primary }
              ]}
              onPress={handleCoSign}
              disabled={isCoSigning}
              activeOpacity={0.8}
            >
              <Text style={styles.coSignIcon}>{hasCoSigned ? '✓' : '✍️'}</Text>
              <Text style={[
                styles.coSignButtonText,
                { color: hasCoSigned ? '#FFFFFF' : colors.primary }
              ]}>
                {isCoSigning ? 'Saving...' : hasCoSigned ? 'Co-Signed' : 'Co-Sign'}
              </Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  messageQuote: {
    marginHorizontal: 2,
  },
  messageBody: {
    flexShrink: 1,
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
  coSignSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  coSignersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  coSignerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coSignerAvatarContainer: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
  },
  coSignerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  coSignerAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coSignerAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  coSignersText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  coSignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
  },
  coSignIcon: {
    fontSize: 16,
  },
  coSignButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
