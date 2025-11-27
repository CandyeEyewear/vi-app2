import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';

interface AvatarWithBadgeProps {
  uri: string | null;
  name: string;
  size?: number;
  role: string;
  membershipTier: string;
  membershipStatus?: string;
  style?: ViewStyle;
}

export const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
  uri,
  name,
  size = 40,
  role,
  membershipTier,
  membershipStatus = 'inactive',
  style,
}) => {
  // Determine border color based on user type
  const isAdmin = role === 'admin';
  const isPremium = membershipTier === 'premium' && membershipStatus === 'active';
  
  let borderColor: string | undefined;
  
  if (isAdmin) {
    borderColor = '#000000';
  } else if (isPremium) {
    borderColor = '#38B6FF';
  }

  const borderWidth = borderColor ? 2.5 : 0;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <View
        style={[
          styles.avatarContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={[
              styles.avatar,
              {
                width: size - (borderWidth * 2),
                height: size - (borderWidth * 2),
                borderRadius: (size - (borderWidth * 2)) / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              {
                width: size - (borderWidth * 2),
                height: size - (borderWidth * 2),
                borderRadius: (size - (borderWidth * 2)) / 2,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { fontSize: size * 0.4 },
              ]}
            >
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});