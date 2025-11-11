/**
 * Moderation Dashboard Screen
 * Complete moderation suite for admins
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { 
  ChevronLeft,
  Shield,
  Flag,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  Users,
  FileText,
  Clock,
  Calendar,
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import CustomAlert from '../components/CustomAlert';
import { PostReport, Post, User, ModerationStats } from '../types';

type TabType = 'reports' | 'posts' | 'banned' | 'stats';

export default function ModerationDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('reports');

  // Data state
  const [reports, setReports] = useState<PostReport[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [bannedUsers, setBannedUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<ModerationStats>({
    totalReports: 0,
    pendingReports: 0,
    reviewedReports: 0,
    postsHidden: 0,
    postsDeleted: 0,
    usersBanned: 0,
    actionsToday: 0,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
    onConfirm: undefined as (() => void) | undefined,
  });
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserName, setSelectedUserName] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' = 'success',
    onConfirm?: () => void
  ) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'reports') {
        await loadReports();
      } else if (activeTab === 'posts') {
        await loadAllPosts();
      } else if (activeTab === 'banned') {
        await loadBannedUsers();
      } else if (activeTab === 'stats') {
        await loadStats();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('post_reports')
      .select(`
        *,
        post:posts(*,
          user:users(*)
        ),
        reporter:users!post_reports_reporter_id_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedReports = data.map((report) => ({
      id: report.id,
      postId: report.post_id,
      post: report.post ? {
        id: report.post.id,
        userId: report.post.user_id,
        user: {
          id: report.post.user.id,
          email: report.post.user.email,
          fullName: report.post.user.full_name,
          phone: report.post.user.phone || '',
          location: report.post.user.location || '',
          avatarUrl: report.post.user.avatar_url,
          role: report.post.user.role,
          totalHours: report.post.user.total_hours || 0,
          activitiesCompleted: report.post.user.activities_completed || 0,
          organizationsHelped: report.post.user.organizations_helped || 0,
          achievements: [],
          createdAt: report.post.user.created_at,
          updatedAt: report.post.user.updated_at,
        },
        text: report.post.text,
        mediaUrls: report.post.media_urls || [],
        mediaTypes: report.post.media_types || [],
        likes: report.post.likes || [],
        comments: [],
        shares: report.post.shares || 0,
        isHidden: report.post.is_hidden || false,
        createdAt: report.post.created_at,
        updatedAt: report.post.updated_at,
      } : undefined,
      reporterId: report.reporter_id,
      reporter: {
        id: report.reporter.id,
        email: report.reporter.email,
        fullName: report.reporter.full_name,
        phone: report.reporter.phone || '',
        location: report.reporter.location || '',
        avatarUrl: report.reporter.avatar_url,
        role: report.reporter.role,
        totalHours: report.reporter.total_hours || 0,
        activitiesCompleted: report.reporter.activities_completed || 0,
        organizationsHelped: report.reporter.organizations_helped || 0,
        achievements: [],
        createdAt: report.reporter.created_at,
        updatedAt: report.reporter.updated_at,
      },
      reason: report.reason,
      details: report.details,
      status: report.status,
      reviewedBy: report.reviewed_by,
      reviewedAt: report.reviewed_at,
      createdAt: report.created_at,
    }));

    setReports(formattedReports);
  };

  const loadAllPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(*)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedPosts = data.map((post) => ({
      id: post.id,
      userId: post.user_id,
      user: {
        id: post.user.id,
        email: post.user.email,
        fullName: post.user.full_name,
        phone: post.user.phone || '',
        location: post.user.location || '',
        avatarUrl: post.user.avatar_url,
        role: post.user.role,
        totalHours: post.user.total_hours || 0,
        activitiesCompleted: post.user.activities_completed || 0,
        organizationsHelped: post.user.organizations_helped || 0,
        achievements: [],
        createdAt: post.user.created_at,
        updatedAt: post.user.updated_at,
      },
      text: post.text,
      mediaUrls: post.media_urls || [],
      mediaTypes: post.media_types || [],
      likes: post.likes || [],
      comments: [],
      shares: post.shares || 0,
      isHidden: post.is_hidden || false,
      isAnnouncement: post.is_announcement || false,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    }));

    setAllPosts(formattedPosts);
  };

  const loadBannedUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_banned', true)
      .order('banned_until', { ascending: false });

    if (error) throw error;

    const formattedUsers = data.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone || '',
      location: u.location || '',
      avatarUrl: u.avatar_url,
      role: u.role,
      isBanned: u.is_banned,
      bannedUntil: u.banned_until,
      banReason: u.ban_reason,
      totalHours: u.total_hours || 0,
      activitiesCompleted: u.activities_completed || 0,
      organizationsHelped: u.organizations_helped || 0,
      achievements: [],
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    setBannedUsers(formattedUsers);
  };

  const loadStats = async () => {
    // Get total reports
    const { count: totalReports } = await supabase
      .from('post_reports')
      .select('*', { count: 'exact', head: true });

    // Get pending reports
    const { count: pendingReports } = await supabase
      .from('post_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get reviewed reports
    const { count: reviewedReports } = await supabase
      .from('post_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'reviewed');

    // Get hidden posts
    const { count: postsHidden } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_hidden', true);

    // Get banned users
    const { count: usersBanned } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true);

    // Get actions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: actionsToday } = await supabase
      .from('moderation_actions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    setStats({
      totalReports: totalReports || 0,
      pendingReports: pendingReports || 0,
      reviewedReports: reviewedReports || 0,
      postsHidden: postsHidden || 0,
      postsDeleted: 0, // Can't easily count deleted
      usersBanned: usersBanned || 0,
      actionsToday: actionsToday || 0,
    });
  };

  const hidePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_hidden: true })
        .eq('id', postId);

      if (error) throw error;

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        admin_id: user?.id,
        action_type: 'hide_post',
        target_type: 'post',
        target_id: postId,
      });

      showAlert('Success', 'Post hidden successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error hiding post:', error);
      showAlert('Error', 'Failed to hide post', 'error');
    }
  };

  const unhidePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_hidden: false })
        .eq('id', postId);

      if (error) throw error;

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        admin_id: user?.id,
        action_type: 'unhide_post',
        target_type: 'post',
        target_id: postId,
      });

      showAlert('Success', 'Post unhidden successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error unhiding post:', error);
      showAlert('Error', 'Failed to unhide post', 'error');
    }
  };

  const deletePost = async (postId: string) => {
    showAlert(
      'Delete Post',
      'Are you sure? This action cannot be undone.',
      'error',
      async () => {
        try {
          // Delete comments first
          await supabase.from('comments').delete().eq('post_id', postId);

          // Delete reports
          await supabase.from('post_reports').delete().eq('post_id', postId);

          // Delete post
          const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);

          if (error) throw error;

          // Log moderation action
          await supabase.from('moderation_actions').insert({
            admin_id: user?.id,
            action_type: 'delete_post',
            target_type: 'post',
            target_id: postId,
          });

          showAlert('Success', 'Post deleted successfully', 'success');
          loadData();
        } catch (error) {
          console.error('Error deleting post:', error);
          showAlert('Error', 'Failed to delete post', 'error');
        }
      }
    );
  };

  const dismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('post_reports')
        .update({
          status: 'dismissed',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        admin_id: user?.id,
        action_type: 'dismiss_report',
        target_type: 'report',
        target_id: reportId,
      });

      showAlert('Success', 'Report dismissed', 'success');
      loadData();
    } catch (error) {
      console.error('Error dismissing report:', error);
      showAlert('Error', 'Failed to dismiss report', 'error');
    }
  };

  const banUser = async (userId: string, duration: 'day' | 'week' | 'month' | 'permanent') => {
    try {
      let bannedUntil = null;
      if (duration !== 'permanent') {
        const until = new Date();
        if (duration === 'day') until.setDate(until.getDate() + 1);
        if (duration === 'week') until.setDate(until.getDate() + 7);
        if (duration === 'month') until.setMonth(until.getMonth() + 1);
        bannedUntil = until.toISOString();
      }

      const { error } = await supabase
        .from('users')
        .update({
          is_banned: true,
          banned_until: bannedUntil,
          ban_reason: 'Violation of community guidelines',
        })
        .eq('id', userId);

      if (error) throw error;

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        admin_id: user?.id,
        action_type: 'ban_user',
        target_type: 'user',
        target_id: userId,
        metadata: { duration, bannedUntil },
      });

      showAlert('Success', 'User banned successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error banning user:', error);
      showAlert('Error', 'Failed to ban user', 'error');
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_banned: false,
          banned_until: null,
          ban_reason: null,
        })
        .eq('id', userId);

      if (error) throw error;

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        admin_id: user?.id,
        action_type: 'unban_user',
        target_type: 'user',
        target_id: userId,
      });

      showAlert('Success', 'User unbanned successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error unbanning user:', error);
      showAlert('Error', 'Failed to unban user', 'error');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const renderReportCard = (report: PostReport) => {
    if (!report.post) return null;

    const statusColor = 
      report.status === 'pending' ? colors.error :
      report.status === 'reviewed' ? colors.success :
      colors.textSecondary;

    return (
      <View key={report.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Report Header */}
        <View style={styles.reportHeader}>
          <View style={styles.reportBadge}>
            <Flag size={16} color={statusColor} />
            <Text style={[styles.reportStatus, { color: statusColor }]}>
              {report.status.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.reportTime, { color: colors.textSecondary }]}>
            {formatTimeAgo(report.createdAt)}
          </Text>
        </View>

        {/* Reporter Info */}
        <View style={styles.reporterInfo}>
          <Text style={[styles.reporterLabel, { color: colors.textSecondary }]}>
            Reported by:
          </Text>
          <Text style={[styles.reporterName, { color: colors.text }]}>
            {report.reporter?.fullName}
          </Text>
        </View>

        {/* Report Reason */}
        <View style={styles.reasonContainer}>
          <Text style={[styles.reasonLabel, { color: colors.textSecondary }]}>
            Reason:
          </Text>
          <Text style={[styles.reasonText, { color: colors.text }]}>
            {report.reason}
          </Text>
        </View>

        {/* Report Details */}
        {report.details && (
          <Text style={[styles.reportDetails, { color: colors.textSecondary }]}>
            "{report.details}"
          </Text>
        )}

        {/* Post Content */}
        <View style={[styles.postPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.postHeader}>
            {report.post.user.avatarUrl ? (
              <Image source={{ uri: report.post.user.avatarUrl }} style={styles.postAvatar} />
            ) : (
              <View style={[styles.postAvatar, styles.postAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.postAvatarText}>
                  {report.post.user.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postHeaderInfo}>
              <Text style={[styles.postAuthor, { color: colors.text }]}>
                {report.post.user.fullName}
              </Text>
              <Text style={[styles.postTime, { color: colors.textSecondary }]}>
                {formatTimeAgo(report.post.createdAt)}
              </Text>
            </View>
            {report.post.isHidden && (
              <View style={[styles.hiddenBadge, { backgroundColor: colors.error + '20' }]}>
                <EyeOff size={14} color={colors.error} />
                <Text style={[styles.hiddenBadgeText, { color: colors.error }]}>Hidden</Text>
              </View>
            )}
          </View>
          <Text style={[styles.postText, { color: colors.text }]} numberOfLines={3}>
            {report.post.text}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {report.status === 'pending' && (
            <>
              {!report.post.isHidden ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
                  onPress={() => hidePost(report.post!.id)}
                >
                  <EyeOff size={18} color={colors.error} />
                  <Text style={[styles.actionButtonText, { color: colors.error }]}>Hide</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.success + '15' }]}
                  onPress={() => unhidePost(report.post!.id)}
                >
                  <Eye size={18} color={colors.success} />
                  <Text style={[styles.actionButtonText, { color: colors.success }]}>Unhide</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
                onPress={() => deletePost(report.post!.id)}
              >
                <Trash2 size={18} color={colors.error} />
                <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
                onPress={() => {
                  setSelectedUserId(report.post!.userId);
                  setSelectedUserName(report.post!.user.fullName);
                  setShowBanModal(true);
                }}
              >
                <Ban size={18} color={colors.error} />
                <Text style={[styles.actionButtonText, { color: colors.error }]}>Ban User</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.textSecondary + '15' }]}
                onPress={() => dismissReport(report.id)}
              >
                <CheckCircle size={18} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Dismiss</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderPostCard = (post: Post) => {
    return (
      <View key={post.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.postHeader}>
          {post.user.avatarUrl ? (
            <Image source={{ uri: post.user.avatarUrl }} style={styles.postAvatar} />
          ) : (
            <View style={[styles.postAvatar, styles.postAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.postAvatarText}>
                {post.user.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.postHeaderInfo}>
            <Text style={[styles.postAuthor, { color: colors.text }]}>
              {post.user.fullName}
            </Text>
            <Text style={[styles.postTime, { color: colors.textSecondary }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
          {post.isHidden && (
            <View style={[styles.hiddenBadge, { backgroundColor: colors.error + '20' }]}>
              <EyeOff size={14} color={colors.error} />
              <Text style={[styles.hiddenBadgeText, { color: colors.error }]}>Hidden</Text>
            </View>
          )}
          {post.isAnnouncement && (
            <View style={[styles.announcementBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.announcementBadgeText, { color: colors.primary }]}>Announcement</Text>
            </View>
          )}
        </View>
        <Text style={[styles.postText, { color: colors.text }]}>
          {post.text}
        </Text>
        
        <View style={styles.actions}>
          {!post.isHidden ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
              onPress={() => hidePost(post.id)}
            >
              <EyeOff size={18} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Hide</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success + '15' }]}
              onPress={() => unhidePost(post.id)}
            >
              <Eye size={18} color={colors.success} />
              <Text style={[styles.actionButtonText, { color: colors.success }]}>Unhide</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
            onPress={() => deletePost(post.id)}
          >
            <Trash2 size={18} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
            onPress={() => {
              setSelectedUserId(post.userId);
              setSelectedUserName(post.user.fullName);
              setShowBanModal(true);
            }}
          >
            <Ban size={18} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Ban</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderBannedUserCard = (bannedUser: User) => {
    const isTempBan = bannedUser.bannedUntil && new Date(bannedUser.bannedUntil) > new Date();
    const banExpiry = bannedUser.bannedUntil ? new Date(bannedUser.bannedUntil).toLocaleDateString() : 'Permanent';

    return (
      <View key={bannedUser.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.userHeader}>
          {bannedUser.avatarUrl ? (
            <Image source={{ uri: bannedUser.avatarUrl }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatar, styles.userAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.userAvatarText}>
                {bannedUser.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {bannedUser.fullName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {bannedUser.email}
            </Text>
          </View>
          <View style={[styles.banBadge, { backgroundColor: colors.error + '20' }]}>
            <Ban size={14} color={colors.error} />
            <Text style={[styles.banBadgeText, { color: colors.error }]}>Banned</Text>
          </View>
        </View>

        {bannedUser.banReason && (
          <Text style={[styles.banReason, { color: colors.textSecondary }]}>
            Reason: {bannedUser.banReason}
          </Text>
        )}

        <View style={styles.banInfo}>
          <Calendar size={16} color={colors.textSecondary} />
          <Text style={[styles.banExpiry, { color: colors.textSecondary }]}>
            {isTempBan ? `Expires: ${banExpiry}` : 'Permanent ban'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.unbanButton, { backgroundColor: colors.success }]}
          onPress={() => unbanUser(bannedUser.id)}
        >
          <CheckCircle size={18} color="#FFFFFF" />
          <Text style={styles.unbanButtonText}>Unban User</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStats = () => {
    const statCards = [
      { label: 'Total Reports', value: stats.totalReports, icon: Flag, color: colors.primary },
      { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, color: colors.error },
      { label: 'Reviewed Reports', value: stats.reviewedReports, icon: CheckCircle, color: colors.success },
      { label: 'Posts Hidden', value: stats.postsHidden, icon: EyeOff, color: colors.textSecondary },
      { label: 'Users Banned', value: stats.usersBanned, icon: Ban, color: colors.error },
      { label: 'Actions Today', value: stats.actionsToday, icon: Shield, color: colors.primary },
    ];

    return (
      <View style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <View key={index} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <stat.icon size={24} color={stat.color} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Shield size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Moderation
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('reports')}
        >
          <Flag size={20} color={activeTab === 'reports' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'reports' ? colors.primary : colors.textSecondary }]}>
            Reports
          </Text>
          {stats.pendingReports > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{stats.pendingReports}</Text>
            </View>
          )}
        </TouchableOpacity>

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
          style={[styles.tab, activeTab === 'banned' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('banned')}
        >
          <Users size={20} color={activeTab === 'banned' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'banned' ? colors.primary : colors.textSecondary }]}>
            Banned
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('stats')}
        >
          <AlertTriangle size={20} color={activeTab === 'stats' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'stats' ? colors.primary : colors.textSecondary }]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'reports' && (
          <View style={styles.section}>
            {reports.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No reports</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  All clear! No posts have been reported.
                </Text>
              </View>
            ) : (
              reports.map(renderReportCard)
            )}
          </View>
        )}

        {activeTab === 'posts' && (
          <View style={styles.section}>
            {allPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No posts</Text>
              </View>
            ) : (
              allPosts.map(renderPostCard)
            )}
          </View>
        )}

        {activeTab === 'banned' && (
          <View style={styles.section}>
            {bannedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No banned users</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  No users are currently banned.
                </Text>
              </View>
            ) : (
              bannedUsers.map(renderBannedUserCard)
            )}
          </View>
        )}

        {activeTab === 'stats' && renderStats()}
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfig.onConfirm}
        showCancel={!!alertConfig.onConfirm}
      />

      {/* Ban Duration Modal */}
      <Modal
        visible={showBanModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBanModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Ban User</Text>
              <TouchableOpacity onPress={() => setShowBanModal(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.banModalText, { color: colors.text }]}>
                Ban {selectedUserName} from posting?
              </Text>
              <Text style={[styles.banModalSubtext, { color: colors.textSecondary }]}>
                Choose ban duration:
              </Text>

              <TouchableOpacity
                style={[styles.banOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setShowBanModal(false);
                  banUser(selectedUserId, 'day');
                }}
              >
                <Clock size={20} color={colors.text} />
                <Text style={[styles.banOptionText, { color: colors.text }]}>1 Day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.banOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setShowBanModal(false);
                  banUser(selectedUserId, 'week');
                }}
              >
                <Clock size={20} color={colors.text} />
                <Text style={[styles.banOptionText, { color: colors.text }]}>1 Week</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.banOption, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setShowBanModal(false);
                  banUser(selectedUserId, 'month');
                }}
              >
                <Clock size={20} color={colors.text} />
                <Text style={[styles.banOptionText, { color: colors.text }]}>1 Month</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.banOption, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
                onPress={() => {
                  setShowBanModal(false);
                  banUser(selectedUserId, 'permanent');
                }}
              >
                <Ban size={20} color={colors.error} />
                <Text style={[styles.banOptionText, { color: colors.error }]}>Permanent Ban</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  reportTime: {
    fontSize: 12,
  },
  reporterInfo: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  reporterLabel: {
    fontSize: 14,
  },
  reporterName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reasonContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 14,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reportDetails: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  postPreview: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  postAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 8,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  postTime: {
    fontSize: 12,
  },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  announcementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  announcementBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  banBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  banBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  banReason: {
    fontSize: 14,
    marginBottom: 8,
  },
  banInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  banExpiry: {
    fontSize: 14,
  },
  unbanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  unbanButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 28,
  },
  modalBody: {
    padding: 16,
  },
  banModalText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  banModalSubtext: {
    fontSize: 14,
    marginBottom: 16,
  },
  banOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  banOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});