/**
 * Opportunity Details Screen (Dynamic Route)
 * Shows full opportunity information with sign-up for volunteers
 * and edit/delete options for admins
 * 
 * MODERNIZED v2: Premium UI with proper shadows, gradients, tight spacing
 * - Hero image with gradient overlay + floating badges
 * - Compact 2x2 info card grid with elevation
 * - Animated tab bar with sliding indicator
 * - Gradient buttons with shadow layers
 * - Press animations throughout
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  Bookmark,
  Phone,
  ChevronRight,
} from 'lucide-react-native';
import { Opportunity } from '../../types';
import { supabase } from '../../services/supabase';
import CustomAlert from '../../components/CustomAlert';
import OpportunityGroupChat from '../../components/OpportunityGroupChat';
import ParticipantsList from '../../components/ParticipantsList';
import QRScanner from '../../components/QRScanner';
import ShareOpportunityModal from '../../components/ShareOpportunityModal';
import { useFeed } from '../../contexts/FeedContext';
import { goBack } from '../../utils/navigation';

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    environment: '#10B981',
    education: '#3B82F6',
    healthcare: '#EF4444',
    community: '#8B5CF6',
    poorRelief: '#F59E0B',
    viEngage: '#FF6B35',
  };
  return categoryColors[category] || '#3B82F6';
};

// ============================================================================
// MEMOIZED HERO IMAGE (Prevents reload/flicker loop)
// ============================================================================
interface MemoizedHeroImageProps {
  imageUrl: string | null | undefined;
  categoryColor: string;
  category: string;
  isVerified: boolean;
  successColor: string;
}

const MemoizedHeroImage = React.memo<MemoizedHeroImageProps>(
  ({ imageUrl, categoryColor, category, isVerified, successColor }) => {
    if (!imageUrl) return null;

    return (
      <View style={memoImageStyles.heroContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={memoImageStyles.heroImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={memoImageStyles.heroGradient}
        />
        <View style={[memoImageStyles.heroBadge, { backgroundColor: categoryColor }]}>
          <Text style={memoImageStyles.heroBadgeText}>{category.toUpperCase()}</Text>
        </View>
        {isVerified && (
          <View style={[memoImageStyles.heroVerified, { backgroundColor: successColor }]}>
            <CheckCircle size={12} color="#FFF" />
            <Text style={memoImageStyles.heroVerifiedText}>Verified</Text>
          </View>
        )}
      </View>
    );
  },
  // Custom comparison - only re-render if these specific props change
  (prevProps, nextProps) => {
    return (
      prevProps.imageUrl === nextProps.imageUrl &&
      prevProps.category === nextProps.category &&
      prevProps.isVerified === nextProps.isVerified
    );
  }
);

// Styles for memoized hero image (defined outside to prevent recreation)
const memoImageStyles = StyleSheet.create({
  heroContainer: { height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  heroBadge: { position: 'absolute', top: 16, left: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroVerified: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  heroVerifiedText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
});

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

// Press-animated wrapper with scale feedback
const AnimatedPressable: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  scaleValue?: number;
}> = ({ children, onPress, disabled, style, scaleValue = 0.97 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleValue,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Animated Tab Bar with sliding indicator
interface TabBarProps {
  activeTab: 'details' | 'chat' | 'participants';
  onTabChange: (tab: 'details' | 'chat' | 'participants') => void;
  chatBadge: number;
  colors: typeof Colors.light;
}

const AnimatedTabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, chatBadge, colors }) => {
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = (SCREEN_WIDTH - 32) / 3;

  useEffect(() => {
    const index = activeTab === 'details' ? 0 : activeTab === 'chat' ? 1 : 2;
    Animated.spring(indicatorAnim, {
      toValue: index * tabWidth,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabWidth]);

  const tabs = [
    { key: 'details' as const, label: 'Details', Icon: FileText },
    { key: 'chat' as const, label: 'Chat', Icon: MessageCircle, badge: chatBadge },
    { key: 'participants' as const, label: 'Participants', Icon: Users },
  ];

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View
        style={[
          styles.tabIndicator,
          {
            width: tabWidth - 8,
            backgroundColor: colors.primary,
            transform: [{ translateX: Animated.add(indicatorAnim, new Animated.Value(4)) }],
          },
        ]}
      />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <tab.Icon size={18} color={isActive ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? '700' : '500' }]}>
              {tab.label}
            </Text>
            {tab.badge && tab.badge > 0 && !isActive && (
              <View style={[styles.tabBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.tabBadgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function OpportunityDetailsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin, isSup } = useAuth();
  const { shareOpportunityToFeed } = useFeed();
  const params = useLocalSearchParams();

  // Support both [slug].tsx route and legacy [id].tsx route
  // The route param will be in params.slug for [slug].tsx or params.id for [id].tsx
  const identifier = (params.slug || params.id) as string;

  // Helper to check if string is a valid UUID
  const isValidUUID = (str: string): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // State
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupStatus, setSignupStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'participants'>('details');
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);
  const [totalSignups, setTotalSignups] = useState(0);
  const [totalCheckIns, setTotalCheckIns] = useState(0);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const qrCodeRef = useRef<View>(null);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'success' as const });

  // Flag to prevent unnecessary reloading
  const [dataLoaded, setDataLoaded] = useState(false);

  // Memoized image source to prevent flickering
  const imageSource = useMemo(() => {
    return opportunity?.imageUrl ? { uri: opportunity.imageUrl } : null;
  }, [opportunity?.imageUrl]);

  const showAlert = useCallback((title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  }, []);

  // ============================================================================
  // DATA LOADING - Protected against reload loops
  // ============================================================================

  // Step 1: Load opportunity details first (by slug or UUID)
  useEffect(() => {
    if (identifier && !dataLoaded) {
      loadOpportunityDetails();
    }
  }, [identifier, dataLoaded]);

  // Step 2: After opportunity is loaded, check signup/save status using the REAL UUID
  useEffect(() => {
    if (opportunity?.id && user) {
      checkSignupStatus(opportunity.id);
      checkSaveStatus(opportunity.id);
    }
  }, [opportunity?.id, user?.id]);

  // Step 3: Load admin stats separately when admin status is confirmed
  useEffect(() => {
    if (isAdmin && opportunity?.id && dataLoaded) {
      loadAdminStats(opportunity.id);
    }
  }, [isAdmin, opportunity?.id, dataLoaded]);

  useEffect(() => {
    if (activeTab === 'chat') setChatMessageCount(0);
  }, [activeTab]);

  const loadOpportunityDetails = async () => {
    try {
      setLoading(true);

      // Query by UUID if valid, otherwise query by slug (with UUID fallback)
      let data = null;
      let error = null;

      if (isValidUUID(identifier)) {
        // It's a UUID, query by id directly
        const result = await supabase
          .from('opportunities')
          .select('*')
          .eq('id', identifier)
          .single();
        data = result.data;
        error = result.error;
      } else {
        // It's a slug, try slug first
        const slugResult = await supabase
          .from('opportunities')
          .select('*')
          .eq('slug', identifier)
          .maybeSingle();

        if (slugResult.data) {
          data = slugResult.data;
        } else {
          // Fallback: maybe it's a UUID that failed the regex (shouldn't happen, but safe)
          const idResult = await supabase
            .from('opportunities')
            .select('*')
            .eq('id', identifier)
            .single();
          data = idResult.data;
          error = idResult.error;
        }
      }

      if (error) throw error;
      if (!data) throw new Error('Opportunity not found');

      setOpportunity({
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
      });

      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading opportunity:', error);
      showAlert('Error', 'Failed to load opportunity details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkSignupStatus = async (opportunityUuid: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('opportunity_signups')
        .select('status, checked_in, check_in_status')
        .eq('opportunity_id', opportunityUuid)
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

  const checkSaveStatus = async (opportunityUuid: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityUuid)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking save status:', error);
    }
  };

  const loadAdminStats = async (opportunityUuid: string) => {
    if (!isAdmin) return;
    try {
      const { count: signupsCount } = await supabase
        .from('opportunity_signups')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityUuid)
        .neq('status', 'cancelled');
      setTotalSignups(signupsCount || 0);

      const { count: checkInsCount } = await supabase
        .from('opportunity_signups')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityUuid)
        .or('checked_in.eq.true,check_in_status.eq.approved');
      setTotalCheckIns(checkInsCount || 0);
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================
  const handleSaveOpportunity = async () => {
    if (!user || !opportunity) return;
    setSavingBookmark(true);
    try {
      if (isSaved) {
        await supabase.from('saved_opportunities').delete().eq('user_id', user.id).eq('opportunity_id', opportunity.id);
        setIsSaved(false);
        showAlert('Removed', 'Opportunity removed from saved', 'success');
      } else {
        await supabase.from('saved_opportunities').insert([{ user_id: user.id, opportunity_id: opportunity.id, saved_at: new Date().toISOString() }]);
        setIsSaved(true);
        showAlert('Saved', 'Opportunity saved to your list', 'success');
      }
    } catch (error) {
      console.error('Error saving opportunity:', error);
      showAlert('Error', 'Failed to save opportunity', 'error');
    } finally {
      setSavingBookmark(false);
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
      const { data: result, error } = await supabase.rpc('sign_up_for_opportunity', {
        p_opportunity_id: opportunity.id,
      });
      if (error) throw error;
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to sign up');
      }
      setIsSignedUp(true);
      setSignupStatus('confirmed');
      showAlert('Success!', 'You have successfully signed up for this opportunity', 'success');
      // Refresh data
      setDataLoaded(false);
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
      const { data: result, error } = await supabase.rpc('cancel_opportunity_signup', {
        p_opportunity_id: opportunity.id,
      });
      if (error) throw error;
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to cancel signup');
      }
      setIsSignedUp(false);
      setSignupStatus(null);
      showAlert('Cancelled', 'Your signup has been cancelled', 'success');
      // Refresh data
      setDataLoaded(false);
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
      await supabase.from('opportunities').delete().eq('id', opportunity.id);
      showAlert('Deleted', 'Opportunity has been deleted', 'success');
      setTimeout(() => goBack('/(tabs)/discover'), 1500);
    } catch (error: any) {
      console.error('Error deleting opportunity:', error);
      showAlert('Error', error.message || 'Failed to delete opportunity', 'error');
    } finally {
      setSubmitting(false);
    }
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

  const handleShareQRCode = async () => {
    try {
      if (!qrCodeRef.current) return;
      const uri = await captureRef(qrCodeRef, { format: 'png', quality: 1 });
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

  const handleManualCheckIn = async () => {
    if (!user || !opportunity) return;
    try {
      setCheckInModalVisible(false);
      setSubmitting(true);
      await supabase.from('opportunity_signups').update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        check_in_method: 'manual',
        check_in_status: 'pending_approval',
      }).eq('opportunity_id', opportunity.id).eq('user_id', user.id);
      setHasCheckedIn(true);
      setCheckInStatus('pending_approval');
      showAlert('Success!', 'Check-in successful! Waiting for admin approval.', 'success');
      checkSignupStatus(opportunity.id);
    } catch (error: any) {
      console.error('Error checking in:', error);
      showAlert('Error', error.message || 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQRCheckIn = () => {
    setCheckInModalVisible(false);
    setQrScannerVisible(true);
  };

  const handleQRScan = async (scannedCode: string) => {
    setQrScannerVisible(false);
    if (!user || !opportunity) return;
    if (scannedCode !== opportunity.checkInCode) {
      showAlert('Invalid QR Code', 'This QR code does not match this opportunity.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await supabase.from('opportunity_signups').update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        check_in_method: 'qr_code',
        check_in_status: 'approved',
      }).eq('opportunity_id', opportunity.id).eq('user_id', user.id);
      setHasCheckedIn(true);
      setCheckInStatus('approved');
      showAlert('Success!', 'You have been checked in successfully! 🎉', 'success');
      checkSignupStatus(opportunity.id);
    } catch (error: any) {
      console.error('Error checking in with QR:', error);
      showAlert('Error', error.message || 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  const shouldShowCheckInButton = () => {
    if (!isSignedUp || isAdmin || !opportunity || hasCheckedIn || signupStatus === 'cancelled') return false;
    const now = new Date();
    if (opportunity.dateEnd) {
      const endDate = new Date(opportunity.dateEnd);
      endDate.setHours(23, 59, 59, 999);
      if (now <= endDate) {
        if (opportunity.dateStart) {
          const startDate = new Date(opportunity.dateStart);
          startDate.setHours(0, 0, 0, 0);
          return now >= startDate;
        }
        return true;
      }
      return false;
    }
    if (opportunity.date) {
      const oppDate = new Date(opportunity.date);
      return oppDate.toDateString() === now.toDateString();
    }
    return false;
  };

  const formatDateRange = () => {
    if (!opportunity) return '';
    if (opportunity.dateStart && opportunity.dateEnd) {
      if (opportunity.dateStart === opportunity.dateEnd) {
        return new Date(opportunity.dateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return `${new Date(opportunity.dateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(opportunity.dateEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return new Date(opportunity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = () => {
    if (!opportunity) return 'TBD';
    if (opportunity.timeStart && opportunity.timeEnd) return `${opportunity.timeStart} - ${opportunity.timeEnd}`;
    return opportunity.duration || 'TBD';
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/discover')} style={[styles.headerBtn, { backgroundColor: colors.card }]}>
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (!opportunity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/discover')} style={[styles.headerBtn, { backgroundColor: colors.card }]}>
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIcon, { backgroundColor: colors.error + '15' }]}>
            <AlertCircle size={48} color={colors.error} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Opportunity Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>This opportunity may have been removed.</Text>
          <AnimatedPressable onPress={() => goBack('/(tabs)/discover')}>
            <LinearGradient colors={[colors.primary, colors.primaryDark || colors.primary]} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Go Back</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  const categoryColor = getCategoryColor(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;
  const isFull = spotsLeft <= 0;

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => goBack('/(tabs)/discover')} style={[styles.headerBtn, { backgroundColor: colors.card }]}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSaveOpportunity} disabled={savingBookmark} style={[styles.headerBtn, { backgroundColor: isSaved ? colors.primary + '20' : colors.card }]}>
            <Bookmark size={20} color={isSaved ? colors.primary : colors.textSecondary} fill={isSaved ? colors.primary : 'none'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowShareModal(true)} style={[styles.headerBtn, { backgroundColor: colors.primary + '15' }]}>
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>
          {/* Admin edit/delete/QR moved to Admin Dashboard -> Opportunities */}
        </View>
      </View>

      {/* CONTENT BY TAB */}
      {activeTab === 'details' ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>
          {/* HERO IMAGE WITH GRADIENT - Memoized to prevent reload loop */}
          <MemoizedHeroImage
            imageUrl={opportunity.imageUrl}
            categoryColor={categoryColor}
            category={opportunity.category}
            isVerified={opportunity.organizationVerified || false}
            successColor={colors.success}
          />

          {/* CHECK-IN BUTTON */}
          {shouldShowCheckInButton() && (
            <View style={styles.checkInContainer}>
              <AnimatedPressable onPress={() => setCheckInModalVisible(true)} disabled={submitting}>
                <LinearGradient colors={[colors.success, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.checkInBtn}>
                  <CheckCircle size={22} color="#FFF" />
                  <Text style={styles.checkInBtnText}>Check In Now</Text>
                </LinearGradient>
              </AnimatedPressable>
            </View>
          )}

          <View style={styles.content}>
            {/* TITLE & ORG */}
            {!imageSource && (
              <View style={styles.badgeRow}>
                <View style={[styles.categoryBadgeInline, { backgroundColor: categoryColor + '20' }]}>
                  <Text style={[styles.categoryBadgeInlineText, { color: categoryColor }]}>{opportunity.category.toUpperCase()}</Text>
                </View>
                {opportunity.organizationVerified && (
                  <View style={styles.verifiedInline}>
                    <CheckCircle size={14} color={colors.success} fill={colors.success} />
                    <Text style={[styles.verifiedInlineText, { color: colors.success }]}>Verified</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={[styles.title, { color: colors.text }]}>{opportunity.title}</Text>
            <View style={styles.orgRow}>
              <Text style={[styles.org, { color: colors.textSecondary }]}>{opportunity.organizationName}</Text>
              {opportunity.organizationVerified && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={12} color={colors.success} fill={colors.success} />
                  <Text style={[styles.verifiedBadgeText, { color: colors.success }]}>Verified</Text>
                </View>
              )}
            </View>

            {/* INFO LIST - Clean scannable rows */}
            <View style={styles.infoList}>
              {/* Date */}
              <View style={styles.infoRow}>
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.text }]}>{formatDateRange()}</Text>
              </View>

              {/* Time */}
              <View style={styles.infoRow}>
                <Clock size={18} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.text }]}>{formatTime()}</Text>
              </View>

              {/* Location - tappable */}
              <TouchableOpacity
                style={styles.infoRow}
                onPress={opportunity.mapLink ? () => Linking.openURL(opportunity.mapLink!) : undefined}
                disabled={!opportunity.mapLink}
                activeOpacity={0.7}
              >
                <MapPin size={18} color={opportunity.mapLink ? colors.primary : colors.textSecondary} />
                <Text style={[styles.infoText, { color: opportunity.mapLink ? colors.primary : colors.text, flex: 1 }]} numberOfLines={1}>{opportunity.location}</Text>
                {opportunity.mapLink && <ChevronRight size={18} color={colors.primary} />}
              </TouchableOpacity>

              {/* Spots - with urgency styling */}
              <View style={[styles.infoRow, isLimited && styles.urgencyRow, isLimited && { backgroundColor: colors.warning + '12' }]}>
                <Users size={18} color={isLimited ? colors.warning : colors.textSecondary} />
                <Text style={[styles.infoText, { color: isLimited ? colors.warning : colors.text, fontWeight: isLimited ? '600' : '400' }]}>
                  {isLimited ? `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!` : `${spotsLeft} of ${opportunity.spotsTotal} spots available`}
                </Text>
              </View>
            </View>

            {/* ADMIN STATS BANNER - subtle inline */}
            {isAdmin && (
              <View style={[styles.adminBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.adminBannerItem}>
                  <Users size={14} color={colors.primary} />
                  <Text style={[styles.adminBannerValue, { color: colors.text }]}>{totalSignups}</Text>
                  <Text style={[styles.adminBannerLabel, { color: colors.textSecondary }]}>signups</Text>
                </View>
                <View style={[styles.adminBannerDivider, { backgroundColor: colors.border }]} />
                <View style={styles.adminBannerItem}>
                  <CheckCircle size={14} color={colors.success} />
                  <Text style={[styles.adminBannerValue, { color: colors.text }]}>{totalCheckIns}</Text>
                  <Text style={[styles.adminBannerLabel, { color: colors.textSecondary }]}>checked in</Text>
                </View>
              </View>
            )}

            {/* TABS (if signed up or admin) */}
            {((isSignedUp && signupStatus !== 'cancelled') || isAdmin) && (
              <AnimatedTabBar activeTab={activeTab} onTabChange={setActiveTab} chatBadge={chatMessageCount} colors={colors} />
            )}

            {/* DETAILS CONTENT */}
            <View style={styles.detailsContent}>
              {/* About */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
                    <FileText size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                </View>
                <Text style={[styles.sectionBody, { color: colors.text }]}>{opportunity.description}</Text>
              </View>

              {/* Impact Statement */}
              {opportunity.impactStatement && (
                <View style={[styles.impactCard, { backgroundColor: colors.primary + '08', borderLeftColor: colors.primary }]}>
                  <View style={[styles.impactIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Award size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.impactText, { color: colors.text }]}>{opportunity.impactStatement}</Text>
                </View>
              )}

              {/* Requirements */}
              {opportunity.requirements && opportunity.requirements.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
                      <AlertCircle size={16} color={colors.warning} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Requirements</Text>
                  </View>
                  {opportunity.requirements.map((req, i) => (
                    <View key={i} style={styles.listItem}>
                      <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.listItemText, { color: colors.text }]}>{req}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Skills */}
              {opportunity.skillsNeeded && opportunity.skillsNeeded.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.success + '15' }]}>
                      <CheckCircle size={16} color={colors.success} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Skills Needed</Text>
                  </View>
                  <View style={styles.skillsWrap}>
                    {opportunity.skillsNeeded.map((skill, i) => (
                      <View key={i} style={[styles.skillChip, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                        <Text style={[styles.skillChipText, { color: colors.primary }]}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Links */}
              {opportunity.links && opportunity.links.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
                      <ExternalLink size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Links</Text>
                  </View>
                  {opportunity.links.map((link, i) => (
                    <AnimatedPressable key={i} onPress={() => Linking.openURL(link.url)} style={[styles.linkCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                      <View style={[styles.linkIcon, { backgroundColor: colors.primary + '15' }]}>
                        <ExternalLink size={16} color={colors.primary} />
                      </View>
                      <View style={styles.linkContent}>
                        <Text style={[styles.linkLabel, { color: colors.text }]}>{link.label}</Text>
                        <Text style={[styles.linkUrl, { color: colors.textSecondary }]} numberOfLines={1}>{link.url}</Text>
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              )}

              {/* Contact Person */}
              {(opportunity.contactPersonName || opportunity.contactPersonPhone) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
                      <Phone size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
                  </View>
                  <View style={[styles.contactCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                    {opportunity.contactPersonName && (
                      <Text style={[styles.contactName, { color: colors.text }]}>{opportunity.contactPersonName}</Text>
                    )}
                    {opportunity.contactPersonPhone && (
                      <AnimatedPressable onPress={() => Linking.openURL(`tel:${opportunity.contactPersonPhone}`)}>
                        <LinearGradient colors={[colors.primary, colors.primaryDark || colors.primary]} style={styles.callBtn}>
                          <Phone size={18} color="#FFF" />
                          <Text style={styles.callBtnText}>{opportunity.contactPersonPhone}</Text>
                        </LinearGradient>
                      </AnimatedPressable>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      ) : activeTab === 'chat' ? (
        <View style={styles.tabScreen}>
          <View style={{ paddingHorizontal: 16 }}>
            <AnimatedTabBar activeTab={activeTab} onTabChange={setActiveTab} chatBadge={chatMessageCount} colors={colors} />
          </View>
          <OpportunityGroupChat opportunityId={opportunity.id} opportunityTitle={opportunity.title} onMessageCountChange={setChatMessageCount} />
        </View>
      ) : (
        <View style={styles.tabScreen}>
          <View style={{ paddingHorizontal: 16 }}>
            <AnimatedTabBar activeTab={activeTab} onTabChange={setActiveTab} chatBadge={chatMessageCount} colors={colors} />
          </View>
          <ParticipantsList
            opportunityId={opportunity.id}
            isAdmin={(isAdmin || isSup) || false}
            onCheckInApproved={() => {
              loadOpportunityDetails();
              if ((isAdmin || isSup) && opportunity?.id) loadAdminStats(opportunity.id);
            }}
          />
        </View>
      )}

      {/* BOTTOM ACTION BAR */}
      {!isAdmin && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24, backgroundColor: colors.background, borderTopColor: colors.border, paddingTop: 12 }]}>
          {isSignedUp ? (
            <AnimatedPressable onPress={handleCancelSignup} disabled={submitting} style={{ flex: 1 }}>
              <View style={styles.actionBtnShadow}>
                <View style={[styles.actionBtnShadowInner, { backgroundColor: colors.error + '40' }]} />
              </View>
              <LinearGradient colors={[colors.error, '#DC2626']} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{submitting ? 'Cancelling...' : 'Cancel Signup'}</Text>
              </LinearGradient>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable onPress={handleSignUp} disabled={submitting || isFull} style={{ flex: 1 }}>
              <View style={styles.actionBtnShadow}>
                <View style={[styles.actionBtnShadowInner, { backgroundColor: isFull ? colors.textSecondary + '40' : colors.primary + '40' }]} />
              </View>
              <LinearGradient colors={isFull ? ['#9CA3AF', '#6B7280'] : [colors.primary, colors.primaryDark || colors.primary]} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{submitting ? 'Signing Up...' : isFull ? 'Opportunity Full' : 'Sign Up'}</Text>
              </LinearGradient>
            </AnimatedPressable>
          )}
        </View>
      )}

      {/* CHECK-IN MODAL */}
      <Modal visible={checkInModalVisible} transparent animationType="fade" onRequestClose={() => setCheckInModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Check In</Text>
              <TouchableOpacity onPress={() => setCheckInModalVisible(false)} style={[styles.modalClose, { backgroundColor: colors.card }]}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Choose your check-in method</Text>
            <View style={styles.checkInOptions}>
              <AnimatedPressable onPress={handleQRCheckIn} style={[styles.checkInOption, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                <View style={[styles.checkInOptionIcon, { backgroundColor: colors.primary + '15' }]}>
                  <QrCode size={28} color={colors.primary} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>Scan QR Code</Text>
                <Text style={[styles.checkInOptionDesc, { color: colors.textSecondary }]}>Scan the event QR code</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleManualCheckIn} style={[styles.checkInOption, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                <View style={[styles.checkInOptionIcon, { backgroundColor: colors.success + '15' }]}>
                  <CheckCircle size={28} color={colors.success} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>Manual Check-In</Text>
                <Text style={[styles.checkInOptionDesc, { color: colors.textSecondary }]}>Request admin approval</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR CODE MODAL */}
      <Modal visible={qrModalVisible} transparent animationType="slide" onRequestClose={() => setQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Check-In QR Code</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={[styles.modalClose, { backgroundColor: colors.card }]}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View ref={qrCodeRef} style={styles.qrContainer} collapsable={false}>
              <View style={styles.qrInner}>
                {opportunity?.checkInCode ? (
                  <>
                    <QRCode value={opportunity.checkInCode} size={220} backgroundColor="#FFF" color="#000" />
                    <Text style={styles.qrCodeText}>{opportunity.checkInCode}</Text>
                  </>
                ) : (
                  <Text style={[styles.qrError, { color: colors.error }]}>No check-in code available</Text>
                )}
              </View>
            </View>
            <View style={[styles.qrInstructions, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.qrInstructionsTitle, { color: colors.primary }]}>How to use:</Text>
              <Text style={[styles.qrInstructionsText, { color: colors.text }]}>1. Display this QR at the entrance{'\n'}2. Volunteers scan with their phone{'\n'}3. They're automatically checked in</Text>
            </View>
            <AnimatedPressable onPress={handleShareQRCode}>
              <LinearGradient colors={[colors.primary, colors.primaryDark || colors.primary]} style={styles.qrShareBtn}>
                <Share2 size={18} color="#FFF" />
                <Text style={styles.qrShareBtnText}>Share QR Code</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      {/* ALERTS & OTHER MODALS */}
      <CustomAlert visible={alertVisible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertVisible(false)} />
      {opportunity && <ShareOpportunityModal visible={showShareModal} onClose={() => setShowShareModal(false)} onShare={handleShare} opportunity={opportunity} sharing={sharing} />}
      <QRScanner visible={qrScannerVisible} onClose={() => setQrScannerVisible(false)} onScan={handleQRScan} expectedCode={opportunity?.checkInCode} />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // Loading/Error
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  scrollView: { flex: 1 },
  scrollContent: { maxWidth: 800, width: '100%' as any, alignSelf: 'center' as any },
  content: { padding: 16 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  categoryBadgeInline: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  categoryBadgeInlineText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  verifiedInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedInlineText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4, letterSpacing: -0.3 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  org: { fontSize: 15, fontWeight: '500' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedBadgeText: { fontSize: 12, fontWeight: '600' },

  // Info List - Clean scannable rows
  infoList: {
    gap: 2,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 20,
  },
  urgencyRow: {
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },

  // Admin Banner - subtle inline
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  adminBannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminBannerValue: { fontSize: 15, fontWeight: '700' },
  adminBannerLabel: { fontSize: 13 },
  adminBannerDivider: { width: 1, height: 16 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 8,
    opacity: 0.15,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: { fontSize: 13 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Tab Screen
  tabScreen: { flex: 1 },

  // Details Content
  detailsContent: { gap: 24 },

  // Sections
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionBody: { fontSize: 15, lineHeight: 24 },

  // Impact Card
  impactCard: { flexDirection: 'row', padding: 16, borderRadius: 14, borderLeftWidth: 4, gap: 12, alignItems: 'flex-start' },
  impactIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  impactText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },

  // List
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  listItemText: { flex: 1, fontSize: 15, lineHeight: 22 },

  // Skills
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  skillChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  skillChipText: { fontSize: 13, fontWeight: '600' },

  // Links
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  linkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  linkContent: { flex: 1 },
  linkLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  linkUrl: { fontSize: 12 },

  // Contact
  contactCard: {
    padding: 16,
    borderRadius: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  contactName: { fontSize: 17, fontWeight: '600' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  callBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Check-in Button
  checkInContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  checkInBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },
  checkInBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1
  },
  actionBtnShadow: { position: 'absolute', top: 4, left: 0, right: 0, bottom: -4 },
  actionBtnShadowInner: { flex: 1, borderRadius: 14, opacity: 0.4 },
  actionBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalDesc: { fontSize: 15, marginBottom: 20 },
  checkInOptions: { gap: 12 },
  checkInOption: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  checkInOptionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  checkInOptionTitle: { fontSize: 16, fontWeight: '700' },
  checkInOptionDesc: { fontSize: 13, textAlign: 'center' },

  // QR Modal
  qrModal: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24 },
  qrContainer: { alignItems: 'center', marginBottom: 20 },
  qrInner: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, alignItems: 'center' },
  qrCodeText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#000', letterSpacing: 2 },
  qrError: { fontSize: 14, padding: 20, textAlign: 'center' },
  qrInstructions: { padding: 16, borderRadius: 12, marginBottom: 16 },
  qrInstructionsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  qrInstructionsText: { fontSize: 13, lineHeight: 22 },
  qrShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  qrShareBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
