/**
 * Opportunity Details Screen - Modern UI
 * Shows full opportunity information with sign-up for volunteers
 * and edit/delete options for admins
 * 
 * Modern features:
 * - Enhanced animations and micro-interactions
 * - Shimmer loading states with modern skeleton screens
 * - Modern typography scale and spacing system
 * - Pull-to-refresh functionality
 * - Share and bookmark capabilities
 * - Improved accessibility and responsive design
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  RefreshControl,
  Animated,
  Platform,
  Share as RNShare,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useThemeStyles } from '../hooks/useThemeStyles';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { ShimmerSkeleton } from '../components/ShimmerSkeleton';
import {
  ChevronLeft,
  MapPin,
  Clock,
  Users,
  Calendar,
  CheckCircle,
  Edit,
  Trash2,
  AlertCircle,
  Award,
  FileText,
  Share2,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react-native';
import { Opportunity } from '../types';
import { supabase } from '../services/supabase';
import CustomAlert from '../components/CustomAlert';
import { showToast } from '../utils/toast';
import { Colors } from '../constants/colors';
import { addEventToCalendar, createEventDateTime, calculateEndDate } from '../utils/calendar';
import { CalendarPlus } from 'lucide-react-native';

export default function OpportunityDetailsScreen() {
  const { colors, responsive, cardShadow } = useThemeStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const params = useLocalSearchParams();
  const opportunityId = params.id as string;

  // State
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupStatus, setSignupStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Animations
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  const showAlert = useCallback((title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  }, []);

  useEffect(() => {
    loadOpportunityDetails();
    checkSignupStatus();
    checkSavedStatus();
  }, [opportunityId]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadOpportunityDetails(),
      checkSignupStatus(),
      checkSavedStatus(),
    ]);
    setRefreshing(false);
  }, [opportunityId]);

  // Check if opportunity is saved/bookmarked
  const checkSavedStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  }, [opportunityId, user]);

  // Toggle save/bookmark
  const toggleSave = useCallback(async () => {
    if (!user) {
      showToast('Please log in to save opportunities', 'error');
      return;
    }

    try {
      setSavingBookmark(true);

      if (isSaved) {
        // Remove from saved
        const { error } = await supabase
          .from('saved_opportunities')
          .delete()
          .eq('opportunity_id', opportunityId)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsSaved(false);
        showToast('Removed from saved', 'success');
      } else {
        // Add to saved
        const { error } = await supabase
          .from('saved_opportunities')
          .insert({
            opportunity_id: opportunityId,
            user_id: user.id,
          });

        if (error) throw error;
        setIsSaved(true);
        showToast('Saved for later!', 'success');
      }
    } catch (error: any) {
      console.error('Error toggling save:', error);
      showToast(error.message || 'Failed to save', 'error');
    } finally {
      setSavingBookmark(false);
    }
  }, [user, isSaved, opportunityId, showToast]);

  // Share opportunity
  const handleShare = useCallback(async () => {
    if (!opportunity) return;

    try {
      const shareUrl = `https://vibe.volunteersinc.org/opportunity/${opportunity.slug || opportunity.id}`;
      await RNShare.share({
        title: opportunity.title,
        message: `Check out this volunteering opportunity: ${opportunity.title}\n\n${opportunity.description?.substring(0, 150)}${opportunity.description && opportunity.description.length > 150 ? '...' : ''}\n\nOrganization: ${opportunity.organizationName}\nLocation: ${opportunity.location}\n\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.message) {
        console.error('Error sharing:', error);
      }
    }
  }, [opportunity]);

  const loadOpportunityDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (error) throw error;

      const opportunityData: Opportunity = {
        id: data.id,
        title: data.title,
        description: data.description,
        organizationName: data.organization_name,
        organizationVerified: data.organization_verified,
        category: data.category,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        date: data.date,
        duration: data.duration,
        spotsAvailable: data.spots_available,
        spotsTotal: data.spots_total,
        requirements: data.requirements,
        skillsNeeded: data.skills_needed,
        impactStatement: data.impact_statement,
        imageUrl: data.image_url,
        status: data.status,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setOpportunity(opportunityData);
    } catch (error) {
      console.error('Error loading opportunity:', error);
      showAlert('Error', 'Failed to load opportunity details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkSignupStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('opportunity_signups')
        .select('status')
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIsSignedUp(true);
        setSignupStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking signup status:', error);
    }
  };

  const handleSignUp = async () => {
    if (!user || !opportunity) return;

    if (opportunity.spotsAvailable <= 0) {
      showAlert('Full', 'This opportunity is currently full', 'warning');
      return;
    }

    try {
      setSubmitting(true);

      // Insert signup
      const { error: signupError } = await supabase
        .from('opportunity_signups')
        .insert({
          opportunity_id: opportunityId,
          user_id: user.id,
          status: 'confirmed',
          signed_up_at: new Date().toISOString(),
        });

      if (signupError) throw signupError;

      // Update spots available
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          spots_available: opportunity.spotsAvailable - 1,
        })
        .eq('id', opportunityId);

      if (updateError) throw updateError;

      setIsSignedUp(true);
      setSignupStatus('confirmed');
      showAlert('Success!', 'You have successfully signed up for this opportunity', 'success');

      // Reload opportunity to get updated spots
      loadOpportunityDetails();
    } catch (error: any) {
      console.error('Error signing up:', error);
      showAlert('Error', error.message || 'Failed to sign up', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!opportunity) return;

    try {
      // Parse opportunity date/time
      const dateStart = opportunity.dateStart || opportunity.date;
      if (!dateStart) {
        showAlert('Error', 'Opportunity date not available', 'error');
        return;
      }

      const startDate = createEventDateTime(
        dateStart,
        opportunity.timeStart,
        'America/Jamaica' // Default timezone, adjust if needed
      );
      
      const endDate = opportunity.timeEnd
        ? createEventDateTime(dateStart, opportunity.timeEnd, 'America/Jamaica')
        : calculateEndDate(startDate, undefined, 2);

      const result = await addEventToCalendar({
        title: opportunity.title,
        startDate,
        endDate,
        location: opportunity.location || undefined,
        notes: opportunity.description || undefined,
        timeZone: 'America/Jamaica',
      });

      if (result.success) {
        showAlert('Success', 'Added to calendar', 'success');
      } else {
        showAlert('Error', result.error || 'Failed to add to calendar', 'error');
      }
    } catch (error) {
      console.error('Error adding to calendar:', error);
      showAlert('Error', 'Failed to add to calendar', 'error');
    }
  };

  const handleCancelSignup = async () => {
    if (!user || !opportunity) return;

    try {
      setSubmitting(true);

      // Delete signup
      const { error: deleteError } = await supabase
        .from('opportunity_signups')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Update spots available
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          spots_available: opportunity.spotsAvailable + 1,
        })
        .eq('id', opportunityId);

      if (updateError) throw updateError;

      setIsSignedUp(false);
      setSignupStatus(null);
      showAlert('Cancelled', 'Your signup has been cancelled', 'success');

      // Reload opportunity to get updated spots
      loadOpportunityDetails();
    } catch (error: any) {
      console.error('Error cancelling signup:', error);
      showAlert('Error', error.message || 'Failed to cancel signup', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!opportunity) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId);

      if (error) throw error;

      showAlert('Deleted', 'Opportunity has been deleted', 'success');

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('Error deleting opportunity:', error);
      showAlert('Error', error.message || 'Failed to delete opportunity', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryTheme = (category: string) => {
    const normalized = category?.toLowerCase().replace(/\s+/g, '');
    const palette = (Colors.categories as Record<string, { base: string; soft: string }>)?.[normalized];
    return {
      base: palette?.base || colors.primary,
      soft: palette?.soft || colors.primarySoft,
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Loading Header */}
        <View style={[styles.header, { paddingTop: insets.top + responsive.spacing.lg, borderBottomColor: colors.border, opacity: 1 }]}>
          <View style={styles.headerContent}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.roundedIconButton,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
                },
              ]}
              onPress={() => router.back()}
            >
              <ChevronLeft size={responsive.iconSize.lg} color={colors.text} />
            </AnimatedPressable>
          </View>
        </View>
        
        {/* Modern Loading Skeleton */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.loadingContainer}
        >
          {/* Image Skeleton */}
          <ShimmerSkeleton
            colors={colors}
            style={{
              width: '100%',
              height: 250,
              borderRadius: 0,
              marginBottom: 0,
            }}
          />
          
          {/* Content Skeleton */}
          <View style={{ padding: 16 }}>
            {/* Badge Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <ShimmerSkeleton colors={colors} style={{ width: 80, height: 24, borderRadius: 12 }} />
              <ShimmerSkeleton colors={colors} style={{ width: 70, height: 24, borderRadius: 12 }} />
            </View>
            
            {/* Title */}
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: '90%', height: 32, borderRadius: 8, marginBottom: 8 }} 
            />
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: '70%', height: 32, borderRadius: 8, marginBottom: 16 }} 
            />
            
            {/* Organization */}
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: '50%', height: 18, borderRadius: 8, marginBottom: 24 }} 
            />
            
            {/* Info Cards Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {[...Array(4)].map((_, i) => (
                <ShimmerSkeleton 
                  key={i}
                  colors={colors} 
                  style={{ width: '48%', height: 100, borderRadius: 12 }} 
                />
              ))}
            </View>
            
            {/* Description */}
            {[...Array(5)].map((_, i) => (
              <ShimmerSkeleton 
                key={`desc-${i}`}
                colors={colors} 
                style={{ 
                  width: i === 4 ? '60%' : '100%', 
                  height: 16, 
                  borderRadius: 8, 
                  marginBottom: 8 
                }} 
              />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!opportunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + responsive.spacing.lg, borderBottomColor: colors.border, opacity: 1 }]}>
          <View style={styles.headerContent}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.roundedIconButton,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
                },
              ]}
              onPress={() => router.back()}
            >
              <ChevronLeft size={responsive.iconSize.lg} color={colors.text} />
            </AnimatedPressable>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Opportunity not found
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            This opportunity may have been removed or doesn't exist.
          </Text>
        </View>
      </View>
    );
  }

  const categoryTheme = getCategoryTheme(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;
  const isFull = spotsLeft <= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            paddingTop: insets.top + responsive.spacing.lg, 
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
            opacity: headerOpacity,
          }
        ]}
      >
        <View style={styles.headerContent}>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.roundedIconButton,
              {
                backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
              },
            ]}
            onPress={() => router.back()}
          >
            <ChevronLeft size={responsive.iconSize.lg} color={colors.text} />
          </AnimatedPressable>
          
          {/* Right Actions */}
          <View style={styles.headerActions}>
            {/* Share Button */}
            {!isAdmin && (
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Share opportunity"
                style={({ pressed }) => [
                  styles.roundedIconButton,
                  {
                    backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
                  },
                ]}
                onPress={handleShare}
              >
                <Share2 size={responsive.iconSize.md} color={colors.text} />
              </AnimatedPressable>
            )}
            
            {/* Save/Bookmark Button */}
            {!isAdmin && (
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={isSaved ? 'Remove from saved' : 'Save for later'}
                style={({ pressed }) => [
                  styles.roundedIconButton,
                  {
                    backgroundColor: pressed 
                      ? colors.primarySoft 
                      : isSaved 
                      ? colors.primarySoft 
                      : colors.surfaceElevated,
                  },
                ]}
                onPress={toggleSave}
                disabled={savingBookmark}
              >
                {isSaved ? (
                  <BookmarkCheck size={responsive.iconSize.md} color={colors.primary} />
                ) : (
                  <Bookmark size={responsive.iconSize.md} color={colors.text} />
                )}
              </AnimatedPressable>
            )}
            
            {/* Admin Actions */}
            {isAdmin && (
              <>
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit opportunity"
                  style={({ pressed }) => [
                    styles.roundedIconButton,
                    {
                      backgroundColor: pressed ? colors.primarySoft : colors.surfaceElevated,
                    },
                  ]}
                  onPress={() => router.push(`/edit-opportunity/${opportunityId}`)}
                >
                  <Edit size={responsive.iconSize.md} color={colors.primary} />
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete opportunity"
                  style={({ pressed }) => [
                    styles.roundedIconButton,
                    {
                      backgroundColor: pressed ? colors.errorSoft : colors.surfaceElevated,
                    },
                  ]}
                  onPress={handleDelete}
                  disabled={submitting}
                >
                  <Trash2 size={responsive.iconSize.md} color={colors.error} />
                </AnimatedPressable>
              </>
            )}
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Image */}
        {opportunity.imageUrl && (
          <Image source={{ uri: opportunity.imageUrl }} style={styles.image} />
        )}

        <View style={styles.content}>
          {/* Category and Verified Badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryTheme.soft }]}>
              <Text style={[styles.categoryText, { color: categoryTheme.base }]}>
                {opportunity.category.toUpperCase()}
              </Text>
            </View>
            {opportunity.organizationVerified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle size={16} color={colors.success} fill={colors.success} />
                <Text style={[styles.verifiedText, { color: colors.success }]}>Verified</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{opportunity.title}</Text>

          {/* Organization */}
          <Text style={[styles.organization, { color: colors.textSecondary }]}>
            {opportunity.organizationName}
          </Text>

          {/* Info Cards */}
          <View style={styles.infoGrid}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}>
              <MapPin size={20} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
                {opportunity.location}
              </Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}>
              <Calendar size={20} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {new Date(opportunity.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}>
              <Clock size={20} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{opportunity.duration}</Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, ...cardShadow }]}>
              <Users size={20} color={isLimited ? colors.warning : colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Spots Left</Text>
              <Text style={[styles.infoValue, { color: isLimited ? colors.warning : colors.text }]}>
                {spotsLeft} / {opportunity.spotsTotal}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
            </View>
            <Text style={[styles.description, { color: colors.text }]}>
              {opportunity.description}
            </Text>
          </View>

          {/* Impact Statement */}
          {opportunity.impactStatement && (
            <View style={[styles.impactCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary, ...cardShadow }]}>
              <Award size={20} color={colors.primary} />
              <Text style={[styles.impactText, { color: colors.text }]}>
                {opportunity.impactStatement}
              </Text>
            </View>
          )}

          {/* Requirements */}
          {opportunity.requirements && opportunity.requirements.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertCircle size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Requirements</Text>
              </View>
              <View style={styles.listContainer}>
                {opportunity.requirements.map((req, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.listItemText, { color: colors.text }]}>{req}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Skills Needed */}
          {opportunity.skillsNeeded && opportunity.skillsNeeded.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Award size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Skills Needed</Text>
              </View>
              <View style={styles.skillsContainer}>
                {opportunity.skillsNeeded.map((skill, index) => (
                  <View key={index} style={[styles.skillChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.skillChipText, { color: colors.text }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Buttons (Only for non-admins) */}
      {!isAdmin && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + responsive.spacing.md,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          {/* Add to Calendar Button */}
          <AnimatedPressable
            onPress={handleAddToCalendar}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
                marginBottom: responsive.spacing.sm,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add opportunity to calendar"
          >
            <CalendarPlus size={20} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Add to Calendar
            </Text>
          </AnimatedPressable>

          {isSignedUp ? (
            <AnimatedPressable
              onPress={handleCancelSignup}
              disabled={submitting}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={[colors.error, colors.errorDark]}
                style={[
                  styles.gradientButton,
                  {
                    height: responsive.buttonHeight,
                    paddingHorizontal: responsive.spacing.xl,
                    opacity: submitting ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {submitting ? 'Cancelling...' : 'Cancel Signup'}
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              onPress={handleSignUp}
              disabled={submitting || isFull}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={
                  submitting || isFull
                    ? [colors.textSecondary, colors.textSecondary]
                    : [colors.primary, colors.primaryDark]
                }
                style={[
                  styles.gradientButton,
                  {
                    height: responsive.buttonHeight,
                    paddingHorizontal: responsive.spacing.xl,
                    opacity: submitting || isFull ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
                  {submitting ? 'Signing Up...' : isFull ? 'Opportunity Full' : 'Sign Up'}
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          )}
        </View>
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  roundedIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingTop: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 34,
  },
  organization: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 24,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  impactCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  impactText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  skillChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});