import { supabase } from './supabase';
import type { Frequency, PaymentMethodPreference, SubscriptionType } from './paymentService';

export interface SubscriptionPlanConfig {
  id: string;
  planKey: string;
  name: string;
  subscriptionType: Extract<SubscriptionType, 'membership' | 'organization_membership'>;
  amount: number;
  currency: string;
  frequency: Frequency;
  description?: string;
  isActive: boolean;
  paymentMethod: PaymentMethodPreference;
  manualPaymentLink?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UserMembershipCandidate {
  id: string;
  fullName: string;
  email: string;
  accountType?: 'individual' | 'organization' | 'volunteer';
  membershipTier?: 'free' | 'premium';
  membershipStatus?: 'inactive' | 'active' | 'expired' | 'cancelled';
}

export interface ActiveSubscriptionSummary {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subscriptionType: SubscriptionType;
  amount: number;
  currency: string;
  frequency: Frequency;
  status: string;
  nextBillingDate?: string;
  createdAt: string;
}

const DEFAULT_PLAN_KEYS_BY_TYPE: Record<'membership' | 'organization_membership', string> = {
  membership: 'membership_annual',
  organization_membership: 'organization_yearly',
};

const normalizePlan = (row: any): SubscriptionPlanConfig => ({
  id: row.id,
  planKey: row.plan_key,
  name: row.name,
  subscriptionType: row.subscription_type,
  amount: Number(row.amount || 0),
  currency: row.currency || 'JMD',
  frequency: row.frequency,
  description: row.description || undefined,
  isActive: row.is_active ?? true,
  paymentMethod: row.payment_method || 'auto',
  manualPaymentLink: row.manual_payment_link || undefined,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function computeNextBillingDate(startDate: Date, frequency: Frequency): string | undefined {
  const date = new Date(startDate);
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return undefined;
  }
  return date.toISOString();
}

export async function getSubscriptionPlanConfigs(options?: {
  activeOnly?: boolean;
  subscriptionType?: 'membership' | 'organization_membership';
}): Promise<{ success: boolean; data?: SubscriptionPlanConfig[]; error?: string }> {
  try {
    let query = supabase
      .from('subscription_plan_configs')
      .select('*')
      .order('subscription_type', { ascending: true })
      .order('amount', { ascending: true });

    if (options?.activeOnly) query = query.eq('is_active', true);
    if (options?.subscriptionType) query = query.eq('subscription_type', options.subscriptionType);

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      data: (data || []).map(normalizePlan),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load subscription plans' };
  }
}

export async function getSubscriptionPlanByKey(
  planKey: string
): Promise<{ success: boolean; data?: SubscriptionPlanConfig; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('subscription_plan_configs')
      .select('*')
      .eq('plan_key', planKey)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: 'Plan not found' };

    return { success: true, data: normalizePlan(data) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load plan' };
  }
}

export async function getDefaultPlanForType(
  subscriptionType: 'membership' | 'organization_membership'
): Promise<{ success: boolean; data?: SubscriptionPlanConfig; error?: string }> {
  const preferredKey = DEFAULT_PLAN_KEYS_BY_TYPE[subscriptionType];
  const byKey = await getSubscriptionPlanByKey(preferredKey);
  if (byKey.success && byKey.data?.isActive) return byKey;

  const list = await getSubscriptionPlanConfigs({ activeOnly: true, subscriptionType });
  if (!list.success || !list.data?.length) {
    return { success: false, error: list.error || 'No active plans found' };
  }

  return { success: true, data: list.data[0] };
}

export async function updateSubscriptionPlanConfig(
  plan: Pick<SubscriptionPlanConfig, 'id'> &
    Partial<
      Pick<
        SubscriptionPlanConfig,
        | 'name'
        | 'amount'
        | 'currency'
        | 'frequency'
        | 'description'
        | 'isActive'
        | 'paymentMethod'
        | 'manualPaymentLink'
        | 'metadata'
      >
    >
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (plan.name !== undefined) updateData.name = plan.name;
    if (plan.amount !== undefined) updateData.amount = plan.amount;
    if (plan.currency !== undefined) updateData.currency = plan.currency;
    if (plan.frequency !== undefined) updateData.frequency = plan.frequency;
    if (plan.description !== undefined) updateData.description = plan.description;
    if (plan.isActive !== undefined) updateData.is_active = plan.isActive;
    if (plan.paymentMethod !== undefined) updateData.payment_method = plan.paymentMethod;
    if (plan.manualPaymentLink !== undefined) updateData.manual_payment_link = plan.manualPaymentLink || null;
    if (plan.metadata !== undefined) updateData.metadata = plan.metadata;

    const { error } = await supabase
      .from('subscription_plan_configs')
      .update(updateData)
      .eq('id', plan.id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update plan' };
  }
}

export async function searchUsersForPlanAssignment(
  query: string
): Promise<{ success: boolean; data?: UserMembershipCandidate[]; error?: string }> {
  try {
    let request = supabase
      .from('users')
      .select('id, full_name, email, account_type, membership_tier, membership_status')
      .order('created_at', { ascending: false })
      .limit(25);

    const trimmed = query.trim();
    if (trimmed) {
      request = request.or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`);
    }

    const { data, error } = await request;
    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((row: any) => ({
        id: row.id,
        fullName: row.full_name || 'Unknown',
        email: row.email || '',
        accountType: row.account_type,
        membershipTier: row.membership_tier || 'free',
        membershipStatus: row.membership_status || 'inactive',
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to search users' };
  }
}

export async function assignUserToPlan(params: {
  userId: string;
  plan: SubscriptionPlanConfig;
  assignedByUserId: string;
  note?: string;
}): Promise<{ success: boolean; warning?: string; error?: string }> {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const nextBillingDate = computeNextBillingDate(now, params.plan.frequency);

    const { data: userData, error: userFetchError } = await supabase
      .from('users')
      .select('id, full_name, email, account_type')
      .eq('id', params.userId)
      .single();

    if (userFetchError || !userData) {
      throw new Error('User not found');
    }

    const membershipUpdate: Record<string, any> = {
      membership_tier: 'premium',
      membership_status: 'active',
      subscription_start_date: nowIso,
      membership_expires_at: nextBillingDate || null,
      updated_at: nowIso,
    };

    if (params.plan.subscriptionType === 'membership') {
      membershipUpdate.is_premium = true;
    } else {
      membershipUpdate.is_partner_organization = true;
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update(membershipUpdate)
      .eq('id', params.userId);

    if (userUpdateError) throw userUpdateError;

    const subscriptionInsert = {
      user_id: params.userId,
      subscription_type: params.plan.subscriptionType,
      amount: params.plan.amount,
      currency: params.plan.currency,
      frequency: params.plan.frequency,
      description: `Manual admin assignment: ${params.plan.name}`,
      status: 'active',
      start_date: nowIso,
      next_billing_date: nextBillingDate || null,
      customer_email: userData.email || null,
      customer_name: userData.full_name || null,
      metadata: {
        manual_assignment: true,
        plan_key: params.plan.planKey,
        assigned_by: params.assignedByUserId,
        note: params.note || null,
      },
      updated_at: nowIso,
    };

    const { error: subscriptionInsertError } = await supabase
      .from('payment_subscriptions')
      .insert(subscriptionInsert);

    if (subscriptionInsertError) {
      return {
        success: true,
        warning: 'Membership was updated, but subscription audit record could not be created.',
      };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to assign user to plan' };
  }
}

export async function getActiveMembershipSubscriptions(): Promise<{
  success: boolean;
  data?: ActiveSubscriptionSummary[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('payment_subscriptions')
      .select('id, user_id, subscription_type, amount, currency, frequency, status, next_billing_date, created_at, user:users(full_name,email)')
      .in('subscription_type', ['membership', 'organization_membership'])
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user?.full_name,
        userEmail: row.user?.email,
        subscriptionType: row.subscription_type,
        amount: Number(row.amount || 0),
        currency: row.currency || 'JMD',
        frequency: row.frequency,
        status: row.status,
        nextBillingDate: row.next_billing_date || undefined,
        createdAt: row.created_at,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load active subscriptions' };
  }
}
