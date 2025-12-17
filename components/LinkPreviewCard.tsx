/**
 * LinkPreviewCard
 * Renders a rich-ish preview for YouTube/TikTok/Instagram links found in text.
 * Best-effort metadata fetching; always safe to render even if fetch fails.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Play } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import type { SocialPreview } from '../utils/socialLinkPreview';
import { fetchSocialPreview } from '../utils/socialLinkPreview';

export default function LinkPreviewCard({ preview }: { preview: SocialPreview }) {
  const [data, setData] = useState<SocialPreview>(preview);

  useEffect(() => {
    let alive = true;
    (async () => {
      const full = await fetchSocialPreview(preview);
      if (alive) setData(full);
    })();
    return () => {
      alive = false;
    };
  }, [preview.provider, preview.url]);

  const providerLabel =
    data.provider === 'youtube' ? 'YouTube' : data.provider === 'tiktok' ? 'TikTok' : 'Instagram';

  const open = async () => {
    try {
      await WebBrowser.openBrowserAsync(data.url);
    } catch {
      // ignore
    }
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={open}>
      {!!data.thumbnailUrl && (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: data.thumbnailUrl }} style={styles.thumb} />
          <View style={styles.playBadge}>
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.provider}>{providerLabel}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {data.title || data.url}
        </Text>
        {!!data.authorName && (
          <Text style={styles.author} numberOfLines={1}>
            {data.authorName}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  thumbWrap: {
    width: 110,
    height: 80,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18,
  },
  meta: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  provider: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  author: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});


