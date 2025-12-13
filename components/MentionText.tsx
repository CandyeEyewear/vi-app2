/**
 * MentionText Component
 * Renders text with @mentions, #hashtags, and URLs as tappable links
 * - Tapping @mention navigates to user profile
 * - Tapping #hashtag navigates to event/cause/opportunity detail
 * - Tapping a URL opens it in the browser
 */

import React from 'react';
import { Linking, Text, StyleSheet, useColorScheme } from 'react-native';
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
  url?: string;
}

type ExtendedSegmentType = SegmentType | 'link';
type ExtendedTextSegment = Omit<TextSegment, 'type'> & { type: ExtendedSegmentType };

// Match http(s), www, or bare domains like example.com/path
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;
const TRAILING_PUNCTUATION = /[)\].,!?;:]+$/;

const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Add https:// if it starts with www. or doesn't have a protocol
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  // Avoid mangling other schemes like mailto:
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const linkifyPlainText = (plain: string): ExtendedTextSegment[] => {
  const segments: ExtendedTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(plain)) !== null) {
    const matchStart = match.index;
    let raw = match[0];

    if (matchStart > lastIndex) {
      segments.push({ type: 'text', content: plain.slice(lastIndex, matchStart) });
    }

    // Strip trailing punctuation commonly attached in prose.
    let trailing = '';
    while (raw.length > 0 && TRAILING_PUNCTUATION.test(raw)) {
      const lastChar = raw.slice(-1);
      trailing = lastChar + trailing;
      raw = raw.slice(0, -1);
    }

    if (raw) {
      segments.push({
        type: 'link',
        content: raw,
        url: normalizeUrl(raw),
      });
    }
    if (trailing) {
      segments.push({ type: 'text', content: trailing });
    }

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < plain.length) {
    segments.push({ type: 'text', content: plain.slice(lastIndex) });
  }

  return segments;
};

// Parse text into segments (plain text, mentions, hashtags), then linkify remaining plain text
const parseText = (text: string): ExtendedTextSegment[] => {
  const segments: ExtendedTextSegment[] = [];

  // Combined regex for both mentions and hashtags
  const combinedPattern = /@\[([^\]]+)\]\(([^)]+)\)|#\[([^\]]+)\]\((event|cause|opportunity):([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedPattern.exec(text)) !== null) {
    // Add text before this match (linkified)
    if (match.index > lastIndex) {
      segments.push(...linkifyPlainText(text.slice(lastIndex, match.index)));
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

  // Add remaining text (linkified)
  if (lastIndex < text.length) {
    segments.push(...linkifyPlainText(text.slice(lastIndex)));
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
    case 'event': return `/event/${id}`;
    case 'cause': return `/cause/${id}`;
    case 'opportunity': return `/opportunity/${id}`;
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

  const handleLinkPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      // Swallow open failures (invalid URL or no handler)
    }
  };

  const segments = parseText(text);

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

        if (segment.type === 'link' && segment.url) {
          return (
            <Text
              key={`link-${index}`}
              style={[styles.link, { color: colors.primary }]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                handleLinkPress(segment.url!);
              }}
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
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
