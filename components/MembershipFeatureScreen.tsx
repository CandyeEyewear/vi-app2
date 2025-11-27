import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Crown, CheckCircle, Plus, Shirt, TrendingUp } from 'lucide-react-native';
import { Colors } from '../constants/colors';

interface MembershipFeatureScreenProps {
  showHeader?: boolean;
  onBack?: () => void;
}

export const MembershipFeatureScreen: React.FC<MembershipFeatureScreenProps> = ({
  showHeader = true,
  onBack,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      {showHeader && (
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Membership Features</Text>
          <View style={styles.backButton} />
        </View>
      )}

      {/* Membership Feature Content */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
            <Crown size={64} color={colors.tint} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Membership Feature
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Become an Official Member to unlock exclusive features and benefits.
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Official Members get access to:
          </Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <CheckCircle size={24} color={colors.tint} fill={colors.tint} />
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>
                  Blue Tick / Official Member Designation
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                  Get verified with a blue checkmark badge and Official Member status
                </Text>
              </View>
            </View>
            <View style={styles.benefitItem}>
              <Plus size={24} color={colors.tint} />
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>
                  Propose Volunteer Opportunities
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                  Create and submit new volunteer opportunities for review
                </Text>
              </View>
            </View>
            <View style={styles.benefitItem}>
              <Shirt size={24} color={colors.tint} />
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>
                  Customized Blue VI T-Shirt
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                  Receive an exclusive VI branded t-shirt
                </Text>
              </View>
            </View>
            <View style={styles.benefitItem}>
              <TrendingUp size={24} color={colors.tint} />
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>
                  Impact Statistics View on Profile
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                  View detailed statistics of your volunteer impact and contributions
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.memberButton, { backgroundColor: colors.tint }]}
            onPress={() => {
              // Navigate to subscription screen
              router.push('/membership/subscribe');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.memberButtonText}>Become an Official Member</Text>
          </TouchableOpacity>
          {showHeader && (
            <TouchableOpacity
              style={styles.backButtonText}
              onPress={handleBack}
            >
              <Text style={[styles.backButtonTextLabel, { color: colors.textSecondary }]}>
                Go Back
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

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
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  benefitsList: {
    width: '100%',
    marginBottom: 32,
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  memberButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  memberButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButtonText: {
    paddingVertical: 12,
  },
  backButtonTextLabel: {
    fontSize: 15,
    textAlign: 'center',
  },
});

