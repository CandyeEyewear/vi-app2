import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, CreditCard, Search, Users } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import {
  assignUserToPlan,
  getActiveMembershipSubscriptions,
  getSubscriptionPlanConfigs,
  searchUsersForPlanAssignment,
  updateSubscriptionPlanConfig,
  type SubscriptionPlanConfig,
  type UserMembershipCandidate,
} from '../../services/subscriptionPlanConfigService';
import type { Frequency, PaymentMethodPreference } from '../../services/paymentService';
import CustomAlert from '../../components/CustomAlert';

const PAYMENT_METHODS: PaymentMethodPreference[] = ['auto', 'integrated', 'manual_link'];
const FREQUENCIES: Frequency[] = ['monthly', 'annually', 'weekly', 'quarterly', 'daily'];

interface EditablePlan {
  id: string;
  name: string;
  amount: string;
  frequency: Frequency;
  isActive: boolean;
  paymentMethod: PaymentMethodPreference;
  manualPaymentLink: string;
}

export default function AdminSubscriptionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [editablePlans, setEditablePlans] = useState<Record<string, EditablePlan>>({});
  const [activeSubs, setActiveSubs] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userResults, setUserResults] = useState<UserMembershipCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignmentNote, setAssignmentNote] = useState('');

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ type: 'info', title: '', message: '' });

  const showAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlertConfig({ type, title, message });
    setAlertVisible(true);
  };

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId), [plans, selectedPlanId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [planRes, subRes] = await Promise.all([
        getSubscriptionPlanConfigs(),
        getActiveMembershipSubscriptions(),
      ]);

      if (!planRes.success) {
        showAlert('error', 'Plan Load Failed', planRes.error || 'Could not load plan configs');
        setPlans([]);
      } else {
        const data = planRes.data || [];
        setPlans(data);
        const mapped: Record<string, EditablePlan> = {};
        for (const p of data) {
          mapped[p.id] = {
            id: p.id,
            name: p.name,
            amount: String(p.amount || ''),
            frequency: p.frequency,
            isActive: p.isActive,
            paymentMethod: p.paymentMethod,
            manualPaymentLink: p.manualPaymentLink || '',
          };
        }
        setEditablePlans(mapped);
        if (!selectedPlanId && data[0]) setSelectedPlanId(data[0].id);
      }

      if (subRes.success) {
        setActiveSubs(subRes.data || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const run = async () => {
      setSearchingUsers(true);
      const res = await searchUsersForPlanAssignment(searchQuery);
      if (res.success) setUserResults(res.data || []);
      setSearchingUsers(false);
    };
    run();
  }, [searchQuery]);

  const onSavePlan = async (planId: string) => {
    const edited = editablePlans[planId];
    if (!edited) return;

    const amount = Number(edited.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      showAlert('warning', 'Invalid Amount', 'Enter a valid non-negative plan amount.');
      return;
    }

    if (edited.paymentMethod === 'manual_link' && !/^https?:\/\/\S+$/i.test(edited.manualPaymentLink.trim())) {
      showAlert('warning', 'Invalid Link', 'Manual payment link is required for manual mode.');
      return;
    }

    setSavingPlanId(planId);
    const result = await updateSubscriptionPlanConfig({
      id: planId,
      name: edited.name.trim(),
      amount,
      frequency: edited.frequency,
      isActive: edited.isActive,
      paymentMethod: edited.paymentMethod,
      manualPaymentLink: edited.manualPaymentLink.trim() || undefined,
    });
    setSavingPlanId(null);

    if (!result.success) {
      showAlert('error', 'Save Failed', result.error || 'Could not update plan.');
      return;
    }

    showAlert('success', 'Plan Updated', 'Subscription plan saved successfully.');
    loadAll();
  };

  const onAssignUser = async () => {
    if (!user?.id) return;
    if (!selectedUserId) {
      showAlert('warning', 'Select User', 'Choose a user to assign.');
      return;
    }
    if (!selectedPlan) {
      showAlert('warning', 'Select Plan', 'Choose a subscription plan.');
      return;
    }

    setAssigning(true);
    const result = await assignUserToPlan({
      userId: selectedUserId,
      plan: selectedPlan,
      assignedByUserId: user.id,
      note: assignmentNote.trim() || undefined,
    });
    setAssigning(false);

    if (!result.success) {
      showAlert('error', 'Assignment Failed', result.error || 'Could not assign user.');
      return;
    }

    if (result.warning) {
      showAlert('warning', 'Assigned With Warning', result.warning);
    } else {
      showAlert('success', 'Assigned', 'User has been added to the selected plan.');
    }

    setSelectedUserId('');
    setAssignmentNote('');
    loadAll();
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Access denied</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Subscriptions</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHead}>
              <CreditCard size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Plan Config</Text>
            </View>
            {plans.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>No plans found. Run migration `add_subscription_plan_configs.sql`.</Text>
            ) : (
              plans.map((plan) => {
                const edited = editablePlans[plan.id];
                if (!edited) return null;
                return (
                  <View key={plan.id} style={[styles.planRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.planKey, { color: colors.textSecondary }]}>{plan.planKey}</Text>
                    <TextInput
                      value={edited.name}
                      onChangeText={(v) => setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], name: v } }))}
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="Plan name"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <View style={styles.row}>
                      <TextInput
                        value={edited.amount}
                        onChangeText={(v) => setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], amount: v.replace(/[^0-9.]/g, '') } }))}
                        style={[styles.input, styles.half, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        placeholder="Amount"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[styles.select, styles.half, { borderColor: colors.border, backgroundColor: colors.background }]}
                        onPress={() => {
                          const i = FREQUENCIES.indexOf(edited.frequency);
                          const next = FREQUENCIES[(i + 1) % FREQUENCIES.length];
                          setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], frequency: next } }));
                        }}
                      >
                        <Text style={{ color: colors.text }}>Freq: {edited.frequency}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.select, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => {
                        const i = PAYMENT_METHODS.indexOf(edited.paymentMethod);
                        const next = PAYMENT_METHODS[(i + 1) % PAYMENT_METHODS.length];
                        setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], paymentMethod: next } }));
                      }}
                    >
                      <Text style={{ color: colors.text }}>Payment method: {edited.paymentMethod}</Text>
                    </TouchableOpacity>

                    {edited.paymentMethod !== 'integrated' && (
                      <TextInput
                        value={edited.manualPaymentLink}
                        onChangeText={(v) => setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], manualPaymentLink: v } }))}
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        placeholder="Manual payment link"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    )}

                    <View style={styles.rowBetween}>
                      <Text style={{ color: colors.textSecondary }}>Active</Text>
                      <Switch
                        value={edited.isActive}
                        onValueChange={(v) => setEditablePlans((p) => ({ ...p, [plan.id]: { ...p[plan.id], isActive: v } }))}
                        trackColor={{ false: colors.border, true: colors.primary }}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                      onPress={() => onSavePlan(plan.id)}
                      disabled={savingPlanId === plan.id}
                    >
                      {savingPlanId === plan.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Check size={16} color="#fff" />
                          <Text style={styles.saveBtnText}>Save Plan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHead}>
              <Users size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Manual Assignment</Text>
            </View>

            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search users by name/email"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {searchingUsers ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView style={styles.userList} nestedScrollEnabled>
                {userResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.userItem,
                      { borderColor: selectedUserId === u.id ? colors.primary : colors.border, backgroundColor: colors.background },
                    ]}
                    onPress={() => setSelectedUserId(u.id)}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{u.fullName}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u.email}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.select, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => {
                if (!plans.length) return;
                const idx = plans.findIndex((p) => p.id === selectedPlanId);
                const next = plans[(idx + 1 + plans.length) % plans.length];
                setSelectedPlanId(next.id);
              }}
            >
              <Text style={{ color: colors.text }}>
                Plan: {selectedPlan ? `${selectedPlan.name} (${selectedPlan.subscriptionType})` : 'Select plan'}
              </Text>
            </TouchableOpacity>

            <TextInput
              value={assignmentNote}
              onChangeText={setAssignmentNote}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Optional note"
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={onAssignUser}
              disabled={assigning}
            >
              {assigning ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Assign User To Plan</Text>}
            </TouchableOpacity>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Subscriptions</Text>
            {activeSubs.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>No active subscriptions found.</Text>
            ) : (
              activeSubs.map((s) => (
                <View key={s.id} style={[styles.subItem, { borderTopColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{s.userName || s.userId}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {s.subscriptionType} • {s.currency} {s.amount} / {s.frequency}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <CustomAlert
        visible={alertVisible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  planRow: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  planKey: { fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  select: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  saveBtn: {
    marginTop: 2,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  userList: { maxHeight: 160 },
  userItem: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  subItem: { borderTopWidth: 1, paddingTop: 10 },
  errorText: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 40 },
});
