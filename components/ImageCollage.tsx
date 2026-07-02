/**
 * ImageCollage Component
 * Facebook/Instagram-style image layouts with automatic grid arrangements
 * Supports 1-10+ images with full-screen viewer
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { Colors } from '../constants/colors';
import ZoomableImageViewer from './ZoomableImageViewer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAP = 2;
// Cap a single image's inline height so a very tall flier doesn't swallow the feed.
const SINGLE_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;

interface ImageCollageProps {
  images: string[];
  onImagePress?: (index: number) => void;
}

export default function ImageCollage({ images, onImagePress }: ImageCollageProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  // Natural aspect ratio (width / height) of a lone image, so it renders uncropped.
  const [singleAspect, setSingleAspect] = useState<number | null>(null);

  // Measure the real dimensions of a single image so we can show it whole.
  // Keyed on the URI (not the array identity) so a parent re-creating the array
  // doesn't re-trigger getSize.
  const singleUri = images?.length === 1 ? images[0] : null;
  useEffect(() => {
    if (!singleUri) return;
    let active = true;
    setSingleAspect(null);
    Image.getSize(
      singleUri,
      (w, h) => {
        if (active && w > 0 && h > 0) setSingleAspect(w / h);
      },
      () => {
        if (active) setSingleAspect(1); // fallback to square on failure
      }
    );
    return () => {
      active = false;
    };
  }, [singleUri]);

  if (!images || images.length === 0) return null;

  const handleImagePress = (index: number) => {
    if (onImagePress) {
      onImagePress(index);
    } else {
      setViewerIndex(index);
      setViewerVisible(true);
    }
  };

  const renderLayout = () => {
    if (!containerWidth) return null;
    const count = images.length;
    const singleSize = containerWidth;
    const twoRowHeight = containerWidth * 0.5;
    const threeRowHeight = containerWidth * 0.6;
    const halfWidth = (containerWidth - GAP) / 2;

    // Single image - full width, shown whole at its natural aspect ratio (no crop).
    if (count === 1) {
      // Height derived from the real aspect ratio, capped so tall fliers stay readable.
      const height = singleAspect
        ? Math.min(singleSize / singleAspect, SINGLE_MAX_HEIGHT)
        : singleSize;
      return (
        <TouchableOpacity onPress={() => handleImagePress(0)} activeOpacity={0.9}>
          <Image
            source={{ uri: images[0] }}
            style={[styles.singleImage, { width: singleSize, height }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      );
    }

    // Two images - side by side
    if (count === 2) {
      return (
        <View style={[styles.twoImageContainer, { width: containerWidth, height: twoRowHeight }]}>
          <TouchableOpacity
            style={styles.twoImageLeft}
            onPress={() => handleImagePress(0)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[0] }}
              style={[styles.twoImage]}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.twoImageRight}
            onPress={() => handleImagePress(1)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[1] }}
              style={[styles.twoImage]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      );
    }

    // Three images - one large, two small
    if (count === 3) {
      return (
        <View style={[styles.threeImageContainer, { width: containerWidth, height: threeRowHeight }]}>
          <TouchableOpacity
            style={styles.threeImageLeft}
            onPress={() => handleImagePress(0)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[0] }}
              style={styles.threeImageLarge}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <View style={styles.threeImageRight}>
            <TouchableOpacity
              style={styles.threeImageTop}
              onPress={() => handleImagePress(1)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: images[1] }}
                style={styles.threeImageSmall}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.threeImageBottom}
              onPress={() => handleImagePress(2)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: images[2] }}
                style={styles.threeImageSmall}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Four images - 2x2 grid
    if (count === 4) {
      return (
        <View style={[styles.fourImageContainer, { width: containerWidth, height: containerWidth }]}>
          {images.map((uri, index) => {
            const isLeft = index % 2 === 0;
            const isTopRow = index < 2;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.fourImageItem,
                  { width: halfWidth, height: halfWidth },
                  isLeft && { marginRight: GAP },
                  !isTopRow && { marginTop: GAP },
                ]}
                onPress={() => handleImagePress(index)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri }}
                  style={styles.fourImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Five or more images - complex grid
    if (count >= 5) {
      const firstFour = images.slice(0, 4);
      const remaining = images.slice(4);

      return (
        <View style={[styles.manyImageContainer, { width: containerWidth, height: containerWidth }]}>
          {/* First 4 in 2x2 grid */}
          <View style={styles.manyImageGrid}>
            {firstFour.map((uri, index) => {
              const isLeft = index % 2 === 0;
              const isTopRow = index < 2;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.manyImageItem,
                    { width: halfWidth, height: halfWidth },
                    isLeft && { marginRight: GAP },
                    !isTopRow && { marginTop: GAP },
                  ]}
                  onPress={() => handleImagePress(index)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri }}
                    style={styles.manyImage}
                    resizeMode="cover"
                  />
                  {index === 3 && remaining.length > 0 && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{remaining.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <View
        style={styles.container}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {renderLayout()}
      </View>

      {/* Full-screen image viewer with pinch-to-zoom */}
      <ZoomableImageViewer
        visible={viewerVisible}
        images={images}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
  },
  // Single image
  singleImage: {
    backgroundColor: Colors.light.card,
  },
  // Two images
  twoImageContainer: {
    flexDirection: 'row',
  },
  twoImageLeft: {
    flex: 1,
    marginRight: GAP,
  },
  twoImageRight: {
    flex: 1,
  },
  twoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  // Three images
  threeImageContainer: {
    flexDirection: 'row',
  },
  threeImageLeft: {
    flex: 1,
    marginRight: GAP,
  },
  threeImageLarge: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  threeImageRight: {
    flex: 1,
  },
  threeImageTop: {
    flex: 1,
    marginBottom: GAP,
  },
  threeImageBottom: {
    flex: 1,
  },
  threeImageSmall: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  // Four images
  fourImageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fourImageItem: {
  },
  fourImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  // Many images (5+)
  manyImageContainer: {
  },
  manyImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  manyImageItem: {
    position: 'relative',
  },
  manyImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
