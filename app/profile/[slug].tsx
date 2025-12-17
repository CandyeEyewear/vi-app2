/**
 * Comprehensive User Profile Screen
 * Facebook-style profile with tabs: Posts, Check-ins, About
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  FlatList,
  useColorScheme,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MessageCircle,
  Phone,
  Mail,
  UserPlus,
  UserCheck,
  Calendar,
  Edit,
  FileText,
  CheckCircle,
  Clock,
  MapPin,
  Users,
  Settings,
  Building2,
  Globe,
  Crown,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { useMessaging } from '../../contexts/MessagingContext';
import { User, Post, Opportunity, OpportunitySignup } from '../../types';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import CustomAlert from '../../components/CustomAlert';
import { useAlert, showErrorAlert } from '../../hooks/useAlert';
import { sendNotificationToUser } from '../../services/pushNotifications';
import { cache, CacheKeys } from '../../services/cache';
import FeedPostCard from '../../components/cards/FeedPostCard';
import { UserAvatar, UserNameWithBadge } from '../../components';
import { goBack } from '../../utils/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../components/AnimatedPressable';

type TabType = 'posts' | 'checkins' | 'about';

interface CheckInData {
  id: string;
  opportunity: Opportunity;
  checkedInAt: string;
  hoursCompleted?: number;
  checkInStatus?: string;
  checkInMethod?: string;
}

export default function ViewProfileScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user: currentUser } = useAuth();
  const { refreshFeed, posts: allPosts } = useFeed();
  const { getOrCreateConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [circleStatus, setCircleStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [circleLoading, setCircleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  
  // Posts tab state
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  
  // Check-ins tab state
  const [checkIns, setCheckIns] = useState<CheckInData[]>([]);
  const [checkInsLoading, setCheckInsLoading] = useState(false);
  
  // Shoutouts state
  const [shoutoutsReceived, setShoutoutsReceived] = useState(0);

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

  const isOwnProfile = currentUser?.slug === slug || currentUser?.id === slug;
  const isPrivateProfile = profileUser?.isPrivate && !isOwnProfile;
  const isInCircle = circleStatus === 'accepted';
  const canViewFullProfile = isOwnProfile || !isPrivateProfile || isInCircle;
  const isOrganization = profileUser?.account_type === 'organization';

  useEffect(() => {
    if (slug) {
      loadProfile();
    }
  }, [slug]);

  useEffect(() => {
    if (profileUser && !isOwnProfile) {
      checkCircleStatus();
    }
  }, [profileUser, currentUser?.id]);

  useFocusEffect(
    React.useCallback(() => {
      if (slug && !loading) {
        loadProfile();
      }
    }, [slug])
  );

  useEffect(() => {
    if (activeTab === 'posts' && profileUser && canViewFullProfile) {
      loadUserPosts();
    } else if (activeTab === 'checkins' && profileUser && canViewFullProfile) {
      loadCheckIns();
    }
  }, [activeTab, profileUser, canViewFullProfile]);

  useEffect(() => {
    if (profileUser) {
      loadShoutoutsReceived();
    }
  }, [profileUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const cacheKey = CacheKeys.userProfile(slug!);
      const cachedUser = cache.get<User>(cacheKey);
      if (cachedUser) {
        setProfileUser(cachedUser);
        setLoading(false);
        return;
      }

      // Check if slug is a UUID (backward compatibility)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug!);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq(isValidUUID ? 'id' : 'slug', slug!)
        .single();

      if (error) throw error;

      const userData: User = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        phone: data.phone,
        location: data.location,
        country: data.country,
        bio: data.bio,
        areasOfExpertise: data.areas_of_expertise,
        education: data.education,
        avatarUrl: data.avatar_url,
        dateOfBirth: data.date_of_birth,
        role: data.role,
        membershipTier: data.membership_tier || 'free',
        membershipStatus: data.membership_status || 'inactive',
        isPrivate: data.is_private,
        totalHours: data.total_hours,
        activitiesCompleted: data.activities_completed,
        organizationsHelped: data.organizations_helped,
        achievements: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        account_type: data.account_type,
        approval_status: data.approval_status,
        is_partner_organization: data.is_partner_organization,
        organization_data: data.organization_data,
      };

      cache.set(cacheKey, userData, 5 * 60 * 1000);
      setProfileUser(userData);
    } catch (error) {
      console.error('Error loading profile:', error);
      showAlert(showErrorAlert('Error', 'Failed to load profile'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkCircleStatus = async () => {
    if (!currentUser?.id || !slug) return;

    try {
      const { data, error } = await supabase
        .from('user_circles')
        .select('status')
        .eq('user_id', currentUser.id)
        .eq('circle_user_id', profileUser?.id || slug)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking circle status:', error);
      }

      if (data) {
        setCircleStatus(data.status as 'pending' | 'accepted');
      } else {
        setCircleStatus('none');
      }
    } catch (error) {
      console.error('Error checking circle status:', error);
    }
  };

  const loadUserPosts = async () => {
    if (!profileUser) return;
    
    try {
      setPostsLoading(true);
      
      // Query posts where user_id = profile_user_id
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:users!posts_user_id_fkey (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('user_id', profileUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform posts to Post type
      const transformedPosts: Post[] = await Promise.all(
        (postsData || []).map(async (post: any) => {
          // Fetch opportunity if post references one
          let opportunity = null;
          if (post.opportunity_id) {
            const { data: oppData } = await supabase
              .from('opportunities')
              .select('*')
              .eq('id', post.opportunity_id)
              .single();

            if (oppData) {
              opportunity = {
                id: oppData.id,
                title: oppData.title,
                description: oppData.description,
                organizationName: oppData.organization_name,
                organizationVerified: oppData.organization_verified,
                category: oppData.category,
                location: oppData.location,
                latitude: oppData.latitude,
                longitude: oppData.longitude,
                date: oppData.date || oppData.date_start,
                dateStart: oppData.date_start,
                dateEnd: oppData.date_end,
                timeStart: oppData.time_start,
                timeEnd: oppData.time_end,
                duration: oppData.duration,
                spotsAvailable: oppData.spots_available,
                spotsTotal: oppData.spots_total,
                imageUrl: oppData.image_url,
                status: oppData.status,
              } as Opportunity;
            }
          }

          return {
            id: post.id,
            userId: post.user_id,
            user: {
              id: post.user.id,
              fullName: post.user.full_name,
              avatarUrl: post.user.avatar_url,
              email: post.user.email,
            } as User,
            text: post.text,
            mediaUrls: post.media_urls || [],
            mediaTypes: post.media_types || [],
            visibility: post.visibility || 'public',
            likes: post.likes || [],
            comments: [],
            shares: post.shares || 0,
            reactions: [],
            reactionSummary: {
              heart: 0,
              thumbsup: 0,
              clap: 0,
              fire: 0,
              star: 0,
              total: 0,
            },
            isAnnouncement: post.is_announcement || false,
            isPinned: post.is_pinned || false,
            opportunityId: post.opportunity_id,
            opportunity: opportunity,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
          } as Post;
        })
      );

      setUserPosts(transformedPosts);
    } catch (error) {
      console.error('Error loading user posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadCheckIns = async () => {
    if (!profileUser) return;

    try {
      setCheckInsLoading(true);

      // Query opportunity_signups where user_id = profile_user_id and checked_in = true
      const { data: signupsData, error } = await supabase
        .from('opportunity_signups')
        .select(`
          *,
          opportunity:opportunities!opportunity_signups_opportunity_id_fkey (*)
        `)
        .eq('user_id', profileUser.id)
        .or('checked_in.eq.true,check_in_status.eq.approved')
        .order('checked_in_at', { ascending: false });

      if (error) throw error;

      const transformedCheckIns: CheckInData[] = (signupsData || [])
        .filter((signup: any) => signup.checked_in || signup.check_in_status === 'approved')
        .map((signup: any) => {
          const opp = signup.opportunity;
          const opportunity: Opportunity = {
            id: opp.id,
            title: opp.title,
            description: opp.description,
            organizationName: opp.organization_name,
            organizationVerified: opp.organization_verified,
            category: opp.category,
            location: opp.location,
            latitude: opp.latitude,
            longitude: opp.longitude,
            date: opp.date || opp.date_start,
            dateStart: opp.date_start,
            dateEnd: opp.date_end,
            timeStart: opp.time_start,
            timeEnd: opp.time_end,
            duration: opp.duration,
            spotsAvailable: opp.spots_available,
            spotsTotal: opp.spots_total,
            imageUrl: opp.image_url,
            status: opp.status,
          };

          return {
            id: signup.id,
            opportunity,
            checkedInAt: signup.checked_in_at || signup.completed_at || signup.signed_up_at,
            hoursCompleted: signup.hours_completed,
            checkInStatus: signup.check_in_status,
            checkInMethod: signup.check_in_method,
          };
        });

      setCheckIns(transformedCheckIns);
    } catch (error) {
      console.error('Error loading check-ins:', error);
    } finally {
      setCheckInsLoading(false);
    }
  };

  const loadShoutoutsReceived = async () => {
    if (!profileUser) return;
    
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('post_type', 'shoutout')
        .eq('shoutout_user_id', profileUser.id);
      
      if (error) throw error;
      setShoutoutsReceived(count || 0);
    } catch (error) {
      console.error('Error loading shoutouts count:', error);
    }
  };

  const handleMessage = async () => {
    if (!profileUser) return;

    try {
      const response = await getOrCreateConversation(profileUser.id);

      if (response.success && response.data) {
        router.push({
          pathname: '/conversation/[id]',
          params: { id: response.data.id }
        } as any);
      } else {
        showAlert(showErrorAlert('Error', response.error || 'Failed to start conversation'));
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      showAlert(showErrorAlert('Error', 'Failed to start conversation'));
    }
  };

  const handleAddToCircle = async () => {
    if (!currentUser?.id || !profileUser) return;

    try {
      setCircleLoading(true);

      const { error } = await supabase
        .from('user_circles')
        .insert({
          user_id: currentUser.id,
          circle_user_id: profileUser.id,
          status: 'pending',
        });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: profileUser.id,
        type: 'circle_request',
        title: 'New Circle Request',
        message: `${currentUser.fullName} wants to add you to their circle`,
        link: `/profile/${currentUser.id}`,
        related_id: currentUser.id,
      });

      try {
        await sendNotificationToUser(profileUser.id, {
          type: 'circle_request',
          id: currentUser.id,
          title: 'New Circle Request',
          body: `${currentUser.fullName} wants to add you to their circle`,
        });
      } catch (pushError) {
        console.error('[PROFILE] ❌ Exception sending push notification:', pushError);
      }

      setCircleStatus('pending');
      showAlert({
        title: 'Request Sent',
        message: `Circle request sent to ${profileUser.fullName}`,
        type: 'success',
      });
    } catch (error: any) {
      console.error('Error sending circle request:', error);
      showAlert(showErrorAlert('Error', 'Failed to send circle request'));
    } finally {
      setCircleLoading(false);
    }
  };

  const handleRemoveFromCircle = async () => {
    if (!currentUser?.id || !profileUser) return;

    try {
      setCircleLoading(true);

      await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('circle_user_id', profileUser.id);

      await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', profileUser.id)
        .eq('circle_user_id', currentUser.id);

      setCircleStatus('none');
      await refreshFeed();

      const message =
        circleStatus === 'pending'
          ? 'Circle request cancelled'
          : `${profileUser.fullName} removed from your circle`;

      showAlert({
        title: 'Success',
        message: message,
        type: 'success',
      });
    } catch (error: any) {
      console.error('Error removing from circle:', error);
      showAlert(showErrorAlert('Error', 'Failed to remove from circle'));
    } finally {
      setCircleLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleTogglePrivacy = async () => {
    if (!profileUser || !isOwnProfile) return;

    try {
      const newPrivacy = !profileUser.isPrivate;
      const { error } = await supabase
        .from('users')
        .update({ is_private: newPrivacy })
        .eq('id', profileUser.id);

      if (error) throw error;

      setProfileUser({ ...profileUser, isPrivate: newPrivacy });
      showAlert({
        title: 'Success',
        message: `Profile is now ${newPrivacy ? 'private' : 'public'}`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error updating privacy:', error);
      showAlert(showErrorAlert('Error', 'Failed to update privacy settings'));
    }
  };

  const renderCheckInCard = ({ item }: { item: CheckInData }) => (
    <TouchableOpacity
      style={[styles.checkInCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/opportunity/${item.opportunity.slug}` as any)}
      activeOpacity={0.7}
    >
      {item.opportunity.imageUrl && (
        <Image source={{ uri: item.opportunity.imageUrl }} style={styles.checkInImage} />
      )}
      <View style={styles.checkInContent}>
        <Text style={[styles.checkInTitle, { color: colors.text }]} numberOfLines={2}>
          {item.opportunity.title}
        </Text>
        <Text style={[styles.checkInOrg, { color: colors.textSecondary }]}>
          {item.opportunity.organizationName}
        </Text>
        <View style={styles.checkInDetails}>
          <View style={styles.checkInDetailRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.checkInDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.opportunity.location}
            </Text>
          </View>
          <View style={styles.checkInDetailRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={[styles.checkInDetailText, { color: colors.textSecondary }]}>
              {new Date(item.checkedInAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          {item.hoursCompleted && (
            <View style={styles.checkInDetailRow}>
              <CheckCircle size={14} color={colors.success} />
              <Text style={[styles.checkInDetailText, { color: colors.success, fontWeight: '600' }]}>
                {item.hoursCompleted} hours
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    if (!canViewFullProfile) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text }]}>🔒 Private Profile</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            This user has set their profile to private. Add them to your circle to see their content.
          </Text>
        </View>
      );
    }

    if (activeTab === 'posts') {
      if (postsLoading) {
        return (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );
      }

      if (userPosts.length === 0) {
        return (
          <View style={styles.emptyState}>
            <FileText size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No posts yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {isOwnProfile ? 'Start sharing your volunteer experiences!' : 'This user hasn\'t posted anything yet.'}
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.postsList}>
          {userPosts.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </View>
      );
    }

    if (activeTab === 'checkins') {
      if (checkInsLoading) {
        return (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );
      }

      if (checkIns.length === 0) {
        return (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No check-ins yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {isOwnProfile ? 'Start volunteering to see your check-ins here!' : 'This user hasn\'t checked in to any events yet.'}
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.checkInsList}>
          {checkIns.map((checkIn) => renderCheckInCard({ item: checkIn }))}
        </View>
      );
    }

    if (activeTab === 'about') {
      if (isOrganization) {
        return (
          <View style={styles.aboutContentContainer}>
            {/* Organization Description */}
            {profileUser?.organization_data?.organization_description && (
              <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>About</Text>
                <Text style={[styles.aboutText, { color: colors.text }]}>
                  {profileUser.organization_data.organization_description}
                </Text>
              </View>
            )}

            {/* Industry Focus */}
            {profileUser?.organization_data?.industry_focus && profileUser.organization_data.industry_focus.length > 0 && (
              <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Industry Focus</Text>
                <View style={styles.expertiseContainer}>
                  {profileUser.organization_data.industry_focus.map((focus, index) => (
                    <View key={index} style={[styles.expertiseChip, { backgroundColor: '#FFC107' + '20', borderColor: '#FFC107' }]}>
                      <Text style={[styles.expertiseText, { color: '#F57F17' }]}>{focus}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Organization Details */}
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Organization Details</Text>
              
              {profileUser?.organization_data?.registration_number && (
                <View style={styles.orgDetailRow}>
                  <Text style={[styles.orgDetailLabel, { color: colors.textSecondary }]}>Registration Number:</Text>
                  <Text style={[styles.orgDetailValue, { color: colors.text }]}>
                    {profileUser.organization_data.registration_number}
                  </Text>
                </View>
              )}
              
              {profileUser?.organization_data?.organization_size && (
                <View style={styles.orgDetailRow}>
                  <Text style={[styles.orgDetailLabel, { color: colors.textSecondary }]}>Organization Size:</Text>
                  <Text style={[styles.orgDetailValue, { color: colors.text }]}>
                    {profileUser.organization_data.organization_size} employees
                  </Text>
                </View>
              )}
              
              {profileUser?.organization_data?.contact_person_name && (
                <View style={styles.orgDetailRow}>
                  <Text style={[styles.orgDetailLabel, { color: colors.textSecondary }]}>Contact Person:</Text>
                  <Text style={[styles.orgDetailValue, { color: colors.text }]}>
                    {profileUser.organization_data.contact_person_name}
                    {profileUser.organization_data.contact_person_role && ` (${profileUser.organization_data.contact_person_role})`}
                  </Text>
                </View>
              )}
            </View>

            {/* Website */}
            {profileUser?.organization_data?.website_url && (
              <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Website</Text>
                <TouchableOpacity
                  style={styles.websiteRow}
                  onPress={() => Linking.openURL(profileUser.organization_data!.website_url!)}
                >
                  <Globe size={20} color={colors.primary} />
                  <Text style={[styles.websiteText, { color: colors.primary }]}>
                    {profileUser.organization_data.website_url}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Partner Status */}
            {profileUser?.is_partner_organization && (
              <View style={[styles.aboutSection, { backgroundColor: '#FFF9E6', borderColor: '#FFC107', borderWidth: 2 }]}>
                <View style={styles.partnerStatusRow}>
                  <Crown size={24} color="#FFC107" fill="#FFC107" />
                  <View style={styles.partnerStatusText}>
                    <Text style={[styles.partnerStatusTitle, { color: '#1F2937' }]}>Partner Organization</Text>
                    <Text style={[styles.partnerStatusSubtitle, { color: '#6B7280' }]}>
                      This organization is a verified partner with a golden badge
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Contact Info */}
            {(currentUser?.role === 'admin' || isOwnProfile) && (profileUser?.phone || profileUser?.email) && (
              <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Contact Info</Text>
                {profileUser?.phone && (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${profileUser.phone}`)}
                  >
                    <Phone size={20} color={colors.primary} />
                    <Text style={[styles.contactText, { color: colors.primary }]}>{profileUser.phone}</Text>
                  </TouchableOpacity>
                )}
                {profileUser?.email && (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`mailto:${profileUser.email}`)}
                  >
                    <Mail size={20} color={colors.primary} />
                    <Text style={[styles.contactText, { color: colors.primary }]}>{profileUser.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Member Since */}
            <View style={styles.memberSince}>
              <Text style={[styles.memberSinceText, { color: colors.textSecondary }]}>
                Partner since {profileUser ? new Date(profileUser.createdAt).toLocaleDateString() : ''}
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.aboutContentContainer}>
          {/* Bio */}
          {profileUser?.bio && (
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Bio</Text>
              <Text style={[styles.aboutText, { color: colors.text }]}>{profileUser.bio}</Text>
            </View>
          )}

          {/* Education */}
          {profileUser?.education && (
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Education</Text>
              <Text style={[styles.aboutText, { color: colors.text }]}>{profileUser.education}</Text>
            </View>
          )}

          {/* Areas of Expertise */}
          {profileUser?.areasOfExpertise && profileUser.areasOfExpertise.length > 0 && (
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Areas of Expertise</Text>
              <View style={styles.expertiseContainer}>
                {profileUser.areasOfExpertise.map((expertise, index) => (
                  <View key={index} style={[styles.expertiseChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                    <Text style={[styles.expertiseText, { color: colors.primary }]}>{expertise}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Privacy Settings - Only for own profile */}
          {isOwnProfile && (
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Privacy Settings</Text>
              <TouchableOpacity
                style={styles.privacyToggle}
                onPress={handleTogglePrivacy}
                activeOpacity={0.7}
              >
                <View style={styles.privacyToggleLeft}>
                  <Settings size={20} color={colors.text} />
                  <View style={styles.privacyToggleText}>
                    <Text style={[styles.privacyToggleTitle, { color: colors.text }]}>Private Profile</Text>
                    <Text style={[styles.privacyToggleSubtitle, { color: colors.textSecondary }]}>
                      {profileUser?.isPrivate
                        ? 'Only people in your circle can see your posts and check-ins'
                        : 'Everyone can see your posts and check-ins'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: profileUser?.isPrivate ? colors.primary : colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleSwitchThumb,
                      { backgroundColor: '#FFFFFF', transform: [{ translateX: profileUser?.isPrivate ? 20 : 0 }] },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Contact Info - Admins and Own Profile Only */}
          {(currentUser?.role === 'admin' || isOwnProfile) && (profileUser?.phone || profileUser?.email) && (
            <View style={[styles.aboutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.aboutSectionTitle, { color: colors.text }]}>Contact Info</Text>
              {profileUser?.phone && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => Linking.openURL(`tel:${profileUser.phone}`)}
                >
                  <Phone size={20} color={colors.primary} />
                  <Text style={[styles.contactText, { color: colors.primary }]}>{profileUser.phone}</Text>
                </TouchableOpacity>
              )}
              {profileUser?.email && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => Linking.openURL(`mailto:${profileUser.email}`)}
                >
                  <Mail size={20} color={colors.primary} />
                  <Text style={[styles.contactText, { color: colors.primary }]}>{profileUser.email}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Member Since */}
          <View style={styles.memberSince}>
            <Text style={[styles.memberSinceText, { color: colors.textSecondary }]}>
              Member since {profileUser ? new Date(profileUser.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Profile not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => goBack('/(tabs)/feed')} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={styles.headerActions}>
          {!isOwnProfile && (
            <TouchableOpacity onPress={handleMessage} style={styles.headerIconButton}>
              <MessageCircle size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
          {isOwnProfile && (
            <TouchableOpacity onPress={handleEditProfile} style={styles.headerIconButton}>
              <Edit size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scrollable Content with Sticky Tabs */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        stickyHeaderIndices={[2]} // Tabs are at index 2 (after profile header and stats)
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Header - Scrolls away */}
        <View style={[styles.profileHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.avatarSection}>
            <UserAvatar
              avatarUrl={profileUser.avatarUrl || null}
              fullName={profileUser.fullName}
              size={100}
              role={profileUser.role || 'volunteer'}
              membershipTier={profileUser.membershipTier || 'free'}
              membershipStatus={profileUser.membershipStatus || 'inactive'}
              isPartnerOrganization={profileUser.is_partner_organization}
            />
          </View>
          {isOrganization ? (
            <>
              <View style={styles.organizationHeader}>
                <Building2 size={24} color="#FFC107" />
                <Text style={[styles.name, { color: colors.text, marginLeft: 8 }]}>
                  {profileUser.organization_data?.organization_name || profileUser.fullName}
                </Text>
                {profileUser.is_partner_organization && (
                  <View style={styles.goldenBadge}>
                    <Crown size={16} color="#000000" fill="#FFC107" />
                    <Text style={styles.goldenBadgeText}>Partner</Text>
                  </View>
                )}
              </View>
              {profileUser.organization_data?.organization_description && (
                <Text style={[styles.organizationDescription, { color: colors.textSecondary }]}>
                  {profileUser.organization_data.organization_description}
                </Text>
              )}
              {profileUser.location && (
                <View style={styles.locationRow}>
                  <MapPin size={16} color={colors.textSecondary} />
                  <Text style={[styles.location, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {profileUser.location}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <UserNameWithBadge
                name={profileUser.fullName}
                role={profileUser.role || 'volunteer'}
                membershipTier={profileUser.membershipTier || 'free'}
                membershipStatus={profileUser.membershipStatus || 'inactive'}
                isPartnerOrganization={profileUser.is_partner_organization}
                style={[styles.name, { color: colors.text }]}
                badgeSize={20}
              />
              {/* Role Label */}
              {profileUser.role === 'admin' ? (
                <Text style={{ color: '#000000', fontSize: 14, fontWeight: '600', marginTop: 4 }}>Admin</Text>
              ) : (profileUser.membershipTier === 'premium' && profileUser.membershipStatus === 'active') ? (
                <Text style={{ color: '#38B6FF', fontSize: 14, fontWeight: '600', marginTop: 4 }}>Official Member</Text>
              ) : null}
              {profileUser.location && (
                <Text style={[styles.location, { color: colors.textSecondary }]}>{profileUser.location}</Text>
              )}
            </>
          )}
        </View>

        {/* Stats Section - Scrolls away */}
        <View style={[styles.statsSection, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {isOrganization ? (
            <View style={styles.statsGrid}>
              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.activitiesCompleted}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {profileUser.activitiesCompleted === 1 ? 'Opportunity' : 'Opportunities'}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.totalHours}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Hours</Text>
              </LinearGradient>

              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.organizationsHelped}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Volunteers</Text>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.totalHours}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hours</Text>
              </LinearGradient>

              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.activitiesCompleted}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {profileUser.activitiesCompleted === 1 ? 'Activity' : 'Activities'}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.primary }]}>{profileUser.organizationsHelped}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Organizations</Text>
              </LinearGradient>

              <LinearGradient
                colors={[colors.card, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
              >
                <Text style={[styles.statValue, { color: colors.warning }]}>{shoutoutsReceived}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>🌟 Shoutouts</Text>
              </LinearGradient>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!isOwnProfile && !isOrganization && (
              <AnimatedPressable
                style={[
                  styles.actionButton,
                  surfaceShadow,
                  { backgroundColor: colors.primary },
                  (circleStatus === 'accepted' || circleStatus === 'pending') && {
                    backgroundColor: colors.background,
                    borderWidth: 2,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={circleStatus !== 'none' ? handleRemoveFromCircle : handleAddToCircle}
                disabled={circleLoading}
              >
                {circleLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    {circleStatus === 'accepted' ? (
                      <UserCheck size={20} color={colors.primary} />
                    ) : circleStatus === 'pending' ? (
                      <UserPlus size={20} color={colors.primary} />
                    ) : (
                      <UserPlus size={20} color="#FFFFFF" />
                    )}
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: circleStatus === 'none' ? '#FFFFFF' : colors.primary },
                      ]}
                    >
                      {circleStatus === 'accepted' ? 'In Circle' : circleStatus === 'pending' ? 'Request Sent' : 'Add to Circle'}
                    </Text>
                  </>
                )}
              </AnimatedPressable>
            )}
            {!isOwnProfile && (
              <AnimatedPressable
                style={[
                  styles.actionButton,
                  styles.messageButton,
                  surfaceShadow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={handleMessage}
              >
                <MessageCircle size={20} color={colors.text} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Message</Text>
              </AnimatedPressable>
            )}
          </View>
        </View>

        {/* Tabs - STICKY HEADER (index 2) */}
        <View style={[styles.tabs, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('posts')}
          >
            <FileText size={20} color={activeTab === 'posts' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'posts' ? colors.primary : colors.textSecondary }]}>
              Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'checkins' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('checkins')}
          >
            <CheckCircle size={20} color={activeTab === 'checkins' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'checkins' ? colors.primary : colors.textSecondary }]}>
              Check-ins
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('about')}
          >
            <Users size={20} color={activeTab === 'about' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'about' ? colors.primary : colors.textSecondary }]}>
              About
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content - Scrolls normally */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert {...alertProps} />
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
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    marginBottom: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  messageButton: {
    borderWidth: 1.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabContent: {
    flex: 1,
    minHeight: 400, // Ensure content area has minimum height
  },
  statsSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  postsList: {
    padding: 16,
    gap: 16,
  },
  checkInsList: {
    padding: 16,
    gap: 16,
  },
  checkInCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  checkInImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  checkInContent: {
    padding: 16,
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  checkInOrg: {
    fontSize: 14,
    marginBottom: 12,
  },
  checkInDetails: {
    gap: 8,
  },
  checkInDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkInDetailText: {
    fontSize: 13,
    flex: 1,
  },
  aboutContentContainer: {
    padding: 16,
  },
  aboutSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  aboutSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 24,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expertiseChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  expertiseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  privacyToggleText: {
    flex: 1,
  },
  privacyToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  privacyToggleSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 12,
  },
  contactText: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberSince: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  memberSinceText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  goldenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  goldenBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  organizationDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  orgDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  orgDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  orgDetailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  websiteText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  partnerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerStatusText: {
    flex: 1,
  },
  partnerStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  partnerStatusSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
