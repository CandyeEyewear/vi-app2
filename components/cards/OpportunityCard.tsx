/**
 * Opportunity Card Component
 * Displays a volunteer opportunity in the discover feed
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useColorScheme } from 'react-native';
import { MapPin, Clock, Users, CheckCircle, Share2 } from 'lucide-react-native';
import { Opportunity } from '../../types';
import { Colors } from '../../constants/colors';
import { useFeed } from '../../contexts/FeedContext';
import ShareOpportunityModal from '../ShareOpportunityModal';

interface OpportunityCardProps {
  opportunity: Opportunity & {
    highlightedTitle?: string;
    highlightedDescription?: string;
  };
  onPress: (opportunity: Opportunity) => void;
  onShare?: (opportunity: Opportunity) => void;
}

/**
 * Render text with highlighted search terms
 * Highlighted terms are marked with **text**
 */
const renderHighlightedText = (text: string, color: string, style: any, numberOfLines?: number) => {
  if (!text.includes('**')) {
    return <Text style={[style, { color }]} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={[style, { color }]} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const highlightedText = part.slice(2, -2);
          return (
            <Text key={index} style={{ backgroundColor: '#FFEB3B', fontWeight: '700' }}>
              {highlightedText}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};

export function OpportunityCard({ opportunity, onPress, onShare }: OpportunityCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { shareOpportunityToFeed } = useFeed();

  const handleSharePress = (e: any) => {
    e.stopPropagation(); // Prevent card press
    if (onShare) {
      onShare(opportunity);
    } else {
      setShowShareModal(true);
    }
  };

  const handleShare = async (comment?: string, visibility?: 'public' | 'circle') => {
    setSharing(true);
    const response = await shareOpportunityToFeed(opportunity.id, comment, visibility);
    setSharing(false);
    
    if (response.success) {
      setShowShareModal(false);
    }
  };

  const getCategoryColor = (category: Opportunity['category']) => {
    const categoryColors = {
      environment: '#10B981',
      education: '#3B82F6',
      healthcare: '#EF4444',
      community: '#8B5CF6',
      poorRelief: '#F59E0B',
      viEngage: '#FF6B35',
      animals: '#EC4899',
      seniors: '#EC4899',
    };
    return categoryColors[category] || colors.primary;
  };

  const categoryColor = getCategoryColor(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onPress(opportunity)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: opportunity.imageUrl }} style={styles.image} />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '15' }]}>
              <Text style={[styles.categoryText, { color: categoryColor }]}>
                {opportunity.category.toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {opportunity.organizationVerified && (
                <CheckCircle size={16} color={colors.success} fill={colors.success} />
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

        {renderHighlightedText(
          opportunity.highlightedTitle || opportunity.title,
          colors.text,
          styles.title,
          2
        )}

        <View style={styles.orgContainer}>
          <Text style={[styles.orgName, { color: colors.textSecondary }]}>
            {opportunity.organizationName}
          </Text>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {opportunity.location}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {(() => {
                // Show time range if available
                if (opportunity.timeStart && opportunity.timeEnd) {
                  const formatTime = (time: string) => {
                    // Convert 24-hour time to 12-hour format with am/pm
                    const [hours, minutes] = time.split(':');
                    const hour24 = parseInt(hours, 10);
                    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                    const ampm = hour24 >= 12 ? 'pm' : 'am';
                    const minStr = minutes && minutes !== '00' ? `:${minutes}` : '';
                    return `${hour12}${minStr}${ampm}`;
                  };
                  return `${formatTime(opportunity.timeStart)} - ${formatTime(opportunity.timeEnd)}`;
                }
                // Fall back to duration if available
                return opportunity.duration || 'TBA';
              })()}
            </Text>
          </View>
        </View>

        {/* Distance Badge */}
        {opportunity.distance !== undefined && (
          <View style={styles.distanceBadge}>
            <MapPin size={12} color="#1976D2" />
            <Text style={styles.distanceText}>
              {opportunity.distance < 1 
                ? `${(opportunity.distance * 5280).toFixed(0)} ft away`
                : `${opportunity.distance.toFixed(1)} mi away`
              }
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.detailRow}>
            <Users size={14} color={isLimited ? colors.warning : colors.textSecondary} />
            <Text
              style={[
                styles.detailText,
                { color: isLimited ? colors.warning : colors.textSecondary, fontWeight: '600' }
              ]}
            >
              {spotsLeft} spots left
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.text }]}>
            {(() => {
              // Always show date range if available
              if (opportunity.dateStart && opportunity.dateEnd) {
                const startDate = new Date(opportunity.dateStart);
                const endDate = new Date(opportunity.dateEnd);
                const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
                const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
                const startDay = startDate.getDate();
                const endDay = endDate.getDate();

                // Same month: "Dec 10-16"
                if (startMonth === endMonth) {
                  // If same day, still show as range
                  if (startDay === endDay) {
                    return `${startMonth} ${startDay}`;
                  }
                  return `${startMonth} ${startDay}-${endDay}`;
                }
                // Different months: "Dec 10 - Jan 5"
                return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
              }
              // Fall back to single date
              if (opportunity.date) {
                const date = new Date(opportunity.date);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }
              return 'TBA';
            })()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>

    <ShareOpportunityModal
      visible={showShareModal}
      onClose={() => setShowShareModal(false)}
      onShare={handleShare}
      opportunity={opportunity}
      sharing={sharing}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 26,
  },
  orgContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '500',
  },
  details: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  distanceText: {
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 4,
    fontWeight: '600',
  },
});