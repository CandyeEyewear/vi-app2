import React, { useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Reply } from 'lucide-react-native';
import { Colors } from '../constants/colors';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  disabled?: boolean;
}

export default function SwipeableMessage({ 
  children, 
  onSwipeRight,
  disabled = false 
}: SwipeableMessageProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;

  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { 
      useNativeDriver: true,
      listener: (event: any) => {
        // Show reply icon when swiping right
        const translation = event.nativeEvent.translationX;
        if (translation > 0) {
          const opacity = Math.min(translation / 60, 1);
          replyIconOpacity.setValue(opacity);
        }
      }
    }
  );

  const handleStateChange = (event: any) => {
    if (disabled) return;
    
    const { state, translationX } = event.nativeEvent;
    
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      // If swiped more than 60px to the right, trigger reply
      if (state === State.END && translationX > 60) {
        onSwipeRight();
      }
      
      // Animate back to original position
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(replyIconOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  return (
    <View style={styles.container}>
      {/* Reply icon that appears on swipe */}
      <Animated.View 
        style={[
          styles.replyIcon,
          { opacity: replyIconOpacity }
        ]}
      >
        <Reply size={20} color={Colors.light.textSecondary} />
      </Animated.View>

      {/* Swipeable message */}
      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
        enabled={!disabled}
        activeOffsetX={10} // Start gesture after 10px horizontal movement
        failOffsetY={[-20, 20]} // Fail if vertical movement > 20px
      >
        <Animated.View
          style={[
            styles.messageWrapper,
            {
              transform: [
                {
                  translateX: translateX.interpolate({
                    inputRange: [0, 100],
                    outputRange: [0, 60], // Max swipe distance
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  replyIcon: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -10,
    zIndex: 1,
  },
  messageWrapper: {
    width: '100%',
  },
});

