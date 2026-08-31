//PREMIUM Responsive Design Utilities - Ultra Smooth Scaling
import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Scale off the short edge so a cold start in landscape (or on a tablet)
// doesn't inflate fonts/spacing; layout adapts via useResponsiveLayout instead.
const BASIS_WIDTH = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
const BASIS_HEIGHT = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
const MAX_SCALE = 1.25;

export const responsive = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,

  isSmallDevice: BASIS_WIDTH < 375,
  isMediumDevice: BASIS_WIDTH >= 375 && BASIS_WIDTH < 414,
  isLargeDevice: BASIS_WIDTH >= 414,

  scale: (size) => {
    const scaleFactor = Math.min(BASIS_WIDTH / BASE_WIDTH, MAX_SCALE);
    const newSize = size * scaleFactor;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  },

  verticalScale: (size) => {
    const scaleFactor = Math.min(BASIS_HEIGHT / BASE_HEIGHT, MAX_SCALE);
    return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
  },

  moderateScale: (size, factor = 0.5) => {
    const scaleFactor = Math.min(BASIS_WIDTH / BASE_WIDTH, MAX_SCALE);
    return Math.round(PixelRatio.roundToNearestPixel(size + (size * scaleFactor - size) * factor));
  },

  fontSize: (size) => {
    const scaleFactor = Math.min(BASIS_WIDTH / BASE_WIDTH, MAX_SCALE);
    return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
  },
  
  wp: (percentage) => (SCREEN_WIDTH * percentage) / 100,
  hp: (percentage) => (SCREEN_HEIGHT * percentage) / 100,
  
  safeTop: Platform.select({ ios: 50, android: 0 }),
  safeBottom: Platform.select({ ios: 34, android: 0 }),
};

export const textSizes = {
  tiny: responsive.fontSize(10),
  small: responsive.fontSize(12),
  medium: responsive.fontSize(14),
  regular: responsive.fontSize(16),
  large: responsive.fontSize(18),
  xlarge: responsive.fontSize(20),
  xxlarge: responsive.fontSize(24),
  huge: responsive.fontSize(32),
  display: responsive.fontSize(40),
};

export const spacingSizes = {
  xs: responsive.scale(4),
  sm: responsive.scale(8),
  md: responsive.scale(12),
  lg: responsive.scale(16),
  xl: responsive.scale(20),
  xxl: responsive.scale(24),
  xxxl: responsive.scale(32),
  huge: responsive.scale(48),
};

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  hero: 48,
};

// Fixed component dimensions shared across screens (unscaled: these are
// touch-target/control heights, which should stay constant across devices).
export const sizes = {
  headerHeight: 56,
  inputHeight: 48,
  touchTarget: 44,
  tabBarBase: 56,
  chipHeight: 34,
};

export const shadows = {
  small: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  large: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
  premium: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
};
