/**
 * Admin Manage Opportunities Screen
 * Central place to edit/delete opportunities and access admin QR (check-in code)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import CustomAlert from '../../../components/CustomAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  QrCode,
  RefreshCw,
  Calendar,
  MapPin,
  Users,
  Share2,
  X,
} from 'lucide-react-native';

type OpportunityRow = {
  id: string;
  title: string | null;
  organization_name: string | null;
  category: string | null;
  status: string | null;
  proposal_status: string | null;
  location: string | null;
  spots_available: number | null;
  spots_total: number | null;
  check_in_code: string | null;
  created_at: string | null;
};

type OpportunityListItem = {
  id: string;
  title: string;
  organizationName: string;
  category: string;
  status: string;
  proposalStatus?: string;
  location?: string;
  spotsAvailable?: number;
  spotsTotal?: number;
  checkInCode?: string;
  createdAt?: string;
};

export default function AdminManageOpportunitiesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const highlightId = typeof params?.highlight === 'string' ? params.highlight : undefined;

  const insets = useSafeAreaInsets();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[colorScheme];
  const { isAdmin } = useAuth();

  const listRef = useRef<FlatList<OpportunityListItem> | null>(null);
  const qrCodeRef = useRef<View>(null);

  const [items, setItems] = useState<OpportunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // QR modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [activeQr, setActiveQr] = useState<{ title: string; checkInCode: string } | null>(null);

  // Custom Alert State
  const [alertProps, setAlertProps] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    onConfirm: undefined as (() => void) | undefined,
    showCancel: false,
  });

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

  const closeAlert = useCallback(() => {
    setAlertProps((prev) => ({ ...prev, visible: false }));
  }, []);

  const mapRow = useCallback((row: OpportunityRow): OpportunityListItem => {
    return {
      id: row.id,
      title: row.title ?? 'Untitled',
      organizationName: row.organization_name ?? 'Unknown organization',
      category: row.category ?? 'unknown',
      status: row.status ?? 'unknown',
      proposalStatus: row.proposal_status ?? undefined,
      location: row.location ?? undefined,
      spotsAvailable: row.spots_available ?? undefined,
      spotsTotal: row.spots_total ?? undefined,
      checkInCode: row.check_in_code ?? undefined,
      createdAt: row.created_at ?? undefined,
    };
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select(
          'id,title,organization_name,category,status,proposal_status,location,spots_available,spots_total,check_in_code,created_at'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      const next = (data as OpportunityRow[] | null)?.map(mapRow) ?? [];
      setItems(next);

      if (highlightId) {
        const idx = next.findIndex((x) => x.id === highlightId);
        if (idx >= 0) {
          // Give FlatList a tick to render before scrolling.
          setTimeout(() => {
            try {
              listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
            } catch {
              // ignore
            }
          }, 250);
        }
      }
    } catch (e: any) {
      console.error('Error loading opportunities:', e);
      showAlert('error', 'Error', e?.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [highlightId, mapRow, showAlert]);

  React.useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOpportunities();
    setRefreshing(false);
  }, [fetchOpportunities]);

  const handleDelete = useCallback(
    async (id: string) => {
      showAlert(
        'warning',
        'Delete Opportunity?',
        'This will permanently delete the opportunity.',
        async () => {
          try {
            setSubmitting(true);
            const { error } = await supabase.from('opportunities').delete().eq('id', id);
            if (error) throw error;
            showAlert('success', 'Deleted', 'Opportunity has been deleted');
            await fetchOpportunities();
          } catch (e: any) {
            console.error('Error deleting opportunity:', e);
            showAlert('error', 'Error', e?.message || 'Failed to delete opportunity');
          } finally {
            setSubmitting(false);
          }
        },
        true
      );
    },
    [fetchOpportunities, showAlert]
  );

  const openQr = useCallback((item: OpportunityListItem) => {
    if (!item.checkInCode) {
      showAlert('warning', 'No QR Code', 'No check-in code is available for this opportunity.');
      return;
    }
    setActiveQr({ title: item.title, checkInCode: item.checkInCode });
    setQrModalVisible(true);
  }, [showAlert]);

  const handleShareQRCode = useCallback(async () => {
    try {
      if (!qrCodeRef.current) return;
      const uri = await captureRef(qrCodeRef, { format: 'png', quality: 1 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      } else {
        showAlert('info', 'Info', 'Sharing is not available on this device');
      }
    } catch (e) {
      console.error('Error sharing QR code:', e);
      showAlert('error', 'Error', 'Failed to share QR code');
    }
  }, [showAlert]);

  const surfaceShadow = useMemo(
    () =>
      Platform.select({
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
      }),
    []
  );

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Opportunities</Text>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconButton, { backgroundColor: colors.card }]}
          disabled={loading || refreshing}
        >
          <RefreshCw size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading opportunities...</Text>
        </View>
      ) : (
        <FlatList
          ref={(r) => (listRef.current = r)}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const isHighlighted = highlightId && item.id === highlightId;
            return (
              <View
                style={[
                  styles.card,
                  surfaceShadow,
                  {
                    backgroundColor: colors.card,
                    borderColor: isHighlighted ? colors.primary : colors.border,
                    borderWidth: isHighlighted ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.organizationName}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.status}
                      {item.proposalStatus ? ` • ${item.proposalStatus}` : ''}
                    </Text>
                  </View>
                  {item.location ? (
                    <View style={styles.metaItem}>
                      <MapPin size={14} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  ) : null}
                  {typeof item.spotsAvailable === 'number' && typeof item.spotsTotal === 'number' ? (
                    <View style={styles.metaItem}>
                      <Users size={14} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.spotsAvailable}/{item.spotsTotal} spots
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  <AnimatedPressable
                    onPress={() => router.push(`/edit-opportunity/${item.id}`)}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.primarySoft ?? colors.primary + '15',
                        borderColor: colors.primary + '35',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit opportunity"
                  >
                    <View style={[styles.actionIconPill, { backgroundColor: colors.primary + '20' }]}>
                      <Edit3 size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={() => openQr(item)}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.successSoft ?? colors.success + '15',
                        borderColor: colors.success + '35',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Show QR code"
                  >
                    <View style={[styles.actionIconPill, { backgroundColor: colors.success + '20' }]}>
                      <QrCode size={16} color={colors.success} />
                    </View>
                    <Text style={[styles.actionText, { color: colors.success }]}>QR</Text>
                  </AnimatedPressable>

                  <AnimatedPressable
                    onPress={() => handleDelete(item.id)}
                    disabled={submitting}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.errorSoft ?? colors.error + '12',
                        borderColor: colors.error + '35',
                        opacity: submitting ? 0.7 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete opportunity"
                  >
                    <View style={[styles.actionIconPill, { backgroundColor: colors.error + '20' }]}>
                      <Trash2 size={16} color={colors.error} />
                    </View>
                    <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                  </AnimatedPressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>No opportunities found.</Text>
            </View>
          }
        />
      )}

      {/* QR Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                {activeQr?.title || 'Check-In QR Code'}
              </Text>
              <TouchableOpacity
                onPress={() => setQrModalVisible(false)}
                style={[styles.modalClose, { backgroundColor: colors.card }]}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View ref={qrCodeRef} style={styles.qrContainer} collapsable={false}>
              <View style={styles.qrInner}>
                {activeQr?.checkInCode ? (
                  <>
                    <QRCode value={activeQr.checkInCode} size={220} backgroundColor="#FFF" color="#000" />
                    <Text style={styles.qrCodeText}>{activeQr.checkInCode}</Text>
                  </>
                ) : (
                  <Text style={[styles.qrError, { color: colors.error }]}>No check-in code available</Text>
                )}
              </View>
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

      <CustomAlert
        visible={alertProps.visible}
        type={alertProps.type}
        title={alertProps.title}
        message={alertProps.message}
        onConfirm={() => {
          closeAlert();
          alertProps.onConfirm?.();
        }}
        onCancel={closeAlert}
        showCancel={alertProps.showCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  metaRow: { gap: 6, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 12, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 44,
  },
  actionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  qrModal: { width: '100%', maxWidth: 520, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', flex: 1, paddingRight: 12 },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  qrContainer: { alignItems: 'center', marginBottom: 16 },
  qrInner: { backgroundColor: '#FFF', padding: 18, borderRadius: 16, alignItems: 'center' },
  qrCodeText: { marginTop: 12, fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 1.5 },
  qrError: { fontSize: 14, padding: 18, textAlign: 'center' },
  qrShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  qrShareBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});


