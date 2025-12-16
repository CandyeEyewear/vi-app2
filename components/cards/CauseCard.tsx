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
import { Heart, Users, Clock, TrendingUp, Share2, CheckCircle } from 'lucide-react-native';
import { Cause, CauseCategory } from '../../types';
import { Colors } from '../../constants/colors';
import { getCauseProgress, getCauseDaysRemaining, formatCurrency } from '../../services/causesService';
import { useFeed } from '../../contexts/FeedContext';
import ShareCauseModal from '../ShareCauseModal';
import { showToast } from '../../utils/toast';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

interface CauseCardProps {
  cause: Cause;
  onPress?: () => void;
  onShare?: (cause: Cause) => void;
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

export function CauseCard({ cause, onPress, onShare }: CauseCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { shareCauseToFeed } = useFeed();
  
  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);
  const categoryConfig = CATEGORY_CONFIG[cause.category] || CATEGORY_CONFIG.other;


  const handleSharePress = (e: any) => {
    e.stopPropagation();
    setShowShareModal(true);
  };

  const handleShare = async (comment?: string, visibility: 'public' | 'circle' = 'public') => {
    try {
      setSharing(true);
      const response = await shareCauseToFeed(cause.id, comment, visibility);

      if (response.success) {
        showToast(`Shared to ${visibility === 'circle' ? 'Circle' : 'Feed'}! 🎉`, 'success');
        setShowShareModal(false);
      } else {
        showToast(response.error || 'Failed to share cause', 'error');
      }
    } catch (error) {
      showToast('Something went wrong while sharing', 'error');
    } finally {
      setSharing(false);
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
      {cause.imageUrl ? (
        <Image 
          source={{ uri: cause.imageUrl }} 
          style={styles.image} 
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
          <Heart size={40} color={colors.textSecondary} />
        </View>
      )}
      
      {/* Content Section */}
      <View style={styles.content}>
        {/* Header with Category Badge and Share Button */}
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '15' }]}>
            <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
              {categoryConfig.label.toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {cause.isFeatured && (
              <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
                <TrendingUp size={12} color="#000" />
              </View>
            )}
            <TouchableOpacity
              onPress={handleSharePress}
              style={styles.shareButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Share2 size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {cause.title || ''}
        </Text>

        {/* Creator/Organization */}
        {cause.creator && (
          <View style={styles.orgContainer}>
            <Text style={[styles.orgName, { color: colors.textSecondary }]}>
              {cause.creator.fullName || cause.creator.username || 'Volunteers Inc'}
            </Text>
          </View>
        )}

        {/* Details Row */}
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Heart size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatCurrency(cause.amountRaised)} raised
            </Text>
          </View>
          {daysRemaining !== null && (
            <View style={styles.detailRow}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {daysRemaining === 0 
                  ? 'Ends today' 
                  : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`
                }
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.detailRow}>
            <Users size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {cause.donorCount} {cause.donorCount === 1 ? 'donor' : 'donors'}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.text }]}>
            {(() => {
              if (cause.endDate) {
                const endDate = new Date(cause.endDate);
                const month = endDate.toLocaleDateString('en-US', { month: 'short' });
                const day = endDate.getDate();
                return `${month} ${day}`;
              }
              if (cause.startDate) {
                const startDate = new Date(cause.startDate);
                const month = startDate.toLocaleDateString('en-US', { month: 'short' });
                const day = startDate.getDate();
                return `${month} ${day}`;
              }
              return 'Ongoing';
            })()}
          </Text>
        </View>
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
    marginHorizontal: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    flex: 1,
  },
  image: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    padding: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    padding: 4,
    borderRadius: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  orgContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orgName: {
    fontSize: 13,
    fontWeight: '500',
  },
  details: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailText: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default CauseCard;
