/**
 * VIbe Color Palette
 * Based on volunteersinc.org and VIbe logo
 */

const tintColorLight = '#2196F3'; // VIbe primary blue
const tintColorDark = '#64B5F6';  // Lighter blue for dark mode

export const Colors = {
  light: {
    // Primary colors from VIbe logo
    primary: '#2196F3',      // Bright blue
    secondary: '#9E9E9E',    // Gray
    success: '#4CAF50',
    
    // Backgrounds
    background: '#FFFFFF',
    card: '#F5F5F5',
    
    // Text
    text: '#212121',
    textSecondary: '#757575',
    
    // UI Elements
    tint: tintColorLight,
    tabIconDefault: '#9E9E9E',
    tabIconSelected: tintColorLight,
    border: '#E0E0E0',
    
    // Status colors
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    
    // Opportunity categories
    environment: '#4CAF50',
    education: '#2196F3',
    healthcare: '#F44336',
    poorRelief: '#FF9800',
    community: '#9C27B0',
  },
  dark: {
    // Primary colors adjusted for dark mode
    primary: '#64B5F6',
    secondary: '#BDBDBD',
    
    // Backgrounds
    background: '#121212',
    card: '#1E1E1E',
    
    // Text
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    
    // UI Elements
    tint: tintColorDark,
    tabIconDefault: '#BDBDBD',
    tabIconSelected: tintColorDark,
    border: '#2C2C2C',
    
    // Status colors
    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    info: '#64B5F6',
    
    // Opportunity categories
    environment: '#66BB6A',
    education: '#64B5F6',
    healthcare: '#EF5350',
    poorRelief: '#FFA726',
    community: '#BA68C8',
  },
};

export type ColorScheme = keyof typeof Colors;
