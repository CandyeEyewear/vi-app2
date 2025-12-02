/**
 * VIbe Color Palette
 * Modern, comprehensive design system for Volunteers Incorporated
 * 
 * Design Principles:
 * - Accessible contrast ratios (WCAG AA compliant)
 * - Multi-level surface elevation for depth
 * - Comprehensive interactive states
 * - Soft category backgrounds for badges/tags
 * - Consistent shadow system
 */

// ============================================================================
// BRAND COLORS
// ============================================================================
const brand = {
  // Primary - Distinctive blue (shifted from stock Material blue)
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  primarySoft: '#DBEAFE',
  primaryMuted: '#93C5FD',

  // Accent - Energetic coral/orange for CTAs and highlights
  accent: '#F97316',
  accentDark: '#EA580C',
  accentLight: '#FB923C',
  accentSoft: '#FFEDD5',
};

// ============================================================================
// SEMANTIC COLORS
// ============================================================================
const semantic = {
  success: {
    base: '#22C55E',
    dark: '#16A34A',
    light: '#4ADE80',
    soft: '#DCFCE7',
    text: '#166534',
  },
  warning: {
    base: '#F59E0B',
    dark: '#D97706',
    light: '#FBBF24',
    soft: '#FEF3C7',
    text: '#92400E',
  },
  error: {
    base: '#EF4444',
    dark: '#DC2626',
    light: '#F87171',
    soft: '#FEE2E2',
    text: '#991B1B',
  },
  info: {
    base: '#3B82F6',
    dark: '#2563EB',
    light: '#60A5FA',
    soft: '#DBEAFE',
    text: '#1E40AF',
  },
};

// ============================================================================
// OPPORTUNITY CATEGORY COLORS
// ============================================================================
const categories = {
  environment: {
    base: '#22C55E',
    soft: '#DCFCE7',
    text: '#166534',
    icon: '#16A34A',
  },
  education: {
    base: '#3B82F6',
    soft: '#DBEAFE',
    text: '#1E40AF',
    icon: '#2563EB',
  },
  healthcare: {
    base: '#EF4444',
    soft: '#FEE2E2',
    text: '#991B1B',
    icon: '#DC2626',
  },
  poorRelief: {
    base: '#F59E0B',
    soft: '#FEF3C7',
    text: '#92400E',
    icon: '#D97706',
  },
  community: {
    base: '#A855F7',
    soft: '#F3E8FF',
    text: '#6B21A8',
    icon: '#9333EA',
  },
  elderly: {
    base: '#EC4899',
    soft: '#FCE7F3',
    text: '#9D174D',
    icon: '#DB2777',
  },
  youth: {
    base: '#06B6D4',
    soft: '#CFFAFE',
    text: '#0E7490',
    icon: '#0891B2',
  },
  disaster: {
    base: '#F97316',
    soft: '#FFEDD5',
    text: '#9A3412',
    icon: '#EA580C',
  },
};

// ============================================================================
// MAIN EXPORT
// ============================================================================
export const Colors = {
  // -------------------------------------------------------------------------
  // LIGHT MODE
  // -------------------------------------------------------------------------
  light: {
    // Brand
    primary: brand.primary,
    primaryDark: brand.primaryDark,
    primaryLight: brand.primaryLight,
    primarySoft: brand.primarySoft,
    primaryMuted: brand.primaryMuted,
    
    accent: brand.accent,
    accentDark: brand.accentDark,
    accentLight: brand.accentLight,
    accentSoft: brand.accentSoft,

    // Surfaces (elevation system)
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F8FAFC',
    surface2: '#F1F5F9',
    surface3: '#E2E8F0',
    surfacePressed: '#E5E7EB',
    surfaceDisabled: '#F3F4F6',
    
    // Cards
    card: '#FFFFFF',
    cardHover: '#FAFAFA',
    cardPressed: '#F5F5F5',
    cardBorder: '#E5E7EB',

    // Text hierarchy
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textDisabled: '#D1D5DB',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textLink: brand.primary,

    // Borders
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderFocus: brand.primary,
    borderError: semantic.error.base,
    divider: '#F3F4F6',

    // Interactive states
    primaryPressed: brand.primaryDark,
    primaryDisabled: brand.primaryMuted,
    ripple: 'rgba(59, 130, 246, 0.12)',
    highlight: 'rgba(59, 130, 246, 0.08)',
    
    // Input fields
    inputBackground: '#F9FAFB',
    inputBackgroundFocus: '#FFFFFF',
    inputBorder: '#D1D5DB',
    inputBorderFocus: brand.primary,
    inputBorderError: semantic.error.base,
    inputPlaceholder: '#9CA3AF',
    inputText: '#111827',

    // Overlays & Backdrops
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    overlayHeavy: 'rgba(0, 0, 0, 0.7)',
    scrim: 'rgba(17, 24, 39, 0.6)',
    backdrop: 'rgba(0, 0, 0, 0.4)',
    
    // Shadows (use with shadow properties)
    shadow: 'rgba(0, 0, 0, 0.05)',
    shadowMedium: 'rgba(0, 0, 0, 0.1)',
    shadowHeavy: 'rgba(0, 0, 0, 0.15)',
    shadowColored: 'rgba(59, 130, 246, 0.25)',

    // Skeleton loading
    skeleton: '#E5E7EB',
    skeletonHighlight: '#F3F4F6',

    // Navigation
    tint: brand.primary,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: brand.primary,
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
    headerBackground: '#FFFFFF',
    headerText: '#111827',

    // Status colors (flat access)
    success: semantic.success.base,
    successDark: semantic.success.dark,
    successLight: semantic.success.light,
    successSoft: semantic.success.soft,
    successText: semantic.success.text,

    warning: semantic.warning.base,
    warningDark: semantic.warning.dark,
    warningLight: semantic.warning.light,
    warningSoft: semantic.warning.soft,
    warningText: semantic.warning.text,

    error: semantic.error.base,
    errorDark: semantic.error.dark,
    errorLight: semantic.error.light,
    errorSoft: semantic.error.soft,
    errorText: semantic.error.text,

    info: semantic.info.base,
    infoDark: semantic.info.dark,
    infoLight: semantic.info.light,
    infoSoft: semantic.info.soft,
    infoText: semantic.info.text,

    // Category colors (flat access for backward compatibility)
    environment: categories.environment.base,
    environmentSoft: categories.environment.soft,
    environmentText: categories.environment.text,
    
    education: categories.education.base,
    educationSoft: categories.education.soft,
    educationText: categories.education.text,
    
    healthcare: categories.healthcare.base,
    healthcareSoft: categories.healthcare.soft,
    healthcareText: categories.healthcare.text,
    
    poorRelief: categories.poorRelief.base,
    poorReliefSoft: categories.poorRelief.soft,
    poorReliefText: categories.poorRelief.text,
    
    community: categories.community.base,
    communitySoft: categories.community.soft,
    communityText: categories.community.text,

    elderly: categories.elderly.base,
    elderlySoft: categories.elderly.soft,
    elderlyText: categories.elderly.text,

    youth: categories.youth.base,
    youthSoft: categories.youth.soft,
    youthText: categories.youth.text,

    disaster: categories.disaster.base,
    disasterSoft: categories.disaster.soft,
    disasterText: categories.disaster.text,

    // Badges & Tags
    badgeBackground: brand.primarySoft,
    badgeText: brand.primaryDark,
    badgeSuccess: semantic.success.soft,
    badgeWarning: semantic.warning.soft,
    badgeError: semantic.error.soft,

    // Special elements
    avatar: '#E5E7EB',
    avatarText: '#6B7280',
    online: '#22C55E',
    offline: '#9CA3AF',
    verified: '#3B82F6',
    star: '#FBBF24',
    heart: '#EF4444',
  },

  // -------------------------------------------------------------------------
  // DARK MODE
  // -------------------------------------------------------------------------
  dark: {
    // Brand (adjusted for dark backgrounds)
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primaryLight: '#93C5FD',
    primarySoft: 'rgba(59, 130, 246, 0.2)',
    primaryMuted: 'rgba(59, 130, 246, 0.4)',
    
    accent: '#FB923C',
    accentDark: '#F97316',
    accentLight: '#FDBA74',
    accentSoft: 'rgba(249, 115, 22, 0.2)',

    // Surfaces (Material 3 dark elevation)
    background: '#0F172A',
    surface: '#1E293B',
    surfaceElevated: '#334155',
    surface2: '#475569',
    surface3: '#64748B',
    surfacePressed: '#475569',
    surfaceDisabled: '#1E293B',
    
    // Cards
    card: '#1E293B',
    cardHover: '#334155',
    cardPressed: '#475569',
    cardBorder: '#334155',

    // Text hierarchy
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    textDisabled: '#64748B',
    textInverse: '#0F172A',
    textOnPrimary: '#0F172A',
    textLink: '#60A5FA',

    // Borders
    border: '#334155',
    borderLight: '#1E293B',
    borderFocus: '#60A5FA',
    borderError: '#F87171',
    divider: '#334155',

    // Interactive states
    primaryPressed: '#3B82F6',
    primaryDisabled: 'rgba(96, 165, 250, 0.4)',
    ripple: 'rgba(96, 165, 250, 0.2)',
    highlight: 'rgba(96, 165, 250, 0.15)',
    
    // Input fields
    inputBackground: '#1E293B',
    inputBackgroundFocus: '#334155',
    inputBorder: '#475569',
    inputBorderFocus: '#60A5FA',
    inputBorderError: '#F87171',
    inputPlaceholder: '#64748B',
    inputText: '#F8FAFC',

    // Overlays & Backdrops
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    overlayHeavy: 'rgba(0, 0, 0, 0.85)',
    scrim: 'rgba(0, 0, 0, 0.75)',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.4)',
    shadowHeavy: 'rgba(0, 0, 0, 0.5)',
    shadowColored: 'rgba(96, 165, 250, 0.3)',

    // Skeleton loading
    skeleton: '#334155',
    skeletonHighlight: '#475569',

    // Navigation
    tint: '#60A5FA',
    tabIconDefault: '#64748B',
    tabIconSelected: '#60A5FA',
    tabBarBackground: '#1E293B',
    tabBarBorder: '#334155',
    headerBackground: '#1E293B',
    headerText: '#F8FAFC',

    // Status colors (adjusted for dark mode)
    success: '#4ADE80',
    successDark: '#22C55E',
    successLight: '#86EFAC',
    successSoft: 'rgba(74, 222, 128, 0.2)',
    successText: '#86EFAC',

    warning: '#FBBF24',
    warningDark: '#F59E0B',
    warningLight: '#FCD34D',
    warningSoft: 'rgba(251, 191, 36, 0.2)',
    warningText: '#FCD34D',

    error: '#F87171',
    errorDark: '#EF4444',
    errorLight: '#FCA5A5',
    errorSoft: 'rgba(248, 113, 113, 0.2)',
    errorText: '#FCA5A5',

    info: '#60A5FA',
    infoDark: '#3B82F6',
    infoLight: '#93C5FD',
    infoSoft: 'rgba(96, 165, 250, 0.2)',
    infoText: '#93C5FD',

    // Category colors (dark mode adjusted)
    environment: '#4ADE80',
    environmentSoft: 'rgba(74, 222, 128, 0.2)',
    environmentText: '#86EFAC',
    
    education: '#60A5FA',
    educationSoft: 'rgba(96, 165, 250, 0.2)',
    educationText: '#93C5FD',
    
    healthcare: '#F87171',
    healthcareSoft: 'rgba(248, 113, 113, 0.2)',
    healthcareText: '#FCA5A5',
    
    poorRelief: '#FBBF24',
    poorReliefSoft: 'rgba(251, 191, 36, 0.2)',
    poorReliefText: '#FCD34D',
    
    community: '#C084FC',
    communitySoft: 'rgba(192, 132, 252, 0.2)',
    communityText: '#D8B4FE',

    elderly: '#F472B6',
    elderlySoft: 'rgba(244, 114, 182, 0.2)',
    elderlyText: '#FBCFE8',

    youth: '#22D3EE',
    youthSoft: 'rgba(34, 211, 238, 0.2)',
    youthText: '#67E8F9',

    disaster: '#FB923C',
    disasterSoft: 'rgba(251, 146, 60, 0.2)',
    disasterText: '#FDBA74',

    // Badges & Tags
    badgeBackground: 'rgba(96, 165, 250, 0.2)',
    badgeText: '#93C5FD',
    badgeSuccess: 'rgba(74, 222, 128, 0.2)',
    badgeWarning: 'rgba(251, 191, 36, 0.2)',
    badgeError: 'rgba(248, 113, 113, 0.2)',

    // Special elements
    avatar: '#334155',
    avatarText: '#94A3B8',
    online: '#4ADE80',
    offline: '#64748B',
    verified: '#60A5FA',
    star: '#FBBF24',
    heart: '#F87171',
  },

  // -------------------------------------------------------------------------
  // GRADIENTS (for LinearGradient components)
  // -------------------------------------------------------------------------
  gradients: {
    // Primary gradients
    primary: ['#3B82F6', '#2563EB'],
    primarySoft: ['#DBEAFE', '#BFDBFE'],
    primaryVibrant: ['#3B82F6', '#1D4ED8'],
    
    // Accent gradients
    accent: ['#F97316', '#EA580C'],
    accentSoft: ['#FFEDD5', '#FED7AA'],
    
    // Mood gradients
    sunrise: ['#F97316', '#FBBF24'],
    sunset: ['#F472B6', '#F97316'],
    ocean: ['#06B6D4', '#3B82F6'],
    forest: ['#22C55E', '#16A34A'],
    purple: ['#A855F7', '#7C3AED'],
    
    // Utility gradients
    cardLight: ['#FFFFFF', '#F8FAFC'],
    cardDark: ['#1E293B', '#0F172A'],
    shimmer: ['#E5E7EB', '#F3F4F6', '#E5E7EB'],
    shimmerDark: ['#334155', '#475569', '#334155'],
    
    // Hero/Header gradients
    heroLight: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)'],
    heroDark: ['rgba(15, 23, 42, 0)', 'rgba(15, 23, 42, 1)'],
    imageOverlay: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.6)'],
  },

  // -------------------------------------------------------------------------
  // CATEGORY OBJECTS (for advanced usage)
  // -------------------------------------------------------------------------
  categories,
  semantic,
  brand,
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type ColorScheme = 'light' | 'dark';
export type CategoryKey = keyof typeof categories;
export type SemanticKey = keyof typeof semantic;

// Helper type for accessing colors
export type ThemeColors = typeof Colors.light;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get category color set by name
 */
export const getCategoryColors = (category: string) => {
  const key = category.toLowerCase().replace(/\s+/g, '') as CategoryKey;
  return categories[key] || categories.community;
};

/**
 * Get semantic color set by status
 */
export const getSemanticColors = (status: SemanticKey) => {
  return semantic[status] || semantic.info;
};

/**
 * Apply opacity to a hex color
 */
export const withOpacity = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default Colors;    success: '#66BB6A',
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
