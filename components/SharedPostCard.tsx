/**
 * Shared Post Card Component
 * Displays the original post in a card when someone shares it (Facebook-style)
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { Post } from '../types';
import { Colors } from '../constants/colors';
import LinkText from './LinkText';

const { width } = Dimensions.get('window');

interface SharedPostCardProps {
  originalPost: Post;
}

export default function SharedPostCard({ originalPost }: SharedPostCardProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {/* Original Author Header */}
      <View style={styles.header}>
        {originalPost.user.avatarUrl ? (
          <Image source={{ uri: originalPost.user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {originalPost.user.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{originalPost.user.fullName}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(originalPost.createdAt)}</Text>
        </View>
      </View>

      {/* Original Post Content */}
      <LinkText text={originalPost.text} style={styles.text} />

      {/* Original Post Media */}
      {originalPost.mediaUrls && originalPost.mediaUrls.length > 0 && (
        <FlatList
          data={originalPost.mediaUrls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `media-${index}`}
          renderItem={({ item: url }) => (
            <Image
              source={{ uri: url }}
              style={styles.media}
              resizeMode="cover"
            />
          )}
        />
      )}

      {/* Original Post Stats */}
      <View style={styles.stats}>
        <Text style={styles.statText}>
          {originalPost.likes.length} {originalPost.likes.length === 1 ? 'like' : 'likes'}
        </Text>
        <Text style={styles.statText}>
          {originalPost.comments.length} {originalPost.comments.length === 1 ? 'comment' : 'comments'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
    marginBottom: 8,
  },
  media: {
    width: width - 64, // Account for padding and card margins
    height: 200,
    borderRadius: 8,
    backgroundColor: Colors.light.card,
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  statText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginRight: 12,
  },
});
