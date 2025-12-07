/**
 * Hook for managing user reminder settings
 * Handles fetching and updating reminder preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ReminderSettings {
  id: string;
  userId: string;
  remindersEnabled: boolean;
  remindDayBefore: boolean;
  remindDayOf: boolean;
  remindHoursBefore: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useReminderSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch user's reminder settings
  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // If settings don't exist, create default ones
        if (fetchError.code === 'PGRST116') {
          const { data: newSettings, error: createError } = await supabase
            .from('reminder_settings')
            .insert({
              user_id: user.id,
              reminders_enabled: true,
              remind_day_before: true,
              remind_day_of: true,
              remind_hours_before: null,
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          setSettings({
            id: newSettings.id,
            userId: newSettings.user_id,
            remindersEnabled: newSettings.reminders_enabled,
            remindDayBefore: newSettings.remind_day_before,
            remindDayOf: newSettings.remind_day_of,
            remindHoursBefore: newSettings.remind_hours_before,
            createdAt: newSettings.created_at,
            updatedAt: newSettings.updated_at,
          });
        } else {
          throw fetchError;
        }
      } else if (data) {
        setSettings({
          id: data.id,
          userId: data.user_id,
          remindersEnabled: data.reminders_enabled,
          remindDayBefore: data.remind_day_before,
          remindDayOf: data.remind_day_of,
          remindHoursBefore: data.remind_hours_before,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reminder settings';
      setError(errorMessage);
      console.error('Error fetching reminder settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Update reminder settings
  const updateSettings = useCallback(async (updates: Partial<ReminderSettings>) => {
    if (!user?.id || !settings) {
      throw new Error('User not authenticated or settings not loaded');
    }

    try {
      setUpdating(true);
      setError(null);

      // Map camelCase to snake_case for database
      const dbUpdates: any = {};
      if (updates.remindersEnabled !== undefined) {
        dbUpdates.reminders_enabled = updates.remindersEnabled;
      }
      if (updates.remindDayBefore !== undefined) {
        dbUpdates.remind_day_before = updates.remindDayBefore;
      }
      if (updates.remindDayOf !== undefined) {
        dbUpdates.remind_day_of = updates.remindDayOf;
      }
      if (updates.remindHoursBefore !== undefined) {
        dbUpdates.remind_hours_before = updates.remindHoursBefore;
      }
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error: updateError } = await supabase
        .from('reminder_settings')
        .update(dbUpdates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update local state
      if (data) {
        setSettings({
          id: data.id,
          userId: data.user_id,
          remindersEnabled: data.reminders_enabled,
          remindDayBefore: data.remind_day_before,
          remindDayOf: data.remind_day_of,
          remindHoursBefore: data.remind_hours_before,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reminder settings';
      setError(errorMessage);
      console.error('Error updating reminder settings:', err);
      return { success: false, error: errorMessage };
    } finally {
      setUpdating(false);
    }
  }, [user?.id, settings]);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updating,
    updateSettings,
    refetch: fetchSettings,
  };
}
