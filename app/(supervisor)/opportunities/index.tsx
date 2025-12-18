/**
 * Supervisor Manage Opportunities Screen
 * View and edit opportunities - No delete access
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
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import {
  ArrowLeft,
  Edit3,
  RefreshCw,
  Calendar,
  MapPin,
  Users,
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
  createdAt?: string;
};

export default function SupervisorManageOpportunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[colorScheme];
  const { isSup } = useAuth();

  const listRef = useRef<FlatList<OpportunityListItem> | null>(null);

  const [items, setItems] = useState<OpportunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      createdAt: row.created_at ?? undefined,
    };
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select(
          'id,title,organization_name,category,status,proposal_status,location,spots_available,spots_total,created_at'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      const next = (data as OpportunityRow[] | null)?.map(mapRow) ?? [];
      setItems(next);
    } catch (e: any) {
      console.error('Error loading opportunities:', e);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  React.useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOpportunities();
    setRefreshing(false);
  }, [fetchOpportunities]);

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

  if (!isSup) {
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
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading opportunities...</Text>
        </View>
      ) : (
        <FlatList
          ref={(r) => (listRef.current = r)}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          renderItem={({ item }) => {
            return (
              <View
                style={[
                  styles.card,
                  surfaceShadow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
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
                        backgroundColor: '#10B981' + '15',
                        borderColor: '#10B981' + '35',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit opportunity"
                  >
                    <View style={[styles.actionIconPill, { backgroundColor: '#10B981' + '20' }]}>
                      <Edit3 size={16} color="#10B981" />
                    </View>
                    <Text style={[styles.actionText, { color: '#10B981' }]}>Edit</Text>
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
  actionsRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-start' },
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
    maxWidth: 150,
  },
  actionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },
});

