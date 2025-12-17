/**
 * Admin Event Actions Screen
 * Intermediary screen: Event -> (Manage/Create)
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar, List, Plus } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { AnimatedPressable } from '../components/AnimatedPressable';

export default function AdminEventActionsScreen() {
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
          <Calendar size={28} color="#FF9800" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Events</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What would you like to do?</Text>

        <AnimatedPressable
          style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/events')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' + '15' }]}>
            <List size={24} color="#FF9800" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Manage Events</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              Edit, delete, or manage community events
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          style={[styles.actionCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/events/create')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' + '15' }]}>
            <Plus size={24} color="#FF9800" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Create Event</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
              Add a new community event
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


