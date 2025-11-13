/**
 * ImageCollage Component
 * Facebook/Instagram-style image layouts with automatic grid arrangements
 * Supports 1-10+ images with full-screen viewer
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  Text,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_WIDTH = SCREEN_WIDTH;
const GAP = 2;

interface ImageCollageProps {
  images: string[];
  onImagePress?: (index: number) => void;
}

export default function ImageCollage({ images, onImagePress }: ImageCollageProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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
    const count = images.length;

    // Single image - full width
    if (count === 1) {
      return (
        <TouchableOpacity onPress={() => handleImagePress(0)} activeOpacity={0.9}>
          <Image
            source={{ uri: images[0] }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    // Two images - side by side
    if (count === 2) {
      return (
        <View style={styles.twoImageContainer}>
          <TouchableOpacity
            style={styles.twoImageLeft}
            onPress={() => handleImagePress(0)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[0] }}
              style={styles.twoImage}
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
              style={styles.twoImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      );
    }

    // Three images - one large, two small
    if (count === 3) {
      return (
        <View style={styles.threeImageContainer}>
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
        <View style={styles.fourImageContainer}>
          <TouchableOpacity
            style={styles.fourImageItem}
            onPress={() => handleImagePress(0)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[0] }}
              style={styles.fourImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fourImageItem}
            onPress={() => handleImagePress(1)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[1] }}
              style={styles.fourImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fourImageItem}
            onPress={() => handleImagePress(2)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[2] }}
              style={styles.fourImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fourImageItem}
            onPress={() => handleImagePress(3)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: images[3] }}
              style={styles.fourImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      );
    }

    // Five or more images - complex grid
    if (count >= 5) {
      const firstFour = images.slice(0, 4);
      const remaining = images.slice(4);

      return (
        <View style={styles.manyImageContainer}>
          {/* First 4 in 2x2 grid */}
          <View style={styles.manyImageGrid}>
            {firstFour.map((uri, index) => (
              <TouchableOpacity
                key={index}
                style={styles.manyImageItem}
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
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <View style={styles.container}>{renderLayout()}</View>

      {/* Full-screen image viewer */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerVisible(false)}
          >
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * SCREEN_WIDTH, y: 0 }}
          >
            {images.map((uri, index) => (
              <View key={index} style={styles.viewerImageContainer}>
                <Image
                  source={{ uri }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.viewerIndicator}>
            <Text style={styles.viewerIndicatorText}>
              {viewerIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: POST_WIDTH,
    marginBottom: 12,
  },
  // Single image
  singleImage: {
    width: POST_WIDTH,
    height: POST_WIDTH,
    backgroundColor: Colors.light.card,
  },
  // Two images
  twoImageContainer: {
    flexDirection: 'row',
    width: POST_WIDTH,
    height: POST_WIDTH * 0.5,
    gap: GAP,
  },
  twoImageLeft: {
    flex: 1,
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
    width: POST_WIDTH,
    height: POST_WIDTH * 0.6,
    gap: GAP,
  },
  threeImageLeft: {
    flex: 1,
  },
  threeImageLarge: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  threeImageRight: {
    flex: 1,
    gap: GAP,
  },
  threeImageTop: {
    flex: 1,
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
    width: POST_WIDTH,
    height: POST_WIDTH,
    gap: GAP,
  },
  fourImageItem: {
    width: (POST_WIDTH - GAP) / 2,
    height: (POST_WIDTH - GAP) / 2,
  },
  fourImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.card,
  },
  // Many images (5+)
  manyImageContainer: {
    width: POST_WIDTH,
    height: POST_WIDTH,
  },
  manyImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: POST_WIDTH,
    height: POST_WIDTH,
    gap: GAP,
  },
  manyImageItem: {
    width: (POST_WIDTH - GAP) / 2,
    height: (POST_WIDTH - GAP) / 2,
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
  // Viewer
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  viewerImageContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  viewerIndicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewerIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
