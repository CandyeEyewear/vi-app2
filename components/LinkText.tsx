/**
 * LinkText Component
 * Renders text with clickable links
 * Automatically detects URLs and makes them tappable
 */

import React from 'react';
import { Text, StyleSheet, Linking } from 'react-native';
import { Colors } from '../constants/colors';

interface LinkTextProps {
  text: string;
  style?: any;
  linkStyle?: any;
}

// URL regex pattern - matches http, https, www, and common domains
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;

export default function LinkText({ text, style, linkStyle }: LinkTextProps) {
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

    // Add the URL
    let url = match[0];
    // Add https:// if it starts with www. or doesn't have a protocol
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    } else if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    parts.push({
      text: match[0],
      isLink: true,
      url: url,
    });

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
    return <Text style={style}>{text}</Text>;
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
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.isLink && part.url) {
          return (
            <Text key={index}>
              <Text
                style={[styles.link, linkStyle]}
                onPress={() => handleLinkPress(part.url!)}
              >
                {part.text}
              </Text>
            </Text>
          );
        }
        return <Text key={index}>{part.text}</Text>;
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

