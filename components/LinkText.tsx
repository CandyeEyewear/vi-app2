/**
 * LinkText Component
 * Renders text with clickable links
 * Automatically detects URLs and makes them tappable
 */

import React from 'react';
import { Text, StyleSheet, Linking, type TextProps } from 'react-native';
import { Colors } from '../constants/colors';

interface LinkTextProps {
  text: string | undefined | null;
  style?: any;
  linkStyle?: any;
  numberOfLines?: number;
  selectable?: boolean;
  onLongPress?: TextProps['onLongPress'];
}

// URL regex pattern - matches http, https, www, and common domains
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;

const splitTrailingPunctuation = (raw: string): { linkText: string; trailingText: string } => {
  // Common case: sentence punctuation is attached to the URL.
  // Keep punctuation in the message, but exclude it from the actual link target.
  const match = raw.match(/^(.+?)([),.!?;:]+)$/);
  if (!match) return { linkText: raw, trailingText: '' };
  return { linkText: match[1], trailingText: match[2] };
};

const normalizeUrl = (rawUrl: string): string => {
  // Add https:// if it starts with www. or doesn't have a protocol
  if (rawUrl.startsWith('www.')) return `https://${rawUrl}`;
  if (!rawUrl.match(/^https?:\/\//i)) return `https://${rawUrl}`;
  return rawUrl;
};

export default function LinkText({
  text,
  style,
  linkStyle,
  numberOfLines,
  selectable = false,
  onLongPress,
}: LinkTextProps) {
  // Handle undefined/null/empty text
  if (!text || typeof text !== 'string') {
    return (
      <Text style={style} numberOfLines={numberOfLines} selectable={selectable} onLongPress={onLongPress}>
        {''}
      </Text>
    );
  }

  const parts: Array<{ text: string; isLink: boolean; url?: string }> = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  // Find all URLs in the text
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isLink: false,
      });
    }

    const { linkText, trailingText } = splitTrailingPunctuation(match[0]);
    const url = normalizeUrl(linkText);

    parts.push({
      text: linkText,
      isLink: true,
      url: url,
    });

    // Preserve punctuation after the URL as normal text
    if (trailingText) {
      parts.push({
        text: trailingText,
        isLink: false,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isLink: false,
    });
  }

  // If no URLs found, return plain text
  if (parts.length === 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines} selectable={selectable} onLongPress={onLongPress}>
        {text}
      </Text>
    );
  }

  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.warn('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <Text style={style} numberOfLines={numberOfLines} selectable={selectable} onLongPress={onLongPress}>
      {parts.map((part, index) => {
        if (part.isLink && part.url) {
          return (
            <Text
              key={index}
              style={[styles.link, linkStyle]}
              onPress={(e: any) => {
                // Prevent parent press handlers (e.g., message long-press wrappers)
                // from interfering with link taps.
                e?.stopPropagation?.();
                handleLinkPress(part.url!);
              }}
              suppressHighlighting={false}
              selectable={selectable}
            >
              {part.text}
            </Text>
          );
        }
        return (
          <Text key={index} selectable={selectable}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
});

