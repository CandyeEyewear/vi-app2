/**
 * Opportunity Reviews Screen
 * Admin screen to review pending opportunity proposals
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import { ChevronLeft, Calendar, MapPin, User, Clock, Eye } from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface PendingOpportunity {
  id: string;
  title: string;
  organization_name: string;
  category: string;
  location: string;
  date_start: string;
  date_end: string;
  submitted_by: string;
  created_at: string;
  submitted_by_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export default function OpportunityReviewsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [opportunities, setOpportunities] = useState<PendingOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const surfaceShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    web: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    default: {},
  });

  useEffect(() => {
    loadPendingOpportunities();
  }, []);

  const loadPendingOpportunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          organization_name,
          category,
          location,
          date_start,
          date_end,
          submitted_by,
          created_at,
          submitted_by_user:users!submitted_by (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('proposal_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pending opportunities:', error);
        return;
      }

      setOpportunities((data as PendingOpportunity[]) || []);
    } catch (error) {
      console.error('Error loading pending opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryLabel = (category: string) => {
    const categories: { [key: string]: string } = {
      environment: 'Environment',
      education: 'Education',
      healthcare: 'Healthcare',
      poorRelief: 'Poor Relief',
      community: 'Community',
      viEngage: 'VI Engage',
    };
    return categories[category] || category;
  };

  // Safety check
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </AnimatedPressable>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Access Denied
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            You don't have permission to access this area
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Opportunity Reviews
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {opportunities.length} pending {opportunities.length === 1 ? 'proposal' : 'proposals'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading proposals...
            </Text>
          </View>
        ) : opportunities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Pending Proposals
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              All opportunity proposals have been reviewed
            </Text>
          </View>
        ) : (
          opportunities.map((opportunity) => (
            <AnimatedPressable
              key={opportunity.id}
              style={[styles.opportunityCard, surfaceShadow, { borderColor: colors.border }]}
              onPress={() => router.push(`/(admin)/opportunity-review/${opportunity.id}`)}
            >
              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.opportunityCardInner}
              >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={[styles.opportunityTitle, { color: colors.text }]}>
                    {opportunity.title}
                  </Text>
                  <Text style={[styles.organizationName, { color: colors.textSecondary }]}>
                    {opportunity.organization_name}
                  </Text>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.categoryText, { color: colors.primary }]}>
                    {getCategoryLabel(opportunity.category)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <MapPin size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {opportunity.location}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {formatDate(opportunity.date_start)}
                    {opportunity.date_end && opportunity.date_end !== opportunity.date_start
                      ? ` - ${formatDate(opportunity.date_end)}`
                      : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.submittedBy}>
                  {opportunity.submitted_by_user?.avatar_url ? (
                    <Image
                      source={{ uri: opportunity.submitted_by_user.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                      <User size={16} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.submittedByText}>
                    <Text style={[styles.submittedByLabel, { color: colors.textSecondary }]}>
                      Submitted by
                    </Text>
                    <Text style={[styles.submittedByName, { color: colors.text }]}>
                      {opportunity.submitted_by_user?.full_name || 'Unknown User'}
                    </Text>
                  </View>
                </View>
                <View style={styles.viewButton}>
                  <Eye size={18} color={colors.primary} />
                  <Text style={[styles.viewButtonText, { color: colors.primary }]}>
                    View Details
                  </Text>
                </View>
              </View>

              <View style={styles.submittedDate}>
                <Clock size={12} color={colors.textSecondary} />
                <Text style={[styles.submittedDateText, { color: colors.textSecondary }]}>
                  Submitted {formatDate(opportunity.created_at)}
                </Text>
              </View>
              </LinearGradient>
            </AnimatedPressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  opportunityCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  opportunityCardInner: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  opportunityTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 14,
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
  cardDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  submittedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedByText: {
    flex: 1,
  },
  submittedByLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  submittedByName: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submittedDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  submittedDateText: {
    fontSize: 11,
  },
});

