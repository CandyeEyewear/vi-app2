/**
 * MentionText Component
 * Renders text with @mentions and #hashtags as tappable links
 * - Tapping @mention navigates to user profile
 * - Tapping #hashtag navigates to event/cause/opportunity detail
 */

import React from 'react';
import { Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';

interface MentionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
}

type SegmentType = 'text' | 'mention' | 'hashtag';
type HashtagType = 'event' | 'cause' | 'opportunity';

interface TextSegment {
  type: SegmentType;
  content: string;
  userId?: string;
  hashtagType?: HashtagType;
  hashtagId?: string;
}

// Parse text into segments (plain text, mentions, and hashtags)
const parseText = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  
  // Combined regex for both mentions and hashtags
  const combinedPattern = /@\[([^\]]+)\]\(([^)]+)\)|#\[([^\]]+)\]\((event|cause|opportunity):([^)]+)\)/g;
  
  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1] !== undefined) {
      // It's a mention: @[Name](userId)
      segments.push({
        type: 'mention',
        content: `@${match[1]}`,
        userId: match[2],
      });
    } else {
      // It's a hashtag: #[Name](type:id)
      segments.push({
        type: 'hashtag',
        content: `#${match[3]}`,
        hashtagType: match[4] as HashtagType,
        hashtagId: match[5],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
};

// Get color for hashtag type
const getHashtagColor = (type: HashtagType): string => {
  switch (type) {
    case 'event': return '#4CAF50';
    case 'cause': return '#E91E63';
    case 'opportunity': return '#2196F3';
    default: return '#2196F3';
  }
};

// Get route for hashtag type
const getHashtagRoute = (type: HashtagType, id: string): string => {
  switch (type) {
    case 'event': return `/events/${id}`;
    case 'cause': return `/causes/${id}`;
    case 'opportunity': return `/opportunities/${id}`;
    default: return '/';
  }
};

export default function MentionText({ text, style, numberOfLines }: MentionTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const handleMentionPress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleHashtagPress = (type: HashtagType, id: string) => {
    router.push(getHashtagRoute(type, id) as any);
  };

  const segments = parseText(text);

  // If no mentions or hashtags, just render plain text
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
        
        if (segment.type === 'hashtag' && segment.hashtagType && segment.hashtagId) {
          return (
            <Text
              key={`hashtag-${index}`}
              style={[styles.hashtag, { color: getHashtagColor(segment.hashtagType) }]}
              onPress={() => handleHashtagPress(segment.hashtagType!, segment.hashtagId!)}
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
  hashtag: {
    fontWeight: '600',
  },
});
