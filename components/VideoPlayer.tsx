/**
 * Video Player Component
 * Displays videos in feed with play/pause controls
 */

import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react-native';

interface VideoPlayerProps {
  uri: string;
  thumbnailUri?: string;
  style?: any;
}

export default function VideoPlayer({ uri, thumbnailUri, style }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing video:', error);
    }
  };

  const handleMuteToggle = async () => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  if (hasError) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>Unable to load video</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        isMuted={isMuted}
        onLoad={() => setIsLoading(false)}
        onError={(error) => {
          console.error('Video error:', error);
          setHasError(true);
          setIsLoading(false);
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
          }
        }}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Play/Pause Button */}
      {!isLoading && (
        <>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            activeOpacity={0.8}
          >
            {isPlaying ? (
              <Pause size={48} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={48} color="#FFFFFF" fill="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Mute Button */}
          <TouchableOpacity
            style={styles.muteButton}
            onPress={handleMuteToggle}
            activeOpacity={0.8}
          >
            {isMuted ? (
              <VolumeX size={24} color="#FFFFFF" />
            ) : (
              <Volume2 size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
