/**
 * Shared Cause Card Component
 * Displays a cause card when someone shares it to the feed
 * Clicking on it navigates to the cause details page
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Heart, Users, Clock, TrendingUp, ExternalLink } from 'lucide-react-native';
import { Cause, CauseCategory } from '../types';
import { Colors } from '../constants/colors';
import { useRouter } from 'expo-router';
import { getCauseProgress, getCauseDaysRemaining, formatCurrency } from '../services/causesService';
import { AnimatedPressable } from './AnimatedPressable';

interface SharedCauseCardProps {
  cause: Cause;
}

const CATEGORY_CONFIG: Record<CauseCategory, { label: string; color: string; emoji: string }> = {
  disaster_relief: { label: 'Disaster Relief', color: '#E53935', emoji: '🆘' },
  education: { label: 'Education', color: '#1E88E5', emoji: '📚' },
  healthcare: { label: 'Healthcare', color: '#43A047', emoji: '🏥' },
  environment: { label: 'Environment', color: '#7CB342', emoji: '🌱' },
  community: { label: 'Community', color: '#FB8C00', emoji: '🏘️' },
  poverty: { label: 'Poverty Relief', color: '#8E24AA', emoji: '💝' },
  other: { label: 'Other', color: '#757575', emoji: '📋' },
};

export default function SharedCauseCard({ cause }: SharedCauseCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const categoryConfig = CATEGORY_CONFIG[cause.category] || CATEGORY_CONFIG.other;
  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);

  const handlePress = () => {
    router.push(`/causes/${cause.slug}` as any);
  };

  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
    >
      {cause.imageUrl && (
        <Image source={{ uri: cause.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryBadgeText}>
              {categoryConfig.emoji} {categoryConfig.label}
            </Text>
          </View>
          {cause.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
              <TrendingUp size={12} color="#000" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {cause.title}
        </Text>

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

        <View style={styles.footer}>
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
          <View style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.primary }]}>View Cause</Text>
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
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
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
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  amountRaised: {
    fontSize: 16,
    fontWeight: '700',
  },
  amountGoal: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
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

