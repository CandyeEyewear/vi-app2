/**
 * ImageCropperModal
 * Full-screen modal for manually cropping images with pan & pinch-to-zoom.
 * Shows a fixed aspect-ratio crop frame; user moves/scales the image behind it.
 * Starts at "fit" scale so the full image is visible. Scroll wheel works on web.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  PanGestureHandlerGestureEvent,
  PinchGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Crop, SkipForward, Maximize2, ZoomIn, ZoomOut } from 'lucide-react-native';

interface ImageCropperModalProps {
  visible: boolean;
  imageUri: string | null;
  aspectRatio?: number;
  onCrop: (croppedUri: string) => void;
  onSkip: (originalUri: string) => void;
  onCancel: () => void;
}

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.6)';
const CROP_BORDER_COLOR = 'rgba(255, 255, 255, 0.5)';
const HORIZONTAL_PADDING = 16;
const MAX_SCALE = 5;

export default function ImageCropperModal({
  visible,
  imageUri,
  aspectRatio = 16 / 9,
  onCrop,
  onSkip,
  onCancel,
}: ImageCropperModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Image natural dimensions
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Container layout
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Processing state
  const [cropping, setCropping] = useState(false);

  // Animated values
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // JS tracking refs for math
  const baseTranslateX = useRef(0);
  const baseTranslateY = useRef(0);
  const baseScale = useRef(1);
  const lastScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  // Gesture handler refs
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);

  // Web gesture container ref (for scroll wheel)
  const gestureContainerRef = useRef<any>(null);

  // Initialization guard — reset when modal closes
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!visible) hasInitialized.current = false;
  }, [visible]);

  // Crop frame dimensions
  const cropWidth = containerWidth - HORIZONTAL_PADDING * 2;
  const cropHeight = cropWidth / aspectRatio;
  const cropTop = (containerHeight - cropHeight) / 2;
  const cropLeft = HORIZONTAL_PADDING;

  // Display dimensions (image scaled to cover crop frame at scale=1)
  const imageAspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  let displayWidth: number;
  let displayHeight: number;

  if (imageAspect > aspectRatio) {
    // Image wider than crop: match height, extend width
    displayHeight = cropHeight;
    displayWidth = cropHeight * imageAspect;
  } else {
    // Image taller than crop: match width, extend height
    displayWidth = cropWidth;
    displayHeight = cropWidth / imageAspect;
  }

  // Minimum scale = scale at which the entire image fits within the crop frame
  const minScale =
    displayWidth > 0 && cropWidth > 0
      ? Math.min(cropWidth / displayWidth, cropHeight / displayHeight)
      : 1;

  // Keep derived values in refs so gesture callbacks can always read current values
  const minScaleRef = useRef(minScale);
  const displayWidthRef = useRef(displayWidth);
  const displayHeightRef = useRef(displayHeight);
  const cropWidthRef = useRef(cropWidth);
  const cropHeightRef = useRef(cropHeight);
  minScaleRef.current = minScale;
  displayWidthRef.current = displayWidth;
  displayHeightRef.current = displayHeight;
  cropWidthRef.current = cropWidth;
  cropHeightRef.current = cropHeight;

  // Clamping helpers
  const clampScale = useCallback((s: number) => {
    return Math.max(minScaleRef.current, Math.min(MAX_SCALE, s));
  }, []);

  const clampTranslate = useCallback((tx: number, ty: number, currentScale: number) => {
    const scaledW = displayWidthRef.current * currentScale;
    const scaledH = displayHeightRef.current * currentScale;
    const maxTx = Math.max(0, (scaledW - cropWidthRef.current) / 2);
    const maxTy = Math.max(0, (scaledH - cropHeightRef.current) / 2);
    return {
      x: Math.max(-maxTx, Math.min(maxTx, tx)),
      y: Math.max(-maxTy, Math.min(maxTy, ty)),
    };
  }, []);

  const applyScaleAndTranslate = useCallback(
    (newScale: number, newTx: number, newTy: number, commit = false) => {
      const clamped = clampTranslate(newTx, newTy, newScale);
      scaleAnim.setValue(newScale);
      translateX.setValue(clamped.x);
      translateY.setValue(clamped.y);
      lastScale.current = newScale;
      currentTranslateX.current = clamped.x;
      currentTranslateY.current = clamped.y;
      if (commit) {
        baseScale.current = newScale;
        baseTranslateX.current = clamped.x;
        baseTranslateY.current = clamped.y;
      }
    },
    [clampTranslate, scaleAnim, translateX, translateY]
  );

  // Load image dimensions
  useEffect(() => {
    if (visible && imageUri) {
      setImageLoaded(false);
      Image.getSize(
        imageUri,
        (w, h) => {
          setImageWidth(w);
          setImageHeight(h);
          setImageLoaded(true);
        },
        (err) => {
          console.error('Failed to get image size:', err);
          setImageWidth(1920);
          setImageHeight(1080);
          setImageLoaded(true);
        }
      );
    }
  }, [visible, imageUri]);

  const ready =
    imageLoaded && containerWidth > 0 && containerHeight > 0 && cropWidth > 0 && cropHeight > 0;

  // Initialize at fit-scale once ready
  useEffect(() => {
    if (ready && !hasInitialized.current) {
      hasInitialized.current = true;
      const initial = minScaleRef.current;
      translateX.setValue(0);
      translateY.setValue(0);
      scaleAnim.setValue(initial);
      baseTranslateX.current = 0;
      baseTranslateY.current = 0;
      baseScale.current = initial;
      lastScale.current = initial;
      currentTranslateX.current = 0;
      currentTranslateY.current = 0;
    }
  }, [ready, scaleAnim, translateX, translateY]);

  // Web: scroll-wheel zoom
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const el = gestureContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      const newScale = clampScale(lastScale.current * factor);
      applyScaleAndTranslate(newScale, currentTranslateX.current, currentTranslateY.current, true);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [visible, clampScale, applyScaleAndTranslate]);

  // Pan gesture handler
  const handlePanEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationX: tx, translationY: ty } = event.nativeEvent;
      const newX = baseTranslateX.current + tx;
      const newY = baseTranslateY.current + ty;
      const clamped = clampTranslate(newX, newY, lastScale.current);
      translateX.setValue(clamped.x);
      translateY.setValue(clamped.y);
      currentTranslateX.current = clamped.x;
      currentTranslateY.current = clamped.y;
    },
    [clampTranslate, translateX, translateY]
  );

  const handlePanStateChange = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      baseTranslateX.current = currentTranslateX.current;
      baseTranslateY.current = currentTranslateY.current;
    }
  }, []);

  // Pinch gesture handler
  const handlePinchEvent = useCallback(
    (event: PinchGestureHandlerGestureEvent) => {
      const { scale: gestureScale } = event.nativeEvent;
      const newScale = clampScale(baseScale.current * gestureScale);
      applyScaleAndTranslate(newScale, currentTranslateX.current, currentTranslateY.current);
    },
    [clampScale, applyScaleAndTranslate]
  );

  const handlePinchStateChange = useCallback(
    (event: PinchGestureHandlerGestureEvent) => {
      if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
        baseScale.current = lastScale.current;
        baseTranslateX.current = currentTranslateX.current;
        baseTranslateY.current = currentTranslateY.current;
      }
    },
    []
  );

  // Fit button — reset to show full image
  const handleFit = useCallback(() => {
    const s = minScaleRef.current;
    applyScaleAndTranslate(s, 0, 0, true);
  }, [applyScaleAndTranslate]);

  // Zoom buttons (for web / accessibility)
  const handleZoomIn = useCallback(() => {
    const newScale = clampScale(lastScale.current * 1.3);
    applyScaleAndTranslate(newScale, currentTranslateX.current, currentTranslateY.current, true);
  }, [clampScale, applyScaleAndTranslate]);

  const handleZoomOut = useCallback(() => {
    const newScale = clampScale(lastScale.current / 1.3);
    applyScaleAndTranslate(newScale, currentTranslateX.current, currentTranslateY.current, true);
  }, [clampScale, applyScaleAndTranslate]);

  // Perform crop
  const handleCrop = useCallback(async () => {
    if (!imageUri || !imageWidth || !imageHeight) return;

    setCropping(true);
    try {
      const currentScale = lastScale.current;
      const curTx = currentTranslateX.current;
      const curTy = currentTranslateY.current;

      // Ratio from display pixels to original image pixels
      const pixelRatioX = imageWidth / displayWidthRef.current;
      const pixelRatioY = imageHeight / displayHeightRef.current;

      // Top-left of crop frame in display coordinates relative to scaled image top-left
      const cropDisplayLeft = (displayWidthRef.current * currentScale - cropWidthRef.current) / 2 - curTx;
      const cropDisplayTop = (displayHeightRef.current * currentScale - cropHeightRef.current) / 2 - curTy;

      // Convert to original image pixel coordinates
      const originX = (cropDisplayLeft / currentScale) * pixelRatioX;
      const originY = (cropDisplayTop / currentScale) * pixelRatioY;
      const cropW = (cropWidthRef.current / currentScale) * pixelRatioX;
      const cropH = (cropHeightRef.current / currentScale) * pixelRatioY;

      // Clamp to image bounds
      const safeOriginX = Math.max(0, Math.round(originX));
      const safeOriginY = Math.max(0, Math.round(originY));
      const safeCropW = Math.min(Math.round(cropW), imageWidth - safeOriginX);
      const safeCropH = Math.min(Math.round(cropH), imageHeight - safeOriginY);

      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeCropW,
              height: safeCropH,
            },
          },
        ],
        { compress: 0.85, format: SaveFormat.JPEG }
      );

      onCrop(result.uri);
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setCropping(false);
    }
  }, [imageUri, imageWidth, imageHeight, onCrop]);

  const handleSkip = useCallback(() => {
    if (imageUri) onSkip(imageUri);
  }, [imageUri, onSkip]);

  const handleContainerLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerWidth(width);
    setContainerHeight(height);
  }, []);

  if (!visible || !imageUri) return null;

  // Image is centered on the crop frame
  const imageLeft = cropLeft + (cropWidth - displayWidth) / 2;
  const imageTop = cropTop + (cropHeight - displayHeight) / 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onCancel} disabled={cropping}>
            <X size={20} color="#FFFFFF" />
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Crop Image</Text>

          <TouchableOpacity style={styles.headerButton} onPress={handleSkip} disabled={cropping}>
            <SkipForward size={18} color="#FFFFFF" />
            <Text style={styles.headerButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Gesture area */}
        <View
          ref={gestureContainerRef}
          style={styles.gestureContainer}
          onLayout={handleContainerLayout}
        >
          {ready ? (
            <>
              {/* Image layer with gestures */}
              <PinchGestureHandler
                ref={pinchRef}
                simultaneousHandlers={panRef}
                onGestureEvent={handlePinchEvent}
                onHandlerStateChange={handlePinchStateChange}
              >
                <Animated.View style={StyleSheet.absoluteFill}>
                  <PanGestureHandler
                    ref={panRef}
                    simultaneousHandlers={pinchRef}
                    onGestureEvent={handlePanEvent}
                    onHandlerStateChange={handlePanStateChange}
                    minPointers={1}
                    maxPointers={2}
                  >
                    <Animated.View style={StyleSheet.absoluteFill}>
                      <Animated.Image
                        source={{ uri: imageUri }}
                        style={{
                          position: 'absolute',
                          left: imageLeft,
                          top: imageTop,
                          width: displayWidth,
                          height: displayHeight,
                          transform: [
                            { translateX: translateX },
                            { translateY: translateY },
                            { scale: scaleAnim },
                          ],
                        }}
                        resizeMode="cover"
                      />
                    </Animated.View>
                  </PanGestureHandler>
                </Animated.View>
              </PinchGestureHandler>

              {/* Overlay: top */}
              <View
                style={[styles.overlay, { top: 0, left: 0, right: 0, height: cropTop }]}
                pointerEvents="none"
              />
              {/* Overlay: bottom */}
              <View
                style={[styles.overlay, { top: cropTop + cropHeight, left: 0, right: 0, bottom: 0 }]}
                pointerEvents="none"
              />
              {/* Overlay: left */}
              <View
                style={[styles.overlay, { top: cropTop, left: 0, width: cropLeft, height: cropHeight }]}
                pointerEvents="none"
              />
              {/* Overlay: right */}
              <View
                style={[styles.overlay, { top: cropTop, right: 0, width: cropLeft, height: cropHeight }]}
                pointerEvents="none"
              />
              {/* Crop frame border */}
              <View
                style={[styles.cropFrame, { top: cropTop, left: cropLeft, width: cropWidth, height: cropHeight }]}
                pointerEvents="none"
              />
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            {Platform.OS === 'web'
              ? 'Drag to reposition · Scroll to zoom'
              : 'Drag to reposition · Pinch to zoom'}
          </Text>

          {/* Zoom controls row */}
          <View style={styles.zoomRow}>
            <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut} disabled={!ready || cropping}>
              <ZoomOut size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fitButton} onPress={handleFit} disabled={!ready || cropping}>
              <Maximize2 size={16} color="#FFFFFF" />
              <Text style={styles.fitButtonText}>Fit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn} disabled={!ready || cropping}>
              <ZoomIn size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.cropButton, cropping && styles.cropButtonDisabled]}
            onPress={handleCrop}
            disabled={cropping || !ready}
          >
            {cropping ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Crop size={20} color="#000000" />
                <Text style={styles.cropButtonText}>Crop</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  gestureContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: CROP_BORDER_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  footerHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  zoomButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 300,
  },
  cropButtonDisabled: {
    opacity: 0.5,
  },
  cropButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
