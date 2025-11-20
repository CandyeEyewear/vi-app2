/**
 * Opportunity Details Screen (Dynamic Route)
 * Shows full opportunity information with sign-up for volunteers
 * and edit/delete options for admins
 * 
 * FIXED: Removed nested ScrollView to fix virtualization error
 * Each tab now handles its own scrolling independently
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
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
  MessageCircle,
  ExternalLink,
  QrCode,
  X,
  Share2,
} from 'lucide-react-native';
import { Opportunity } from '../../types';
import { supabase } from '../../services/supabase';
import CustomAlert from '../../components/CustomAlert';
import OpportunityGroupChat from '../../components/OpportunityGroupChat';
import ParticipantsList from '../../components/ParticipantsList';
import QRScanner from '../../components/QRScanner';
import ShareOpportunityModal from '../../components/ShareOpportunityModal';
import { useFeed } from '../../contexts/FeedContext';

export default function OpportunityDetailsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { shareOpportunityToFeed } = useFeed();
  const params = useLocalSearchParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupStatus, setSignupStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'participants'>('details');
  
  // Check-in state
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);
  
  // Admin stats
  const [totalSignups, setTotalSignups] = useState<number>(0);
  const [totalCheckIns, setTotalCheckIns] = useState<number>(0);
  // QR Code state
   const [qrModalVisible, setQrModalVisible] = useState(false);
   const qrCodeRef = React.useRef<View>(null);
   const [qrScannerVisible, setQrScannerVisible] = useState(false);
  
  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleShare = async (comment?: string, visibility?: 'public' | 'circle') => {
    if (!opportunity) return;
    
    setSharing(true);
    const response = await shareOpportunityToFeed(opportunity.id, comment, visibility);
    setSharing(false);
    
    if (response.success) {
      setShowShareModal(false);
      showAlert('Success', 'Opportunity shared to your feed!', 'success');
    } else {
      showAlert('Error', response.error || 'Failed to share opportunity', 'error');
    }
  };

  useEffect(() => {
    if (opportunityId) {
      loadOpportunityDetails();
      checkSignupStatus();
      if (isAdmin) {
        loadAdminStats();
      }
    }
  }, [opportunityId, isAdmin]);

  // Calculate and log check-in window debug info
  useEffect(() => {
    if (opportunity && (opportunity.dateStart || opportunity.dateEnd)) {
      const now = new Date();
      const startDate = opportunity.dateStart ? new Date(opportunity.dateStart) : null;
      const endDate = opportunity.dateEnd ? new Date(opportunity.dateEnd) : null;
      
      let isWithinCheckInWindow = false;
      if (startDate && endDate) {
        // Set end date to end of day for comparison
        const endDateForComparison = new Date(endDate);
        endDateForComparison.setHours(23, 59, 59, 999);
        isWithinCheckInWindow = now >= startDate && now <= endDateForComparison;
      } else if (startDate) {
        isWithinCheckInWindow = now >= startDate;
      } else if (endDate) {
        const endDateForComparison = new Date(endDate);
        endDateForComparison.setHours(23, 59, 59, 999);
        isWithinCheckInWindow = now <= endDateForComparison;
      }
      
      const hasSignedUp = isSignedUp;

      // After the isWithinCheckInWindow calculation (around line 108)
      console.log('📅 Check-in Debug:', {
        hasSignedUp,
        isWithinCheckInWindow,
        dateStart: opportunity.dateStart,
        dateEnd: opportunity.dateEnd,
        currentDate: new Date().toISOString(),
        opportunityId: opportunity.id
      });
    }
  }, [opportunity, isSignedUp]);

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
        mapLink: data.map_link,
        date: data.date || data.date_start,
        dateStart: data.date_start,
        dateEnd: data.date_end,
        timeStart: data.time_start,
        timeEnd: data.time_end,
        duration: data.duration || (data.time_start && data.time_end ? `${data.time_start} - ${data.time_end}` : undefined),
        spotsAvailable: data.spots_available,
        spotsTotal: data.spots_total,
        requirements: data.requirements,
        skillsNeeded: data.skills_needed,
        impactStatement: data.impact_statement,
        links: data.links,
        imageUrl: data.image_url,
        checkInCode: data.check_in_code,
        contactPersonName: data.contact_person_name,
        contactPersonPhone: data.contact_person_phone,
        status: data.status,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setOpportunity(opportunityData);
      
      // Reload admin stats if admin
      if (isAdmin) {
        loadAdminStats();
      }
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
        .select('status, checked_in, check_in_status')
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIsSignedUp(true);
        setSignupStatus(data.status);
        setHasCheckedIn(data.checked_in || false);
        setCheckInStatus(data.check_in_status || null);
      }
    } catch (error) {
      console.error('Error checking signup status:', error);
    }
  };

  // Load admin statistics (signups and check-ins)
  const loadAdminStats = async () => {
    if (!isAdmin) return;

    try {
      // Get total signups count
      const { count: signupsCount, error: signupsError } = await supabase
        .from('opportunity_signups')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId)
        .neq('status', 'cancelled');

      if (signupsError) {
        console.error('Error loading signups count:', signupsError);
      } else {
        setTotalSignups(signupsCount || 0);
      }

      // Get total check-ins count (checked_in = true OR check_in_status = 'approved')
      const { count: checkInsCount, error: checkInsError } = await supabase
        .from('opportunity_signups')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId)
        .or('checked_in.eq.true,check_in_status.eq.approved');

      if (checkInsError) {
        console.error('Error loading check-ins count:', checkInsError);
      } else {
        setTotalCheckIns(checkInsCount || 0);
      }
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  const handleSignUp = async () => {
    if (!user || !opportunity) return;

    // Check if signup is within date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (opportunity.dateStart || opportunity.dateEnd) {
      const startDate = opportunity.dateStart ? new Date(opportunity.dateStart) : null;
      const endDate = opportunity.dateEnd ? new Date(opportunity.dateEnd) : null;
      
      if (startDate) {
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        if (today < start) {
          showAlert('Not Available', 'Sign-ups are not yet open for this opportunity', 'warning');
          return;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        if (today > end) {
          showAlert('Closed', 'Sign-ups for this opportunity have closed', 'warning');
          return;
        }
      }
    }

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

const handleShareQRCode = async () => {
     try {
       if (!qrCodeRef.current) return;

       // Capture the QR code as an image
       const uri = await captureRef(qrCodeRef, {
         format: 'png',
         quality: 1,
       });

       // Check if sharing is available
       const isAvailable = await Sharing.isAvailableAsync();
       if (isAvailable) {
         await Sharing.shareAsync(uri);
       } else {
         showAlert('Info', 'Sharing is not available on this device', 'warning');
       }
     } catch (error) {
       console.error('Error sharing QR code:', error);
       showAlert('Error', 'Failed to share QR code', 'error');
     }
   };

  const getCategoryColor = (category: string) => {
    const categoryColors: { [key: string]: string } = {
      environment: '#10B981',
      education: '#3B82F6',
      healthcare: '#EF4444',
      community: '#8B5CF6',
      poorRelief: '#F59E0B',
      viEngage: '#FF6B35',
    };
    return categoryColors[category] || colors.primary;
  };

  // Check if today is the opportunity date
  const isToday = (dateString: string) => {
    const oppDate = new Date(dateString);
    const today = new Date();
    return (
      oppDate.getDate() === today.getDate() &&
      oppDate.getMonth() === today.getMonth() &&
      oppDate.getFullYear() === today.getFullYear()
    );
  };

  // Determine if check-in button should show
  const shouldShowCheckInButton = () => {
    return (
      isSignedUp &&
      !isAdmin &&
      opportunity &&
      isToday(opportunity.date) &&
      !hasCheckedIn &&
      signupStatus !== 'cancelled'
    );
  };

  // Handle manual check-in
  const handleManualCheckIn = async () => {
    if (!user || !opportunity) return;

    try {
      setCheckInModalVisible(false);
      setSubmitting(true);

      const { error } = await supabase
        .from('opportunity_signups')
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          check_in_method: 'manual',
          check_in_status: 'pending_approval',
        })
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setHasCheckedIn(true);
      setCheckInStatus('pending_approval');
      showAlert('Success!', 'Check-in successful! Waiting for admin approval.', 'success');
      
      // Reload status
      checkSignupStatus();
    } catch (error: any) {
      console.error('Error checking in:', error);
      showAlert('Error', error.message || 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle QR code check-in
const handleQRCheckIn = () => {
  setCheckInModalVisible(false);
  setQrScannerVisible(true);
};

// Handle successful QR scan
const handleQRScan = async (scannedCode: string) => {
  setQrScannerVisible(false);
  
  if (!user || !opportunity) return;

  // Verify the scanned code matches the opportunity's check-in code
  if (scannedCode !== opportunity.checkInCode) {
    showAlert('Invalid QR Code', 'This QR code does not match this opportunity.', 'error');
    return;
  }

  try {
    setSubmitting(true);

    const { error } = await supabase
      .from('opportunity_signups')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        check_in_method: 'qr_code',
        check_in_status: 'approved', // QR scans are auto-approved
      })
      .eq('opportunity_id', opportunityId)
      .eq('user_id', user.id);

    if (error) throw error;

    setHasCheckedIn(true);
    setCheckInStatus('approved');
    showAlert('Success!', 'You have been checked in successfully! 🎉', 'success');
    
    // Reload status
    checkSignupStatus();
  } catch (error: any) {
    console.error('Error checking in with QR:', error);
    showAlert('Error', error.message || 'Failed to check in', 'error');
  } finally {
    setSubmitting(false);
  }
};

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!opportunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Opportunity not found
          </Text>
        </View>
      </View>
    );
  }

  const categoryColor = getCategoryColor(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;
  const isFull = spotsLeft <= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          {/* Share Button - Available for all users */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => setShowShareModal(true)}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Admin Actions */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => router.push(`/edit-opportunity/${opportunityId}`)}
              >
                <Edit size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.success + '15' }]}
                onPress={() => setQrModalVisible(true)}
              >
                <QrCode size={20} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.error + '15' }]}
                onPress={handleDelete}
                disabled={submitting}
              >
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* 🔥 FIXED: Conditional rendering based on active tab */}
      {activeTab === 'details' ? (
        // ✅ Details Tab: Has ScrollView for scrolling
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Image */}
          {opportunity.imageUrl && (
            <Image source={{ uri: opportunity.imageUrl }} style={styles.image} />
          )}

          {/* Check-In Button - Full Width, Above Title */}
          {shouldShowCheckInButton() && (
            <View style={styles.checkInButtonContainer}>
              <TouchableOpacity
                style={[styles.checkInButton, { backgroundColor: colors.success }]}
                onPress={() => setCheckInModalVisible(true)}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <CheckCircle size={24} color="#FFFFFF" />
                <Text style={styles.checkInButtonText}>Check In Now</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.content}>
            {/* Category and Verified Badge */}
            <View style={styles.badgeRow}>
              <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '15' }]}>
                <Text style={[styles.categoryText, { color: categoryColor }]}>
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
              <TouchableOpacity 
                style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  if (opportunity.mapLink) {
                    Linking.openURL(opportunity.mapLink);
                  }
                }}
                disabled={!opportunity.mapLink}
                activeOpacity={opportunity.mapLink ? 0.7 : 1}
              >
                <MapPin size={20} color={opportunity.mapLink ? colors.primary : colors.textSecondary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
                <Text style={[
                  styles.infoValue, 
                  { color: colors.text },
                  !opportunity.mapLink && { color: colors.textSecondary }
                ]} numberOfLines={2}>
                  {opportunity.location}
                </Text>
              </TouchableOpacity>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Calendar size={20} color={colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {opportunity.dateStart && opportunity.dateEnd ? (
                    opportunity.dateStart === opportunity.dateEnd ? (
                      new Date(opportunity.dateStart).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    ) : (
                      `${new Date(opportunity.dateStart).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })} - ${new Date(opportunity.dateEnd).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`
                    )
                  ) : (
                    new Date(opportunity.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  )}
                </Text>
              </View>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Clock size={20} color={colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {opportunity.timeStart && opportunity.timeEnd 
                    ? `${opportunity.timeStart} - ${opportunity.timeEnd}`
                    : opportunity.duration || 'TBD'}
                </Text>
              </View>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Users size={20} color={isLimited ? colors.warning : colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Spots Left</Text>
                <Text style={[styles.infoValue, { color: isLimited ? colors.warning : colors.text }]}>
                  {spotsLeft} / {opportunity.spotsTotal}
                </Text>
              </View>
            </View>

            {/* Admin Stats - Only visible to admins */}
            {isAdmin && (
              <View style={styles.adminStatsContainer}>
                <View style={[styles.adminStatsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Users size={20} color={colors.primary} />
                  <Text style={[styles.adminStatsLabel, { color: colors.textSecondary }]}>Total Signups</Text>
                  <Text style={[styles.adminStatsValue, { color: colors.text }]}>{totalSignups}</Text>
                </View>
                <View style={[styles.adminStatsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <CheckCircle size={20} color={colors.success} />
                  <Text style={[styles.adminStatsLabel, { color: colors.textSecondary }]}>Checked In</Text>
                  <Text style={[styles.adminStatsValue, { color: colors.success }]}>{totalCheckIns}</Text>
                </View>
              </View>
            )}

            {/* Tabs - Show if user is signed up OR is admin */}
            {((isSignedUp && signupStatus !== 'cancelled') || isAdmin) && (
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                  onPress={() => setActiveTab('details')}
                >
                  <FileText size={18} color={activeTab === 'details' ? colors.primary : colors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'details' && styles.activeTabText,
                    { color: activeTab === 'details' ? colors.primary : colors.textSecondary }
                  ]}>
                    Details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
                  onPress={() => setActiveTab('chat')}
                >
                  <MessageCircle size={18} color={activeTab === 'chat' ? colors.primary : colors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'chat' && styles.activeTabText,
                    { color: activeTab === 'chat' ? colors.primary : colors.textSecondary }
                  ]}>
                    Chat
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, activeTab === 'participants' && styles.activeTab]}
                  onPress={() => setActiveTab('participants')}
                >
                  <Users size={18} color={activeTab === 'participants' ? colors.primary : colors.textSecondary} />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'participants' && styles.activeTabText,
                    { color: activeTab === 'participants' ? colors.primary : colors.textSecondary }
                  ]}>
                    Participants
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Details Content */}
            <View style={styles.tabContent}>
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
                <View style={[styles.impactCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Award size={24} color={colors.primary} />
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
                    <CheckCircle size={20} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Skills Needed</Text>
                  </View>
                  <View style={styles.skillsContainer}>
                    {opportunity.skillsNeeded.map((skill, index) => (
                      <View 
                        key={index} 
                        style={[styles.skillChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <Text style={[styles.skillChipText, { color: colors.text }]}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Links */}
              {opportunity.links && opportunity.links.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <ExternalLink size={20} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Links</Text>
                  </View>
                  <View style={styles.linksContainer}>
                    {opportunity.links.map((link, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => Linking.openURL(link.url)}
                      >
                        <View style={styles.linkButtonContent}>
                          <ExternalLink size={18} color={colors.primary} />
                          <Text style={[styles.linkButtonLabel, { color: colors.text }]}>
                            {link.label}
                          </Text>
                        </View>
                        <Text 
                          style={[styles.linkButtonUrl, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {link.url}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

  {/* Contact Person */}
              {(opportunity.contactPersonName || opportunity.contactPersonPhone) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Users size={20} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Person</Text>
                  </View>
                  <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {opportunity.contactPersonName && (
                      <View style={styles.contactNameContainer}>
                        <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Name</Text>
                        <Text style={[styles.contactName, { color: colors.text }]}>
                          {opportunity.contactPersonName}
                        </Text>
                      </View>
                    )}
                    {opportunity.contactPersonPhone && (
                      <View style={styles.contactPhoneContainer}>
                        <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Phone</Text>
                        <TouchableOpacity
                          style={[styles.phoneButton, { backgroundColor: colors.primary }]}
                          onPress={() => Linking.openURL(`tel:${opportunity.contactPersonPhone}`)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.phoneButtonText}>
                            📞 Call {opportunity.contactPersonPhone}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
            
              ) : activeTab === 'chat' ? (
        // ✅ Chat Tab: No ScrollView wrapper, FlatList handles its own scrolling
        <View style={styles.tabFullScreen}>
          {/* Show tabs at top */}
          {((isSignedUp && signupStatus !== 'cancelled') || isAdmin) && (
            <View style={[styles.tabsContainerSticky, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                onPress={() => setActiveTab('details')}
              >
                <FileText size={18} color={activeTab === 'details' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'details' && styles.activeTabText,
                  { color: activeTab === 'details' ? colors.primary : colors.textSecondary }
                ]}>
                  Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
                onPress={() => setActiveTab('chat')}
              >
                <MessageCircle size={18} color={activeTab === 'chat' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'chat' && styles.activeTabText,
                  { color: activeTab === 'chat' ? colors.primary : colors.textSecondary }
                ]}>
                  Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'participants' && styles.activeTab]}
                onPress={() => setActiveTab('participants')}
              >
                <Users size={18} color={activeTab === 'participants' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'participants' && styles.activeTabText,
                  { color: activeTab === 'participants' ? colors.primary : colors.textSecondary }
                ]}>
                  Participants
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <OpportunityGroupChat 
            opportunityId={opportunityId}
            opportunityTitle={opportunity.title}
          />
        </View>
      ) : (
        // ✅ Participants Tab: No ScrollView wrapper, FlatList handles its own scrolling
        <View style={styles.tabFullScreen}>
          {/* Show tabs at top */}
          {((isSignedUp && signupStatus !== 'cancelled') || isAdmin) && (
            <View style={[styles.tabsContainerSticky, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                onPress={() => setActiveTab('details')}
              >
                <FileText size={18} color={activeTab === 'details' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'details' && styles.activeTabText,
                  { color: activeTab === 'details' ? colors.primary : colors.textSecondary }
                ]}>
                  Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
                onPress={() => setActiveTab('chat')}
              >
                <MessageCircle size={18} color={activeTab === 'chat' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'chat' && styles.activeTabText,
                  { color: activeTab === 'chat' ? colors.primary : colors.textSecondary }
                ]}>
                  Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'participants' && styles.activeTab]}
                onPress={() => setActiveTab('participants')}
              >
                <Users size={18} color={activeTab === 'participants' ? colors.primary : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === 'participants' && styles.activeTabText,
                  { color: activeTab === 'participants' ? colors.primary : colors.textSecondary }
                ]}>
                  Participants
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <ParticipantsList
            opportunityId={opportunityId}
            isAdmin={isAdmin || false}
            onCheckInApproved={() => {
              loadOpportunityDetails();
              if (isAdmin) {
                loadAdminStats();
              }
            }}
          />
        </View>
      )}

      {/* Bottom Action Button - FIXED at bottom (Only for non-admins) */}
      {!isAdmin && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {isSignedUp ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={handleCancelSignup}
              disabled={submitting}
            >
              <Text style={styles.actionButtonText}>
                {submitting ? 'Cancelling...' : 'Cancel Signup'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isFull ? colors.textSecondary : colors.primary },
              ]}
              onPress={handleSignUp}
              disabled={submitting || isFull}
            >
              <Text style={styles.actionButtonText}>
                {submitting ? 'Signing Up...' : isFull ? 'Opportunity Full' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Check-In Modal */}
      <Modal
        visible={checkInModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckInModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Check In
              </Text>
              <TouchableOpacity
                onPress={() => setCheckInModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Choose your check-in method
            </Text>

            {/* Check-in Options */}
            <View style={styles.checkInOptions}>
              {/* QR Code Option */}
              <TouchableOpacity
                style={[styles.checkInOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleQRCheckIn}
                activeOpacity={0.7}
              >
                <View style={[styles.checkInOptionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <QrCode size={32} color={colors.primary} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>
                  Scan QR Code
                </Text>
                <Text style={[styles.checkInOptionDescription, { color: colors.textSecondary }]}>
                  Scan the event QR code
                </Text>
              </TouchableOpacity>

              {/* Manual Option */}
              <TouchableOpacity
                style={[styles.checkInOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleManualCheckIn}
                activeOpacity={0.7}
              >
                <View style={[styles.checkInOptionIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <CheckCircle size={32} color={colors.success} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>
                  Manual Check-In
                </Text>
                <Text style={[styles.checkInOptionDescription, { color: colors.textSecondary }]}>
                  Check in without scanning
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* QR Code Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContent, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.qrModalHeader}>
              <Text style={[styles.qrModalTitle, { color: colors.text }]}>
                Check-In QR Code
              </Text>
              <TouchableOpacity
                style={styles.qrCloseButton}
                onPress={() => setQrModalVisible(false)}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* QR Code Display */}
            <View 
              ref={qrCodeRef}
              style={styles.qrCodeContainer}
              collapsable={false}
            >
              <View style={[styles.qrCodeInner, { backgroundColor: '#FFFFFF' }]}>
                {opportunity?.checkInCode ? (
                  <>
                    <QRCode
                      value={opportunity.checkInCode}
                      size={250}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                    <Text style={styles.qrCodeText}>
                      {opportunity.checkInCode}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.qrErrorText}>No check-in code available</Text>
                )}
              </View>
            </View>

            {/* Instructions */}
            <View style={[styles.qrInstructions, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.qrInstructionsTitle, { color: colors.primary }]}>
                How to use:
              </Text>
              <Text style={[styles.qrInstructionsText, { color: colors.text }]}>
                1. Display this QR code at the event entrance{'\n'}
                2. Volunteers scan with their camera{'\n'}
                3. They'll be automatically checked in
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.qrActions}>
              <TouchableOpacity
                style={[styles.qrActionButton, { backgroundColor: colors.primary }]}
                onPress={handleShareQRCode}
              >
                <ExternalLink size={20} color="#FFFFFF" />
                <Text style={styles.qrActionButtonText}>Share QR Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />

      {/* Share Opportunity Modal */}
      {opportunity && (
        <ShareOpportunityModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          onShare={handleShare}
          opportunity={opportunity}
          sharing={sharing}
        />
      )}

      {/* QR Scanner */}
      <QRScanner
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={handleQRScan}
        expectedCode={opportunity?.checkInCode}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  tabFullScreen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
  },
  tabContent: {
    marginTop: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  adminStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  adminStatsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  adminStatsLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  adminStatsValue: {
    fontSize: 20,
    fontWeight: 'bold',
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
  linksContainer: {
    gap: 12,
  },
  linkButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  linkButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButtonUrl: {
    fontSize: 13,
    marginLeft: 28,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginTop: 24,
  },
  tabsContainerSticky: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.light.primary,
  },
  checkInButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    marginBottom: 24,
  },
  checkInOptions: {
    gap: 16,
  },
  checkInOption: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  checkInOptionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkInOptionDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
qrModalContent: {
      backgroundColor: Colors.light.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: '90%',
    },
    qrModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    qrModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    qrCloseButton: {
      padding: 8,
    },
    qrCodeContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    qrCodeInner: {
      padding: 20,
      borderRadius: 16,
      alignItems: 'center',
    },
    qrCodeText: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
      letterSpacing: 2,
    },
    qrErrorText: {
      fontSize: 14,
      color: Colors.light.error,
      textAlign: 'center',
    },
    qrInstructions: {
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    qrInstructionsTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    qrInstructionsText: {
      fontSize: 14,
      lineHeight: 22,
    },
    qrActions: {
      gap: 12,
    },
    qrActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
    },
    qrActionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    contactCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  contactNameContainer: {
    gap: 6,
  },
  contactPhoneContainer: {
    gap: 8,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
  },
  phoneButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  });
