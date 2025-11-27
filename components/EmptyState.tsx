import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  suggestions?: string[];
  colors: any;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtitle,
  action,
  suggestions,
  colors,
}) => {
  return (
    <View style={styles.container}>
      <Icon size={48} color={colors.textSecondary} style={styles.icon} />
      
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>

      {action && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      )}

      {suggestions && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={[styles.suggestionsTitle, { color: colors.textSecondary }]}>
            Try:
          </Text>
          {suggestions.map((suggestion, index) => (
            <Text
              key={index}
              style={[styles.suggestionItem, { color: colors.textSecondary }]}
            >
              {'\u2022'} {suggestion}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  suggestions: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionItem: {
    fontSize: 13,
    marginBottom: 6,
  },
});

