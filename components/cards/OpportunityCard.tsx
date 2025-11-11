/**
 * Opportunity Card Component
 * Displays a volunteer opportunity in the discover feed
 */

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useColorScheme } from 'react-native';
import { MapPin, Clock, Users, CheckCircle } from 'lucide-react-native';
import { Opportunity } from '../../types';
import { Colors } from '../../constants/colors';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onPress: (opportunity: Opportunity) => void;
}

export function OpportunityCard({ opportunity, onPress }: OpportunityCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const getCategoryColor = (category: Opportunity['category']) => {
    const categoryColors = {
      environment: '#10B981',
      education: '#3B82F6',
      healthcare: '#EF4444',
      community: '#8B5CF6',
      poorRelief: '#F59E0B',
      animals: '#EC4899',
      seniors: '#EC4899',
    };
    return categoryColors[category] || colors.primary;
  };

  const categoryColor = getCategoryColor(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;

  return (
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
              {opportunity.duration}
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
          <Text style={[styles.date, { color: colors.text }]}>
            {new Date(opportunity.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
});