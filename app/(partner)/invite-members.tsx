/**
 * Partner Invite Members Screen
 * Send email invitations and view invite history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import { ChevronLeft, UserPlus, Mail, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import CustomAlert from '../../components/CustomAlert';
import Button from '../../components/Button';

interface Invite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
}

export default function InviteMembersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    if (user?.id) loadInvites();
  }, [user?.id]);

  const loadInvites = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_invites')
        .select('id, email, status, created_at, accepted_at, expires_at')
        .eq('partner_org_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[INVITE MEMBERS] Error loading invites:', error);
        return;
      }

      setInvites(data || []);
    } catch (error) {
      console.error('[INVITE MEMBERS] Exception:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvites();
  }, [user?.id]);

  const sendInvite = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      showAlert('Error', 'Please enter an email address', 'error');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showAlert('Error', 'Please enter a valid email address', 'error');
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase.functions.invoke('partner-invite', {
        body: { email: trimmedEmail },
      });

      if (error) {
        console.error('[INVITE MEMBERS] Function error:', error);
        showAlert('Error', 'Failed to send invite. Please try again.', 'error');
        return;
      }

      if (data?.success) {
        showAlert('Invite Sent', `Invitation sent to ${trimmedEmail}`, 'success');
        setEmail('');
        loadInvites();
      } else {
        showAlert('Error', data?.error || 'Failed to send invite', 'error');
      }
    } catch (error: any) {
      console.error('[INVITE MEMBERS] Exception:', error);
      showAlert('Error', error.message || 'An unexpected error occurred', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle size={18} color="#10B981" />;
      case 'expired':
        return <XCircle size={18} color="#EF4444" />;
      default:
        return <Clock size={18} color="#F59E0B" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#10B981';
      case 'expired': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const renderInvite = ({ item }: { item: Invite }) => {
    const isExpired = item.status === 'pending' && new Date(item.expires_at) < new Date();
    const displayStatus = isExpired ? 'expired' : item.status;

    return (
      <View style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.inviteIcon}>
          {getStatusIcon(displayStatus)}
        </View>
        <View style={styles.inviteInfo}>
          <Text style={[styles.inviteEmail, { color: colors.text }]} numberOfLines={1}>
            {item.email}
          </Text>
          <Text style={[styles.inviteDate, { color: colors.textSecondary }]}>
            Sent {formatDate(item.created_at)}
            {item.accepted_at ? ` \u00B7 Accepted ${formatDate(item.accepted_at)}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(displayStatus) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(displayStatus) }]}>
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Mail size={40} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No invitations sent yet
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <UserPlus size={24} color="#F59E0B" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Invite Members
          </Text>
        </View>
      </View>

      {/* Form lives outside FlatList so TextInput keeps focus on keystroke */}
      {!loading && (
        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            Send Invitation
          </Text>
          <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
            Enter the email address of the person you'd like to invite
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.emailInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="team@example.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sending}
            />
            <Button
              variant="primary"
              size="md"
              onPress={sendInvite}
              disabled={sending || !email.trim()}
              loading={sending}
              style={[styles.sendButton, { backgroundColor: '#F59E0B' }]}
            >
              Send
            </Button>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={invites}
          keyExtractor={(item) => item.id}
          renderItem={renderInvite}
          ListHeaderComponent={invites.length > 0 ? () => (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Invite History
            </Text>
          ) : null}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  formSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 0,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  emailInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  sendButton: {
    minWidth: 80,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  inviteCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
    gap: 12,
  },
  inviteIcon: {
    width: 32,
    alignItems: 'center',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteEmail: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  inviteDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
});
