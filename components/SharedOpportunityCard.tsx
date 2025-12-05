/**
 * Shared Opportunity Card Component
 * Displays an opportunity card when someone shares it to the feed
 * Clicking on it navigates to the opportunity details page
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { MapPin, Clock, Users, CheckCircle, ExternalLink } from 'lucide-react-native';
import { Opportunity } from '../types';
import { Colors } from '../constants/colors';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from './AnimatedPressable';
import { useAuth } from '../contexts/AuthContext';

interface SharedOpportunityCardProps {
  opportunity: Opportunity;
}

export default function SharedOpportunityCard({ opportunity }: SharedOpportunityCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { isAdmin } = useAuth();

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

  // Check if opportunity has passed its end date
  const isExpired = (): boolean => {
    const endDate = opportunity.dateEnd || opportunity.date;
    if (!endDate) return false;
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return end < today;
  };

  const handlePress = () => {
    if (!opportunity.slug) {
      console.error('Opportunity slug is missing, cannot navigate');
      return;
    }

    // Check if opportunity is expired and user is not admin
    if (isExpired() && !isAdmin) {
      Alert.alert(
        'Opportunity No Longer Available',
        'This opportunity has passed its end date and is no longer available for viewing.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push(`/opportunity/${opportunity.slug}` as any);
  };

  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
    >
      {opportunity.imageUrl && (
        <Image source={{ uri: opportunity.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '15' }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {opportunity.category.toUpperCase()}
            </Text>
          </View>
          {opportunity.organizationVerified && (
            <CheckCircle size={16} color={colors.success} fill={colors.success} />
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {opportunity.title}
        </Text>

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
                if (opportunity.timeStart && opportunity.timeEnd) {
                  const formatTime = (time: string) => {
                    const [hours, minutes] = time.split(':');
                    const hour24 = parseInt(hours, 10);
                    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                    const ampm = hour24 >= 12 ? 'pm' : 'am';
                    const minStr = minutes && minutes !== '00' ? `:${minutes}` : '';
                    return `${hour12}${minStr}${ampm}`;
                  };
                  return `${formatTime(opportunity.timeStart)} - ${formatTime(opportunity.timeEnd)}`;
                }
                return opportunity.duration || 'TBA';
              })()}
            </Text>
          </View>
        </View>

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
          <View style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.primary }]}>View Details</Text>
            <ExternalLink size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
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
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  orgContainer: {
    marginBottom: 10,
  },
  orgName: {
    fontSize: 13,
    fontWeight: '500',
  },
  details: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

