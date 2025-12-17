import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COUNTRIES, type Country } from '../constants/countries';

type ThemeColors = {
  background: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
};

type Props = {
  label: string;
  value: string;
  onChange: (country: Country) => void;
  disabled?: boolean;
  placeholder?: string;
  colors: ThemeColors;
};

export default function CountryPicker({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select a country',
  colors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <TouchableOpacity
        disabled={disabled}
        activeOpacity={0.7}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[
          styles.inputButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.inputText,
            { color: value ? colors.text : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Select country</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              style={[
                styles.searchInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[
                      styles.item,
                      { borderBottomColor: colors.border },
                      selected && { backgroundColor: colors.card },
                    ]}
                  >
                    <Text style={[styles.itemText, { color: colors.text }]}>{item}</Text>
                    {selected ? (
                      <Text style={[styles.check, { color: colors.primary }]}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    fontSize: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchInput: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: 0,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemText: {
    fontSize: 16,
    flex: 1,
  },
  check: {
    fontSize: 16,
    fontWeight: '800',
  },
});

