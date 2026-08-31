//Content view - Premium Animation Configurations
import { Animated, Easing } from 'react-native';

export const animations = {
  // Durations
  durations: {
    fastest: 150,
    fast: 200,
    normal: 300,
    slow: 400,
    slowest: 500,
  },

  // Easing functions
  easing: {
    easeIn: Easing.in(Easing.ease),
    easeOut: Easing.out(Easing.ease),
    easeInOut: Easing.inOut(Easing.ease),
    bounce: Easing.bounce,
    elastic: Easing.elastic(1),
    back: Easing.back(1.5),
    bezier: Easing.bezier(0.25, 0.1, 0.25, 1),
  },

  // Spring configurations
  spring: {
    gentle: {
      tension: 120,
      friction: 14,
    },
    smooth: {
      tension: 80,
      friction: 12,
    },
    bouncy: {
      tension: 180,
      friction: 12,
    },
    snappy: {
      tension: 300,
      friction: 25,
    },
  },

  // Fade animations
  fadeIn: (animValue, duration = 300) => {
    return Animated.timing(animValue, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
  },

  fadeOut: (animValue, duration = 300) => {
    return Animated.timing(animValue, {
      toValue: 0,
      duration,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    });
  },

  // Scale animations
  scaleIn: (animValue, duration = 300) => {
    return Animated.spring(animValue, {
      toValue: 1,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    });
  },

  scaleOut: (animValue, duration = 200) => {
    return Animated.timing(animValue, {
      toValue: 0,
      duration,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    });
  },

  // Slide animations
  slideInUp: (animValue, duration = 400) => {
    return Animated.spring(animValue, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    });
  },

  slideInDown: (animValue, duration = 400) => {
    return Animated.spring(animValue, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    });
  },

  // Pulse animation
  pulse: (animValue) => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
  },

  // Rotation animation
  rotate: (animValue) => {
    return Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
  },

  // Shimmer animation
  shimmer: (animValue) => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
  },
};

// Interpolation helpers
export const interpolations = {
  fadeScale: (animValue) => ({
    opacity: animValue,
    transform: [
      {
        scale: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  }),

  slideUp: (animValue, distance = 50) => ({
    opacity: animValue,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  }),

  slideDown: (animValue, distance = 50) => ({
    opacity: animValue,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [-distance, 0],
        }),
      },
    ],
  }),

  rotate: (animValue) => ({
    transform: [
      {
        rotate: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  }),
};

