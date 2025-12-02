/**
 * Cross-Platform DateTimePicker Component
 * Works on iOS, Android, and Web
 */

import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';

interface CrossPlatformDateTimePickerProps {
  mode: 'date' | 'time';
  value: Date;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  label?: string;
  placeholder?: string;
  colors: {
    card: string;
    border: string;
    text: string;
    textSecondary: string;
  };
  error?: string;
  disabled?: boolean;
}

export default function CrossPlatformDateTimePicker({
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  label,
  placeholder = 'Select',
  colors,
  error,
  disabled = false,
}: CrossPlatformDateTimePickerProps) {
  const [showPicker, setShowPicker] = React.useState(false);

  // Format date/time for display
  const formatValue = () => {
    if (!value) return placeholder;
    
    if (mode === 'date') {
      return value.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } else {
      const hours = value.getHours().toString().padStart(2, '0');
      const minutes = value.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  };

  // Format date for HTML input (YYYY-MM-DD)
  const dateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format time for HTML input (HH:MM)
  const timeToString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Web implementation using native HTML5 inputs
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
        <View style={[
          styles.inputContainer,
          { backgroundColor: colors.card, borderColor: error ? '#E53935' : colors.border }
        ]}>
          {mode === 'date' ? (
            <Calendar size={20} color={colors.textSecondary} />
          ) : (
            <Clock size={20} color={colors.textSecondary} />
          )}
          <input
            type={mode}
            value={value ? (mode === 'date' ? dateToString(value) : timeToString(value)) : ''}
            onChange={(e) => {
              if (e.target.value) {
                if (mode === 'date') {
                  onChange(new Date(e.target.value));
                } else {
                  // For time, combine with current date
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  const newDate = new Date(value || new Date());
                  newDate.setHours(hours, minutes, 0, 0);
                  onChange(newDate);
                }
              } else {
                onChange(null);
              }
            }}
            min={minimumDate ? (mode === 'date' ? dateToString(minimumDate) : undefined) : undefined}
            max={maximumDate ? (mode === 'date' ? dateToString(maximumDate) : undefined) : undefined}
            disabled={disabled}
            style={{
              flex: 1,
              fontSize: 16,
              paddingVertical: 14,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: colors.text,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
        </View>
        {error && <Text style={[styles.error, { color: '#E53935' }]}>{error}</Text>}
      </View>
    );
  }

  // Mobile implementation (iOS/Android)
  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.inputContainer,
          { backgroundColor: colors.card, borderColor: error ? '#E53935' : colors.border }
        ]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
      >
        {mode === 'date' ? (
          <Calendar size={20} color={colors.textSecondary} />
        ) : (
          <Clock size={20} color={colors.textSecondary} />
        )}
        <Text style={[styles.inputText, { color: colors.text }]}>
          {formatValue()}
        </Text>
      </TouchableOpacity>
      
      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedValue) => {
            // Close picker on Android immediately
            if (Platform.OS === 'android') {
              setShowPicker(false);
            }
            
            if (selectedValue) {
              onChange(selectedValue);
              // Auto-close on iOS after selection (better UX)
              if (Platform.OS === 'ios') {
                setShowPicker(false);
              }
            }
          }}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          is24Hour={true}
        />
      )}
      
      {error && <Text style={[styles.error, { color: '#E53935' }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  error: {
    fontSize: 13,
    marginTop: 6,
  },
});
