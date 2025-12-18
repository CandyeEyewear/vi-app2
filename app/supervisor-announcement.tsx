/**
 * Supervisor Announcement Actions Screen
 * Intermediary screen: Announcement -> (Manage/Create) - No delete access
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Megaphone, List, Plus } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { AnimatedPressable } from '../components/AnimatedPressable';

export default function SupervisorAnnouncementActionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <Megaphone size={28} color="#9C27B0" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Announcements</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What would you like to do?</Text>

        <AnimatedPressable
          style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/(supervisor)/announcements')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
            <List size={24} color="#9C27B0" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Manage Announcements</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              View and edit announcements
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/create-announcement')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
            <Plus size={24} color="#9C27B0" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Create Announcement</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              Post important updates to all volunteers
            </Text>
          </View>
        </AnimatedPressable>
      </ScrollView>
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
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    gap: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
  },
});

