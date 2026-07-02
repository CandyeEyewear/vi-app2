/**
 * ZoomableImageViewer
 * Full-screen image viewer with pinch-to-zoom, pan, and double-tap reset.
 * Built on react-native-gesture-handler + RN Animated (no reanimated dependency).
 *
 * Interaction model (matches Photos/Instagram):
 *  - scale == 1: pan disabled, horizontal paging enabled (swipe between images).
 *  - zoomed:     pan enabled, paging disabled (pinch/double-tap back to 1 to swipe).
 * This gating avoids gesture contention between pan and the pager.
 *
 * State is fully reset on every open via `sessionKey`, so reopening at a
 * different index (and zoom state) is always clean.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Modal,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
} from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
  type PinchGestureHandlerStateChangeEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SCALE = 4;

interface ZoomableImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

/** A single zoomable page. Reports its zoom state up so the pager can disable swiping. */
function ZoomablePage({
  uri,
  onZoomChange,
}: {
  uri: string;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const [zoomed, setZoomed] = useState(false);

  // Pinch scale = baseScale (settled) * pinchScale (live gesture)
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const lastScale = useRef(1);

  // Pan translation (only enabled while zoomed)
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastPan = useRef({ x: 0, y: 0 });

  const pinchRef = useRef(null);
  const panRef = useRef(null);

  const setZoomState = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  /** Single shared reset path. Clears BOTH the animated values and their offsets. */
  const resetTo = (next: number) => {
    lastScale.current = next;
    lastPan.current = { x: 0, y: 0 };
    // Critical: clear accumulated pan offsets, not just the values.
    panX.setOffset(0);
    panY.setOffset(0);
    pinchScale.setValue(1);
    Animated.parallel([
      Animated.spring(baseScale, { toValue: next, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(panX, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
    ]).start();
    setZoomState(next > 1);
  };

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const onPinchStateChange = (e: PinchGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      let next = lastScale.current * e.nativeEvent.scale;
      next = Math.min(Math.max(next, 1), MAX_SCALE);
      if (next <= 1) {
        resetTo(1);
      } else {
        lastScale.current = next;
        baseScale.setValue(next);
        pinchScale.setValue(1);
        setZoomState(true);
      }
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      lastPan.current = {
        x: lastPan.current.x + e.nativeEvent.translationX,
        y: lastPan.current.y + e.nativeEvent.translationY,
      };
      panX.setOffset(lastPan.current.x);
      panX.setValue(0);
      panY.setOffset(lastPan.current.y);
      panY.setValue(0);
    }
  };

  const onDoubleTap = (e: { nativeEvent: { state: number } }) => {
    if (e.nativeEvent.state === State.ACTIVE) {
      resetTo(lastScale.current > 1 ? 1 : 2);
    }
  };

  return (
    <TapGestureHandler numberOfTaps={2} onHandlerStateChange={onDoubleTap}>
      <Animated.View style={styles.page}>
        <PanGestureHandler
          ref={panRef}
          enabled={zoomed}
          minPointers={1}
          maxPointers={1}
          avgTouches
          simultaneousHandlers={pinchRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
        >
          <Animated.View style={styles.page}>
            <PinchGestureHandler
              ref={pinchRef}
              simultaneousHandlers={panRef}
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <Animated.View style={styles.page}>
                <Animated.Image
                  source={{ uri }}
                  resizeMode="contain"
                  style={[
                    styles.image,
                    { transform: [{ translateX: panX }, { translateY: panY }, { scale }] },
                  ]}
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
}

export default function ZoomableImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ZoomableImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [anyZoomed, setAnyZoomed] = useState(false);
  // Bumped on each open to force a fresh remount (resets all per-page zoom state).
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setAnyZoomed(false);
      setSessionKey((k) => k + 1);
    }
  }, [visible, initialIndex]);

  if (!images || images.length === 0) return null;

  const safeInitial = Math.min(Math.max(initialIndex, 0), images.length - 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
          <X size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <FlatList
          key={sessionKey}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!anyZoomed && images.length > 1}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitial}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
          keyExtractor={(item, i) => `${item}-${i}`}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
          }
          renderItem={({ item }) => (
            <ZoomablePage uri={item} onZoomChange={setAnyZoomed} />
          )}
        />

        {images.length > 1 && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorText}>
              {index + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.97)' },
  close: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  indicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  indicatorText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
