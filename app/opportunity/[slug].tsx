/**
 * Opportunity Details Screen (Dynamic Route)
 * Shows full opportunity information with sign-up for volunteers
 * and edit/delete options for admins
 * 
 * MODERNIZED: Added responsive design, animations, theme tokens, premium visuals
 * FIXED: Removed nested ScrollView to fix virtualization error
 * Each tab now handles its own scrolling independently
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react-native';
import { Opportunity } from '../../types';
import { supabase } from '../../services/supabase';
import CustomAlert from '../../components/CustomAlert';
import OpportunityGroupChat from '../../components/OpportunityGroupChat';
import ParticipantsList from '../../components/ParticipantsList';
import QRScanner from '../../components/QRScanner';
import ShareOpportunityModal from '../../components/ShareOpportunityModal';
import { useFeed } from '../../contexts/FeedContext';

// ============================================================================
// RESPONSIVE DESIGN SYSTEM
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Breakpoint = 'smallMobile' | 'mobile' | 'tablet' | 'desktop';

const getBreakpoint = (): Breakpoint => {
  if (SCREEN_WIDTH < 380) return 'smallMobile';
  if (SCREEN_WIDTH < 768) return 'mobile';
  if (SCREEN_WIDTH < 1024) return 'tablet';
  return 'desktop';
};

const getResponsiveValues = () => {
  const breakpoint = getBreakpoint();
  
  const values = {
    smallMobile: {
      heroHeight: 220,
      contentPadding: 14,
      titleSize: 24,
      sectionTitleSize: 16,
      bodySize: 14,
      labelSize: 11,
      cardPadding: 14,
      iconSize: 18,
      iconContainerSize: 40,
      buttonPadding: 14,
      maxContentWidth: '100%' as const,
      infoCardWidth: '48%' as const,
      spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    },
    mobile: {
      heroHeight: 280,
      contentPadding: 16,
      titleSize: 28,
      sectionTitleSize: 18,
      bodySize: 15,
      labelSize: 12,
      cardPadding: 16,
      iconSize: 20,
      iconContainerSize: 44,
      buttonPadding: 16,
      maxContentWidth: '100%' as const,
      infoCardWidth: '48%' as const,
      spacing: { xs: 4, sm: 8, md: 14, lg: 18, xl: 24 },
    },
    tablet: {
      heroHeight: 320,
      contentPadding: 24,
      titleSize: 32,
      sectionTitleSize: 20,
      bodySize: 16,
      labelSize: 12,
      cardPadding: 20,
      iconSize: 22,
      iconContainerSize: 48,
      buttonPadding: 18,
      maxContentWidth: 700,
      infoCardWidth: '23%' as const,
      spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
    },
    desktop: {
      heroHeight: 360,
      contentPadding: 32,
      titleSize: 36,
      sectionTitleSize: 22,
      bodySize: 16,
      labelSize: 13,
      cardPadding: 24,
      iconSize: 24,
      iconContainerSize: 52,
      buttonPadding: 20,
      maxContentWidth: 800,
      infoCardWidth: '23%' as const,
      spacing: { xs: 8, sm: 12, md: 20, lg: 28, xl: 40 },
    },
  };
  
  return values[breakpoint];
};

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

// Animated Tab Bar with sliding indicator
interface AnimatedTabBarProps {
  activeTab: 'details' | 'chat' | 'participants';
  onTabChange: (tab: 'details' | 'chat' | 'participants') => void;
  chatMessageCount: number;
  colors: typeof Colors.light;
}

const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  activeTab,
  onTabChange,
  chatMessageCount,
  colors,
}) => {
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const tabWidth = SCREEN_WIDTH / 3;
  
  useEffect(() => {
    const toValue = activeTab === 'details' ? 0 : activeTab === 'chat' ? 1 : 2;
    Animated.spring(indicatorPosition, {
      toValue,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);
  
  const translateX = indicatorPosition.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });
  
  const tabs = [
    { key: 'details' as const, label: 'Details', icon: FileText },
    { key: 'chat' as const, label: 'Chat', icon: MessageCircle, badge: chatMessageCount },
    { key: 'participants' as const, label: 'Participants', icon: Users },
  ];
  
  return (
    <View style={[tabBarStyles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {/* Sliding Indicator */}
      <Animated.View
        style={[
          tabBarStyles.indicator,
          {
            backgroundColor: colors.primary,
            width: tabWidth - 24,
            transform: [{ translateX: Animated.add(translateX, new Animated.Value(12)) }],
          },
        ]}
      />
      
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        
        return (
          <TouchableOpacity
            key={tab.key}
            style={tabBarStyles.tab}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Icon
              size={18}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <View style={tabBarStyles.tabLabelContainer}>
              <Text
                style={[
                  tabBarStyles.tabLabel,
                  { color: isActive ? colors.primary : colors.textSecondary },
                  isActive && tabBarStyles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.badge && tab.badge > 0 && !isActive && (
                <View style={[tabBarStyles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={tabBarStyles.badgeText}>{tab.badge}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

// Animated Press Card
interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  onPress,
  disabled = false,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };
  
  if (!onPress) {
    return <View style={style}>{children}</View>;
  }
  
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Animated Button with gradient
interface GradientButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
  gradientColors: [string, string];
  shadowColor?: string;
  style?: any;
}

const GradientButton: React.FC<GradientButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  label,
  loadingLabel,
  gradientColors,
  shadowColor,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const responsive = getResponsiveValues();
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Shadow Layer */}
        {shadowColor && (
          <View
            style={{
              position: 'absolute',
              top: 4,
              left: 0,
              right: 0,
              bottom: -4,
              backgroundColor: shadowColor,
              borderRadius: 14,
              opacity: 0.3,
            }}
          />
        )}
        <LinearGradient
          colors={disabled ? ['#9CA3AF', '#6B7280'] : gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            padding: responsive.buttonPadding + 2,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}
          >
            {loading ? (loadingLabel || 'Loading...') : label}
          </Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Shimmer Loading Effect
const ShimmerEffect: React.FC<{ style?: any }> = ({ style }) => {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);
  
  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.border,
          borderRadius: 8,
          opacity: shimmerAnim,
        },
        style,
      ]}
    />
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
  const { user, isAdmin } = useAuth();
  const { shareOpportunityToFeed } = useFeed();
  const params = useLocalSearchParams();
  const opportunityId = params.slug as string;
  const responsive = getResponsiveValues();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupStatus, setSignupStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'participants'>('details');
  const [chatMessageCount, setChatMessageCount] = useState<number>(0);
  
  // Check-in state
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);
  
  // Admin stats
  const [totalSignups, setTotalSignups] = useState<number>(0);
  const [totalCheckIns, setTotalCheckIns] = useState<number>(0);
  
  // QR Code state
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const qrCodeRef = useRef<View>(null);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  
  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Save state
  const [isSaved, setIsSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Image state - memoized to prevent flickering
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Memoize image source to prevent re-renders causing flickering
  const imageSource = useMemo(() => {
    if (opportunity?.imageUrl) {
      return { uri: opportunity.imageUrl };
    }
    return null;
  }, [opportunity?.imageUrl]);

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
      checkSaveStatus();
      if (isAdmin) {
        loadAdminStats();
      }
    }
  }, [opportunityId, isAdmin, user?.id]);

  // Clear chat message count when user opens the chat tab
  useEffect(() => {
    if (activeTab === 'chat') {
      setChatMessageCount(0);
    }
  }, [activeTab]);

  // Calculate and log check-in window debug info
  useEffect(() => {
    if (opportunity && (opportunity.dateStart || opportunity.dateEnd)) {
      const now = new Date();
      const startDate = opportunity.dateStart ? new Date(opportunity.dateStart) : null;
      const endDate = opportunity.dateEnd ? new Date(opportunity.dateEnd) : null;
      
      let isWithinCheckInWindow = false;
      if (startDate && endDate) {
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

  const checkSaveStatus = async () => {
    if (!user || !opportunityId) return;

    try {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking save status:', error);
    }
  };

  const handleSaveOpportunity = async () => {
    if (!user || !opportunity) return;

    setSavingBookmark(true);
    
    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_opportunities')
          .delete()
          .eq('user_id', user.id)
          .eq('opportunity_id', opportunity.id);

        if (error) throw error;
        setIsSaved(false);
        showAlert('Removed', 'Opportunity removed from saved', 'success');
      } else {
        const { error } = await supabase
          .from('saved_opportunities')
          .insert([
            {
              user_id: user.id,
              opportunity_id: opportunity.id,
              saved_at: new Date().toISOString(),
            }
          ]);

        if (error && error.code !== '23505') throw error;
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

  const loadAdminStats = async () => {
    if (!isAdmin) return;

    try {
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

    const now = new Date();
    
    if (opportunity.dateEnd) {
      const endDate = new Date(opportunity.dateEnd);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      end.setHours(23, 59, 59, 999);
      
      if (now > end) {
        showAlert('Closed', 'Sign-ups for this opportunity have closed', 'warning');
        return;
      }
    }

    if (opportunity.spotsAvailable <= 0) {
      showAlert('Full', 'This opportunity is currently full', 'warning');
      return;
    }

    try {
      setSubmitting(true);

      const { error: signupError } = await supabase
        .from('opportunity_signups')
        .insert({
          opportunity_id: opportunityId,
          user_id: user.id,
          status: 'confirmed',
          signed_up_at: new Date().toISOString(),
        });

      if (signupError) throw signupError;

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

      const { error: deleteError } = await supabase
        .from('opportunity_signups')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

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

      const uri = await captureRef(qrCodeRef, {
        format: 'png',
        quality: 1,
      });

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

  const isToday = (dateString: string) => {
    const oppDate = new Date(dateString);
    const today = new Date();
    return (
      oppDate.getDate() === today.getDate() &&
      oppDate.getMonth() === today.getMonth() &&
      oppDate.getFullYear() === today.getFullYear()
    );
  };

  const shouldShowCheckInButton = () => {
    if (!isSignedUp || isAdmin || !opportunity || hasCheckedIn || signupStatus === 'cancelled') {
      return false;
    }

    const now = new Date();
    
    if (opportunity.dateEnd) {
      const endDate = new Date(opportunity.dateEnd);
      const endOfEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      endOfEndDate.setHours(23, 59, 59, 999);
      
      if (now <= endOfEndDate) {
        if (opportunity.dateStart) {
          const startDate = new Date(opportunity.dateStart);
          const startOfStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          return now >= startOfStartDate;
        }
        return true;
      }
      return false;
    }
    
    if (opportunity.date) {
      return isToday(opportunity.date);
    }
    
    return false;
  };

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
      
      checkSignupStatus();
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

      const { error } = await supabase
        .from('opportunity_signups')
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          check_in_method: 'qr_code',
          check_in_status: 'approved',
        })
        .eq('opportunity_id', opportunityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setHasCheckedIn(true);
      setCheckInStatus('approved');
      showAlert('Success!', 'You have been checked in successfully! 🎉', 'success');
      
      checkSignupStatus();
    } catch (error: any) {
      console.error('Error checking in with QR:', error);
      showAlert('Error', error.message || 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
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
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading opportunity...
          </Text>
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
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconContainer, { backgroundColor: colors.error + '15' }]}>
            <AlertCircle size={48} color={colors.error} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Opportunity Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            This opportunity may have been removed or is no longer available.
          </Text>
          <TouchableOpacity
            style={[styles.errorButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const categoryColor = getCategoryColor(opportunity.category);
  const spotsLeft = opportunity.spotsAvailable;
  const isLimited = spotsLeft <= 5;
  const isFull = spotsLeft <= 0;

  // ============================================================================
  // RENDER INFO CARD
  // ============================================================================
  const renderInfoCard = (
    icon: React.ReactNode,
    label: string,
    value: string,
    onPress?: () => void,
    isWarning?: boolean
  ) => (
    <AnimatedCard
      onPress={onPress}
      style={[
        styles.infoCard,
        {
          backgroundColor: colors.card,
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
          shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
          width: responsive.infoCardWidth,
        },
      ]}
    >
      <View style={[styles.infoIconContainer, { backgroundColor: (isWarning ? colors.warning : colors.primary) + '15' }]}>
        {icon}
      </View>
      <Text style={[styles.infoLabel, { color: colors.textSecondary, fontSize: responsive.labelSize }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.infoValue,
          { color: isWarning ? colors.warning : colors.text, fontSize: responsive.bodySize - 1 },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </AnimatedCard>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerIconButton, { backgroundColor: colors.surfaceElevated || colors.card }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveOpportunity}
            disabled={savingBookmark}
            style={[styles.headerIconButton, { backgroundColor: colors.surfaceElevated || colors.card }]}
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save opportunity'}
          >
            <Bookmark
              size={20}
              color={isSaved ? colors.primary : colors.textSecondary}
              fill={isSaved ? colors.primary : 'none'}
            />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => setShowShareModal(true)}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Admin Actions */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={[styles.headerIconButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => router.push(`/edit-opportunity/${opportunityId}`)}
              >
                <Edit size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconButton, { backgroundColor: colors.success + '15' }]}
                onPress={() => setQrModalVisible(true)}
              >
                <QrCode size={20} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconButton, { backgroundColor: colors.error + '15' }]}
                onPress={handleDelete}
                disabled={submitting}
              >
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'details' ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Image with Gradient Overlay */}
          {imageSource && (
            <View style={[styles.heroContainer, { height: responsive.heroHeight }]}>
              <Image
                source={imageSource}
                style={styles.heroImage}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => setImageError(true)}
              />
              {/* Gradient Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.heroGradient}
              />
              {/* Floating Category Badge */}
              <View style={[styles.heroCategoryBadge, { backgroundColor: categoryColor }]}>
                <Text style={styles.heroCategoryText}>
                  {opportunity.category.toUpperCase()}
                </Text>
              </View>
              {/* Verified Badge on Hero */}
              {opportunity.organizationVerified && (
                <View style={[styles.heroVerifiedBadge, { backgroundColor: colors.success }]}>
                  <CheckCircle size={12} color="#FFFFFF" />
                  <Text style={styles.heroVerifiedText}>Verified</Text>
                </View>
              )}
            </View>
          )}

          {/* Check-In Button */}
          {shouldShowCheckInButton() && (
            <View style={[styles.checkInButtonContainer, { paddingHorizontal: responsive.contentPadding }]}>
              <TouchableOpacity
                onPress={() => setCheckInModalVisible(true)}
                disabled={submitting}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.success, '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkInButton}
                >
                  <CheckCircle size={24} color="#FFFFFF" />
                  <Text style={styles.checkInButtonText}>Check In Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.content, { padding: responsive.contentPadding }]}>
            {/* Category Badge (if no image) */}
            {!imageSource && (
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
            )}

            {/* Title */}
            <Text style={[styles.title, { color: colors.text, fontSize: responsive.titleSize }]}>
              {opportunity.title}
            </Text>

            {/* Organization */}
            <Text style={[styles.organization, { color: colors.textSecondary }]}>
              {opportunity.organizationName}
            </Text>

            {/* Info Cards Grid */}
            <View style={styles.infoGrid}>
              {renderInfoCard(
                <MapPin size={responsive.iconSize} color={opportunity.mapLink ? colors.primary : colors.textSecondary} />,
                'Location',
                opportunity.location,
                opportunity.mapLink ? () => Linking.openURL(opportunity.mapLink!) : undefined
              )}
              {renderInfoCard(
                <Calendar size={responsive.iconSize} color={colors.primary} />,
                'Date',
                opportunity.dateStart && opportunity.dateEnd
                  ? opportunity.dateStart === opportunity.dateEnd
                    ? new Date(opportunity.dateStart).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : `${new Date(opportunity.dateStart).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })} - ${new Date(opportunity.dateEnd).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}`
                  : new Date(opportunity.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
              )}
              {renderInfoCard(
                <Clock size={responsive.iconSize} color={colors.primary} />,
                'Time',
                opportunity.timeStart && opportunity.timeEnd
                  ? `${opportunity.timeStart} - ${opportunity.timeEnd}`
                  : opportunity.duration || 'TBD'
              )}
              {renderInfoCard(
                <Users size={responsive.iconSize} color={isLimited ? colors.warning : colors.primary} />,
                'Spots Left',
                `${spotsLeft} / ${opportunity.spotsTotal}`,
                undefined,
                isLimited
              )}
            </View>

            {/* Admin Stats */}
            {isAdmin && (
              <View style={styles.adminStatsContainer}>
                <View
                  style={[
                    styles.adminStatsCard,
                    {
                      backgroundColor: colors.card,
                      shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                      shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                    },
                  ]}
                >
                  <View style={[styles.adminStatsIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Users size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.adminStatsLabel, { color: colors.textSecondary }]}>Total Signups</Text>
                  <Text style={[styles.adminStatsValue, { color: colors.text }]}>{totalSignups}</Text>
                </View>
                <View
                  style={[
                    styles.adminStatsCard,
                    {
                      backgroundColor: colors.card,
                      shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                      shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                    },
                  ]}
                >
                  <View style={[styles.adminStatsIconContainer, { backgroundColor: colors.success + '15' }]}>
                    <CheckCircle size={20} color={colors.success} />
                  </View>
                  <Text style={[styles.adminStatsLabel, { color: colors.textSecondary }]}>Checked In</Text>
                  <Text style={[styles.adminStatsValue, { color: colors.success }]}>{totalCheckIns}</Text>
                </View>
              </View>
            )}

            {/* Tabs - Show if user is signed up OR is admin */}
            {((isSignedUp && signupStatus !== 'cancelled') || isAdmin) && (
              <AnimatedTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                chatMessageCount={chatMessageCount}
                colors={colors}
              />
            )}

            {/* Details Content */}
            <View style={styles.tabContent}>
              {/* Description */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <FileText size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsive.sectionTitleSize }]}>
                    About
                  </Text>
                </View>
                <Text style={[styles.description, { color: colors.text, fontSize: responsive.bodySize }]}>
                  {opportunity.description}
                </Text>
              </View>

              {/* Impact Statement */}
              {opportunity.impactStatement && (
                <View
                  style={[
                    styles.impactCard,
                    {
                      backgroundColor: colors.primary + '08',
                      borderColor: colors.primary + '20',
                    },
                  ]}
                >
                  <View style={[styles.impactIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Award size={24} color={colors.primary} />
                  </View>
                  <Text style={[styles.impactText, { color: colors.text, fontSize: responsive.bodySize }]}>
                    {opportunity.impactStatement}
                  </Text>
                </View>
              )}

              {/* Requirements */}
              {opportunity.requirements && opportunity.requirements.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconContainer, { backgroundColor: colors.warning + '15' }]}>
                      <AlertCircle size={18} color={colors.warning} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsive.sectionTitleSize }]}>
                      Requirements
                    </Text>
                  </View>
                  <View style={styles.listContainer}>
                    {opportunity.requirements.map((req, index) => (
                      <View key={index} style={styles.listItem}>
                        <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.listItemText, { color: colors.text, fontSize: responsive.bodySize }]}>
                          {req}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Skills Needed */}
              {opportunity.skillsNeeded && opportunity.skillsNeeded.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconContainer, { backgroundColor: colors.success + '15' }]}>
                      <CheckCircle size={18} color={colors.success} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsive.sectionTitleSize }]}>
                      Skills Needed
                    </Text>
                  </View>
                  <View style={styles.skillsContainer}>
                    {opportunity.skillsNeeded.map((skill, index) => (
                      <View
                        key={index}
                        style={[
                          styles.skillChip,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                            shadowOpacity: colorScheme === 'dark' ? 0.2 : 0.05,
                          },
                        ]}
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
                    <View style={[styles.sectionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <ExternalLink size={18} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsive.sectionTitleSize }]}>
                      Links
                    </Text>
                  </View>
                  <View style={styles.linksContainer}>
                    {opportunity.links.map((link, index) => (
                      <AnimatedCard
                        key={index}
                        onPress={() => Linking.openURL(link.url)}
                        style={[
                          styles.linkButton,
                          {
                            backgroundColor: colors.card,
                            shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                            shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                          },
                        ]}
                      >
                        <View style={styles.linkButtonContent}>
                          <View style={[styles.linkIconContainer, { backgroundColor: colors.primary + '15' }]}>
                            <ExternalLink size={16} color={colors.primary} />
                          </View>
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
                      </AnimatedCard>
                    ))}
                  </View>
                </View>
              )}

              {/* Contact Person */}
              {(opportunity.contactPersonName || opportunity.contactPersonPhone) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Users size={18} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsive.sectionTitleSize }]}>
                      Contact Person
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.contactCard,
                      {
                        backgroundColor: colors.card,
                        shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                        shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                      },
                    ]}
                  >
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
                          onPress={() => Linking.openURL(`tel:${opportunity.contactPersonPhone}`)}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[colors.primary, colors.primaryDark || '#2563EB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.phoneButton}
                          >
                            <Text style={styles.phoneButtonText}>
                              📞 Call {opportunity.contactPersonPhone}
                            </Text>
                          </LinearGradient>
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
        <View style={styles.tabFullScreen}>
          <AnimatedTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chatMessageCount={chatMessageCount}
            colors={colors}
          />
          <OpportunityGroupChat
            opportunityId={opportunityId}
            opportunityTitle={opportunity.title}
            onMessageCountChange={setChatMessageCount}
          />
        </View>
      ) : (
        <View style={styles.tabFullScreen}>
          <AnimatedTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chatMessageCount={chatMessageCount}
            colors={colors}
          />
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

      {/* Bottom Action Button - Only for non-admins */}
      {!isAdmin && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          {isSignedUp ? (
            <GradientButton
              onPress={handleCancelSignup}
              disabled={submitting}
              loading={submitting}
              label="Cancel Signup"
              loadingLabel="Cancelling..."
              gradientColors={[colors.error, '#DC2626']}
              shadowColor={colors.error}
            />
          ) : (
            <GradientButton
              onPress={handleSignUp}
              disabled={submitting || isFull}
              loading={submitting}
              label={isFull ? 'Opportunity Full' : 'Sign Up'}
              loadingLabel="Signing Up..."
              gradientColors={[colors.primary, colors.primaryDark || '#2563EB']}
              shadowColor={colors.primary}
            />
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
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.background,
                shadowColor: colorScheme === 'dark' ? '#000' : '#000',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Check In</Text>
              <TouchableOpacity
                onPress={() => setCheckInModalVisible(false)}
                style={[styles.modalCloseButton, { backgroundColor: colors.surfaceElevated || colors.card }]}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Choose your check-in method
            </Text>

            <View style={styles.checkInOptions}>
              <AnimatedCard
                onPress={handleQRCheckIn}
                style={[
                  styles.checkInOption,
                  {
                    backgroundColor: colors.card,
                    shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                    shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                  },
                ]}
              >
                <View style={[styles.checkInOptionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <QrCode size={32} color={colors.primary} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>Scan QR Code</Text>
                <Text style={[styles.checkInOptionDescription, { color: colors.textSecondary }]}>
                  Scan the event QR code
                </Text>
              </AnimatedCard>

              <AnimatedCard
                onPress={handleManualCheckIn}
                style={[
                  styles.checkInOption,
                  {
                    backgroundColor: colors.card,
                    shadowColor: colorScheme === 'dark' ? '#000' : '#000',
                    shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
                  },
                ]}
              >
                <View style={[styles.checkInOptionIconContainer, { backgroundColor: colors.success + '15' }]}>
                  <CheckCircle size={32} color={colors.success} />
                </View>
                <Text style={[styles.checkInOptionTitle, { color: colors.text }]}>Manual Check-In</Text>
                <Text style={[styles.checkInOptionDescription, { color: colors.textSecondary }]}>
                  Check in without scanning
                </Text>
              </AnimatedCard>
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
          <View
            style={[
              styles.qrModalContent,
              {
                backgroundColor: colors.background,
                shadowColor: colorScheme === 'dark' ? '#000' : '#000',
              },
            ]}
          >
            <View style={styles.qrModalHeader}>
              <Text style={[styles.qrModalTitle, { color: colors.text }]}>Check-In QR Code</Text>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: colors.surfaceElevated || colors.card }]}
                onPress={() => setQrModalVisible(false)}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View ref={qrCodeRef} style={styles.qrCodeContainer} collapsable={false}>
              <View style={styles.qrCodeInner}>
                {opportunity?.checkInCode ? (
                  <>
                    <QRCode
                      value={opportunity.checkInCode}
                      size={250}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                    <Text style={styles.qrCodeText}>{opportunity.checkInCode}</Text>
                  </>
                ) : (
                  <Text style={[styles.qrErrorText, { color: colors.error }]}>
                    No check-in code available
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.qrInstructions, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.qrInstructionsTitle, { color: colors.primary }]}>How to use:</Text>
              <Text style={[styles.qrInstructionsText, { color: colors.text }]}>
                1. Display this QR code at the event entrance{'\n'}
                2. Volunteers scan with their camera{'\n'}
                3. They'll be automatically checked in
              </Text>
            </View>

            <View style={styles.qrActions}>
              <GradientButton
                onPress={handleShareQRCode}
                label="Share QR Code"
                gradientColors={[colors.primary, colors.primaryDark || '#2563EB']}
                shadowColor={colors.primary}
              />
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

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Hero Image
  heroContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  heroCategoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroCategoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroVerifiedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  heroVerifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Content
  content: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  organization: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 24,
  },
  
  // Info Cards
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    textAlign: 'center',
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Admin Stats
  adminStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  adminStatsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  adminStatsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminStatsLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  adminStatsValue: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  
  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  description: {
    lineHeight: 24,
  },
  tabContent: {
    marginTop: 20,
  },
  
  // Impact Card
  impactCard: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 28,
    alignItems: 'flex-start',
  },
  impactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactText: {
    flex: 1,
    lineHeight: 24,
    fontWeight: '500',
  },
  
  // Lists
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
    marginTop: 9,
  },
  listItemText: {
    flex: 1,
    lineHeight: 24,
  },
  
  // Skills
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  skillChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Links
  linksContainer: {
    gap: 12,
  },
  linkButton: {
    padding: 16,
    borderRadius: 14,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  linkButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButtonUrl: {
    fontSize: 13,
    marginLeft: 48,
  },
  
  // Contact Card
  contactCard: {
    padding: 18,
    borderRadius: 16,
    gap: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  contactNameContainer: {
    gap: 6,
  },
  contactPhoneContainer: {
    gap: 10,
  },
  contactLabel: {
    fontSize: 11,
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
    borderRadius: 12,
    alignItems: 'center',
  },
  phoneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Check-in Button
  checkInButtonContainer: {
    paddingVertical: 12,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 14,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  
  // Bottom Bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  
  // Modals
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
    borderRadius: 24,
    padding: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDescription: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  checkInOptions: {
    gap: 14,
  },
  checkInOption: {
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  checkInOptionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInOptionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  checkInOptionDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // QR Modal
  qrModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodeInner: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
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
    textAlign: 'center',
    padding: 20,
  },
  qrInstructions: {
    padding: 18,
    borderRadius: 14,
    marginBottom: 24,
  },
  qrInstructionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  qrInstructionsText: {
    fontSize: 14,
    lineHeight: 24,
  },
  qrActions: {
    gap: 12,
  },
});
