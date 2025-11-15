/**
 * Invite Friends Screen
 * Allows users to share their invite link to grow the volunteer community
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { ChevronLeft, UserPlus, Copy, Share2, Check } from 'lucide-react-native';
import CustomAlert from '../components/CustomAlert';

export default function InviteFriendsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  
  const [copied, setCopied] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });

  // Generate invite link using user ID
  const inviteLink = user 
    ? `https://vibe.volunteersinc.org/invite?code=${user.id}`
    : '';

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleCopyLink = async () => {
    if (!inviteLink) {
      showAlert('Error', 'Unable to generate invite link', 'error');
      return;
    }

    try {
      // Use Share API with just the link - most platforms have a copy option in the share sheet
      const result = await Share.share({
        message: inviteLink,
        title: 'Copy Invite Link',
      });
      
      // Show success message
      if (result.action === Share.sharedAction || result.action === Share.dismissedAction) {
        setCopied(true);
        showAlert('Link Ready', 'You can copy the link from the share options', 'success');
        
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error sharing link:', error);
      if (error.message !== 'User did not share') {
        showAlert('Error', 'Failed to open share options', 'error');
      }
    }
  };

  const handleShare = async () => {
    if (!inviteLink) {
      showAlert('Error', 'Unable to generate invite link', 'error');
      return;
    }

    try {
      const shareMessage = `Join me on VIbe - the volunteer social network! Together we can make a difference in our community. Sign up using my invite link:\n\n${inviteLink}`;
      
      await Share.share({
        message: shareMessage,
        title: 'Invite to VIbe',
      });
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.message !== 'User did not share') {
        showAlert('Error', 'Failed to share invite link', 'error');
      }
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Friends</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Please sign in to invite friends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <UserPlus size={48} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Grow the Volunteer Community
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Invite your friends to join VIbe and make a bigger impact together. Share your unique invite link and help build a stronger volunteer network.
          </Text>
        </View>

        {/* Invite Link Section */}
        <View style={[styles.linkSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Invite Link</Text>
          <View style={[styles.linkContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text 
              style={[styles.linkText, { color: colors.text }]} 
              numberOfLines={2}
              selectable
            >
              {inviteLink}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.copyButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                copied && { borderColor: colors.success }
              ]}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              {copied ? (
                <Check size={20} color={colors.success} />
              ) : (
                <Copy size={20} color={colors.text} />
              )}
              <Text style={[styles.actionButtonText, { color: copied ? colors.success : colors.text }]}>
                {copied ? 'Copied!' : 'Copy Link'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton, { backgroundColor: colors.primary }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Share2 size={20} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={[styles.benefitsTitle, { color: colors.text }]}>Why Invite Friends?</Text>
          
          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '15' }]}>
              <UserPlus size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>Build Your Network</Text>
              <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                Connect with friends and expand your volunteer circle
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '15' }]}>
              <UserPlus size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>Greater Impact</Text>
              <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                More volunteers means more opportunities to help our community
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '15' }]}>
              <UserPlus size={20} color={colors.primary} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>Share Experiences</Text>
              <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                Volunteer together and share your journey with friends
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  linkSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  linkContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  copyButton: {
    // Styles applied via inline styles
  },
  shareButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  benefitsSection: {
    marginTop: 8,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
});

