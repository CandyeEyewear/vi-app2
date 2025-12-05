/**
 * Manage Causes Screen
 * Admin screen to view, edit, delete causes
 * File: app/(admin)/causes/index.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Heart,
  Edit3,
  Trash2,
  MoreVertical,
  Eye,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
  BarChart3,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Cause, CauseStatus } from '../../../types';
import { supabase } from '../../../services/supabase';
import { formatCurrency, getCauseProgress, getCauses } from '../../../services/causesService';
import { useAuth } from '../../../contexts/AuthContext';
import CustomAlert from '../../../components/CustomAlert';

const screenWidth = Dimensions.get('window').width;

// Status filter options
const STATUS_FILTERS: { value: CauseStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: '#888' },
  { value: 'active', label: 'Active', color: '#4CAF50' },
  { value: 'draft', label: 'Draft', color: '#9E9E9E' },
  { value: 'paused', label: 'Paused', color: '#FF9800' },
  { value: 'completed', label: 'Completed', color: '#2196F3' },
  { value: 'cancelled', label: 'Cancelled', color: '#F44336' },
];

// Status badge colors
const STATUS_COLORS: Record<CauseStatus, { bg: string; text: string }> = {
  draft: { bg: '#9E9E9E20', text: '#757575' },
  active: { bg: '#4CAF5020', text: '#4CAF50' },
  paused: { bg: '#FF980020', text: '#FF9800' },
  completed: { bg: '#2196F320', text: '#2196F3' },
  cancelled: { bg: '#F4433620', text: '#F44336' },
};

interface CauseItemProps {
  cause: Cause;
  colors: any;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: (status: CauseStatus) => void;
  onView: () => void;
  onSummary: () => void;
}

function CauseItem({ cause, colors, onEdit, onDelete, onChangeStatus, onView, onSummary }: CauseItemProps) {
  const [showActions, setShowActions] = useState(false);
  const progress = getCauseProgress(cause);
  const statusColor = STATUS_COLORS[cause.status];

  return (
    <View style={[styles.causeItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={styles.causeHeader}>
        <View style={styles.causeTitleRow}>
          <Text style={[styles.causeTitle, { color: colors.text }]} numberOfLines={1}>
            {cause.title}
          </Text>
          {cause.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
              <TrendingUp size={10} color="#000" />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowActions(!showActions)}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.statusText, { color: statusColor.text }]}>
          {cause.status.charAt(0).toUpperCase() + cause.status.slice(1)}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: '#38B6FF' },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {Math.round(progress)}%
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(cause.amountRaised)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            of {formatCurrency(cause.goalAmount)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Users size={14} color={colors.textSecondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {cause.donorCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>donors</Text>
        </View>
      </View>

      {/* Actions Dropdown */}
      {showActions && (
        <View style={[styles.actionsDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.actionItem} onPress={onView}>
            <Eye size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>View</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={onSummary}>
            <BarChart3 size={18} color="#9C27B0" />
            <Text style={[styles.actionText, { color: '#9C27B0' }]}>Summary</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={onEdit}>
            <Edit3 size={18} color="#38B6FF" />
            <Text style={[styles.actionText, { color: '#38B6FF' }]}>Edit</Text>
          </TouchableOpacity>

          {cause.status === 'active' && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onChangeStatus('paused')}>
              <Pause size={18} color="#FF9800" />
              <Text style={[styles.actionText, { color: '#FF9800' }]}>Pause</Text>
            </TouchableOpacity>
          )}

          {cause.status === 'paused' && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onChangeStatus('active')}>
              <Play size={18} color="#4CAF50" />
              <Text style={[styles.actionText, { color: '#4CAF50' }]}>Resume</Text>
            </TouchableOpacity>
          )}

          {cause.status === 'draft' && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onChangeStatus('active')}>
              <Play size={18} color="#4CAF50" />
              <Text style={[styles.actionText, { color: '#4CAF50' }]}>Publish</Text>
            </TouchableOpacity>
          )}

          {(cause.status === 'active' || cause.status === 'paused') && (
            <TouchableOpacity style={styles.actionItem} onPress={() => onChangeStatus('completed')}>
              <CheckCircle size={18} color="#2196F3" />
              <Text style={[styles.actionText, { color: '#2196F3' }]}>Mark Complete</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={onDelete}>
            <Trash2 size={18} color="#F44336" />
            <Text style={[styles.actionText, { color: '#F44336' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ManageCausesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isAdmin, user } = useAuth();

  // State
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CauseStatus | 'all'>('all');

  // Custom Alert State
  const [alertProps, setAlertProps] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    onConfirm: undefined as (() => void) | undefined,
    showCancel: false,
  });

  // Show alert helper
  const showAlert = useCallback(
    (
      type: 'success' | 'error' | 'warning' | 'info',
      title: string,
      message: string,
      onConfirm?: () => void,
      showCancel: boolean = false
    ) => {
      setAlertProps({
        visible: true,
        type,
        title,
        message,
        onConfirm,
        showCancel,
      });
    },
    []
  );

  // Close alert
  const closeAlert = useCallback(() => {
    setAlertProps((prev) => ({ ...prev, visible: false }));
  }, []);

  // Fetch causes
  const fetchCauses = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use getCauses service which automatically recalculates amount_raised from donations
      // Pass user ID so the service can check if user is admin and show all causes
      const response = await getCauses({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        userId: user?.id, // Pass user ID so admin check works properly
      });

      if (response.success && response.data) {
        setCauses(response.data);
      } else {
        throw new Error(response.error || 'Failed to load causes');
      }
    } catch (error) {
      console.error('Error fetching causes:', error);
      showAlert('error', 'Error', 'Failed to load causes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, showAlert, user?.id]);

  // Initial load
  useEffect(() => {
    fetchCauses();
  }, [fetchCauses]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCauses();
  }, [fetchCauses]);

  // Change cause status
  const handleChangeStatus = useCallback(async (causeId: string, newStatus: CauseStatus) => {
    try {
      const { error } = await supabase
        .from('causes')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', causeId);

      if (error) throw error;

      // Update local state
      setCauses(prev =>
        prev.map(c => (c.id === causeId ? { ...c, status: newStatus } : c))
      );

      showAlert('success', 'Success', `Cause status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('error', 'Error', 'Failed to update cause status');
    }
  }, [showAlert]);

  // Delete cause
  const handleDelete = useCallback((cause: Cause) => {
    const performDelete = async () => {
      closeAlert();
      try {
        const { error } = await supabase
          .from('causes')
          .delete()
          .eq('id', cause.id);

        if (error) throw error;

        setCauses(prev => prev.filter(c => c.id !== cause.id));
        showAlert('success', 'Success', 'Cause deleted successfully');
      } catch (error) {
        console.error('Error deleting cause:', error);
        showAlert('error', 'Error', 'Failed to delete cause');
      }
    };

    showAlert(
      'error',
      'Delete Cause',
      `Are you sure you want to delete "${cause.title}"? This action cannot be undone.`,
      performDelete,
      true
    );
  }, [showAlert, closeAlert]);

  // Navigate to edit
  const handleEdit = useCallback((causeId: string) => {
    router.push(`/causes/edit/${causeId}`);
  }, [router]);

  // Navigate to view (public detail page)
  const handleView = useCallback((causeId: string) => {
    router.push(`/causes/${causeId}`);
  }, [router]);

  // Navigate to summary page
  const handleSummary = useCallback((causeId: string) => {
    router.push(`/(admin)/causes/${causeId}/summary`);
  }, [router]);

  // Access check
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Causes</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  // Render filter chip
  const renderFilterChip = ({ item }: { item: typeof STATUS_FILTERS[0] }) => {
    const isSelected = statusFilter === item.value;
    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          { backgroundColor: isSelected ? item.color : colors.card, borderColor: isSelected ? item.color : colors.border },
        ]}
        onPress={() => setStatusFilter(item.value)}
      >
        <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render cause item
  const renderCauseItem = ({ item }: { item: Cause }) => (
    <CauseItem
      cause={item}
      colors={colors}
      onEdit={() => handleEdit(item.id)}
      onDelete={() => handleDelete(item)}
      onChangeStatus={(status) => handleChangeStatus(item.id, status)}
      onView={() => handleView(item.id)}
      onSummary={() => handleSummary(item.id)}
    />
  );

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Heart size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No causes found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {statusFilter !== 'all'
            ? `No ${statusFilter} causes. Try a different filter.`
            : 'Create your first fundraising cause!'}
        </Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: '#38B6FF' }]}
          onPress={() => router.push('/causes/create')}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Cause</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Causes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/causes/create')}
        >
          <Plus size={24} color="#38B6FF" />
        </TouchableOpacity>
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={STATUS_FILTERS}
          renderItem={renderFilterChip}
          keyExtractor={(item) => item.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Causes List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading causes...</Text>
        </View>
      ) : (
        <FlatList
          data={causes}
          renderItem={renderCauseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38B6FF" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={alertProps.visible}
        type={alertProps.type}
        title={alertProps.title}
        message={alertProps.message}
        onClose={closeAlert}
        onConfirm={alertProps.onConfirm}
        showCancel={alertProps.showCancel}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
  },
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  causeItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  causeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  causeTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  causeTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  featuredBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    padding: 4,
    marginRight: -4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  actionsDropdown: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
});
