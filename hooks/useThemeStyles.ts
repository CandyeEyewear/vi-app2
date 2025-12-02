import { useMemo } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { Colors, ThemeColors } from '../constants/colors';

export type ResponsiveTokens = ReturnType<typeof buildResponsiveValues>;

const buildResponsiveValues = (width: number) => {
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    maxContentWidth: isDesktop ? 1200 : isTablet ? 900 : '100%',
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
      xxl: isSmallMobile ? 24 : 32,
    },
    fontSize: {
      xs: isSmallMobile ? 11 : 12,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      xxl: isSmallMobile ? 22 : 26,
      header: isSmallMobile ? 22 : isTablet ? 28 : 26,
    },
    buttonHeight: isSmallMobile ? 44 : 48,
    inputHeight: isSmallMobile ? 48 : 52,
    chipHeight: isSmallMobile ? 36 : 40,
    iconSize: { sm: 16, md: 20, lg: 24 },
  } as const;
};

const getCardShadowStyle = (colors: ThemeColors) =>
  Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
      shadowColor: colors.shadow,
    },
    default: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
    },
  });

export const useThemeStyles = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { width } = useWindowDimensions();

  const responsive = useMemo(() => buildResponsiveValues(width), [width]);
  const cardShadow = useMemo(() => getCardShadowStyle(colors), [colors]);

  const cardStyle = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: responsive.spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder || colors.border,
      ...cardShadow,
    }),
    [cardShadow, colors.border, colors.card, colors.cardBorder, responsive.spacing.md]
  );

  return {
    colorScheme,
    colors,
    responsive,
    cardShadow,
    cardStyle,
    getChipStyle: (isSelected: boolean) => ({
      borderRadius: 9999,
      paddingHorizontal: responsive.spacing.sm,
      height: responsive.chipHeight,
      borderWidth: 1,
      borderColor: isSelected ? colors.primary : colors.border,
      backgroundColor: isSelected ? colors.primarySoft : colors.surface,
      alignItems: 'center',
      flexDirection: 'row' as const,
      gap: responsive.spacing.xs,
    }),
    getTouchableSurface: (pressed: boolean) => ({
      backgroundColor: pressed ? colors.surfacePressed : colors.surfaceElevated,
      borderRadius: 12,
    }),
  } as const;
};
