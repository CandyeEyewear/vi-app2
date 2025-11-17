/**
 * Video Player Component
 * Displays videos in feed with play/pause controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react-native';

interface VideoPlayerProps {
  uri: string;
  thumbnailUri?: string;
  style?: any;
}

export default function VideoPlayer({ uri, thumbnailUri, style }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = true;
  });

  useEffect(() => {
    console.log('[VIDEO] Setting up player listeners for URI:', uri);
    
    // Set up listeners for player state changes
    const playingSub = player.addListener('playingChange', (playing: boolean) => {
      console.log('[VIDEO] Playing changed:', playing);
      setIsPlaying(playing);
      if (playing) {
        setIsLoading(false);
        setIsReady(true);
      }
    });

    // Try to listen for status changes (may not be available in all versions)
    let statusSub: any = null;
    try {
      statusSub = player.addListener('statusChange', (status: any) => {
        console.log('[VIDEO] Status changed:', status);
        if (status?.status === 'readyToPlay' || status === 'readyToPlay') {
          setIsReady(true);
          setIsLoading(false);
        } else if (status?.status === 'error' || status === 'error') {
          console.error('[VIDEO] Player error:', status);
          setHasError(true);
          setIsLoading(false);
        }
      });
    } catch (e) {
      console.log('[VIDEO] statusChange listener not available');
    }

    // Check if player is already ready
    try {
      if (player.currentTime !== undefined) {
        console.log('[VIDEO] Player appears ready');
        setIsReady(true);
        setIsLoading(false);
      }
    } catch (e) {
      // Ignore
    }

    // Fallback: Clear loading after a timeout if no events fire
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[VIDEO] Loading timeout, showing controls anyway');
      setIsLoading(false);
      setIsReady(true);
    }, 2000);

    return () => {
      playingSub.remove();
      if (statusSub) {
        statusSub.remove();
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [player, uri]);

  // Auto-play when ready (optional - remove if you want manual play)
  useEffect(() => {
    if (isReady && !isPlaying && !hasError) {
      // Don't auto-play, let user click play button
      // player.play();
    }
  }, [isReady, isPlaying, hasError, player]);

  const handlePlayPause = () => {
    try {
      if (!isReady) {
        console.log('[VIDEO] Player not ready yet');
        return;
      }

      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[VIDEO] Error toggling play/pause:', error);
      setHasError(true);
    }
  };

  const handleMuteToggle = () => {
    try {
      const newMutedState = !isMuted;
      player.muted = newMutedState;
      setIsMuted(newMutedState);
    } catch (error) {
      console.error('[VIDEO] Error toggling mute:', error);
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
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Controls Overlay - Always visible when ready, or after timeout */}
      {(isReady || !isLoading) && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            activeOpacity={0.8}
            disabled={!isReady && isLoading}
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
            disabled={!isReady && isLoading}
          >
            {isMuted ? (
              <VolumeX size={24} color="#FFFFFF" />
            ) : (
              <Volume2 size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
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
    zIndex: 1,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
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
