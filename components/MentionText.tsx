/**
 * MentionText Component
 * Renders text with @mentions as tappable links
 * Tapping a mention navigates to that user's profile
 */

import React from 'react';
import { Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { parseTextWithMentions } from '../utils/mentions';

interface MentionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
}

export default function MentionText({ text, style, numberOfLines }: MentionTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const handleMentionPress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const segments = parseTextWithMentions(text);

  // If no mentions, just render plain text
  if (segments.length === 1 && segments[0].type === 'text') {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => {
        if (segment.type === 'mention' && segment.userId) {
          return (
            <Text
              key={`mention-${index}`}
              style={[styles.mention, { color: colors.primary }]}
              onPress={() => handleMentionPress(segment.userId!)}
            >
              {segment.content}
            </Text>
          );
        }
        return (
          <Text key={`text-${index}`}>
            {segment.content}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  mention: {
    fontWeight: '600',
  },
});
