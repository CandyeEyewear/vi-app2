import React from 'react';
import { Text } from 'react-native';

export function normalizeViewChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      if (child.trim().length === 0) return null;
      return <Text key={`text-child-${index}`}>{child}</Text>;
    }

    if (typeof child === 'number') {
      return <Text key={`number-child-${index}`}>{child}</Text>;
    }

    return child;
  });
}

