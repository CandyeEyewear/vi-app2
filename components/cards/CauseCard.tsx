/**
 * CauseCard Component
 * Displays a single fundraising cause in a card format
 * File: components/cards/CauseCard.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { Heart, Users, Clock, TrendingUp, Share2 } from 'lucide-react-native';
import { Cause, CauseCategory } from '../../types';
import { Colors } from '../../constants/colors';
import { getCauseProgress, getCauseDaysRemaining, formatCurrency } from '../../services/causesService';
import { useFeed } from '../../contexts/FeedContext';
import ShareCauseModal from '../ShareCauseModal';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

interface CauseCardProps {
  cause: Cause;
  onPress?: () => void;
  onDonatePress?: () => void;
}

// Category colors and labels
const CATEGORY_CONFIG: Record<CauseCategory, { label: string; color: string; emoji: string }> = {
  disaster_relief: { label: 'Disaster Relief', color: '#E53935', emoji: '🆘' },
  education: { label: 'Education', color: '#1E88E5', emoji: '📚' },
  healthcare: { label: 'Healthcare', color: '#43A047', emoji: '🏥' },
  environment: { label: 'Environment', color: '#7CB342', emoji: '🌱' },
  community: { label: 'Community', color: '#FB8C00', emoji: '🏘️' },
  poverty: { label: 'Poverty Relief', color: '#8E24AA', emoji: '💝' },
  other: { label: 'Other', color: '#757575', emoji: '📋' },
};

export function CauseCard({ cause, onPress, onDonatePress }: CauseCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { shareCauseToFeed } = useFeed();
  
  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);
  const categoryConfig = CATEGORY_CONFIG[cause.category] || CATEGORY_CONFIG.other;

  const handleDonatePress = (e: any) => {
    e.stopPropagation();
    onDonatePress?.();
  };

  const handleSharePress = (e: any) => {
    e.stopPropagation();
    setShowShareModal(true);
  };

  const handleShare = async (comment?: string, visibility?: 'public' | 'circle') => {
    setSharing(true);
    const response = await shareCauseToFeed(cause.id, comment, visibility);
    setSharing(false);
    
    if (response.success) {
      setShowShareModal(false);
    }
  };

  return (
    <>
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Cause: ${cause.title}. ${Math.round(progress)}% funded.`}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {cause.imageUrl ? (
          <Image
            source={{ uri: cause.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
            <Heart size={40} color={colors.textSecondary} />
          </View>
        )}
        
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
          <Text style={styles.categoryBadgeText}>
            {categoryConfig.emoji} {categoryConfig.label}
          </Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          onPress={handleSharePress}
          style={styles.shareButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Share2 size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Featured Badge */}
        {cause.isFeatured && (
          <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
            <TrendingUp size={12} color="#000" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {cause.title}
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {cause.description}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: progress >= 100 ? '#4CAF50' : '#38B6FF',
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.text }]}>
            {Math.round(progress)}%
          </Text>
        </View>

        {/* Amount Info */}
        <View style={styles.amountContainer}>
          <Text style={[styles.amountRaised, { color: colors.text }]}>
            {formatCurrency(cause.amountRaised)}
          </Text>
          <Text style={[styles.amountGoal, { color: colors.textSecondary }]}>
            {' '}raised of {formatCurrency(cause.goalAmount)} goal
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Users size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {cause.donorCount} {cause.donorCount === 1 ? 'donor' : 'donors'}
            </Text>
          </View>
          
          {daysRemaining !== null && (
            <View style={styles.statItem}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {daysRemaining === 0 
                  ? 'Ends today' 
                  : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`
                }
              </Text>
            </View>
          )}
        </View>

        {/* Donate Button */}
        <TouchableOpacity
          style={[styles.donateButton, { backgroundColor: '#38B6FF' }]}
          onPress={handleDonatePress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Donate to ${cause.title}`}
        >
          <Heart size={16} color="#FFFFFF" />
          <Text style={styles.donateButtonText}>Donate Now</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
    <ShareCauseModal
      visible={showShareModal}
      onClose={() => setShowShareModal(false)}
      onShare={handleShare}
      cause={cause}
      sharing={sharing}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    height: 160,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shareButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: isSmallScreen ? 12 : 16,
  },
  title: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    fontSize: isSmallScreen ? 13 : 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  amountRaised: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
  },
  amountGoal: {
    fontSize: isSmallScreen ? 13 : 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CauseCard;
