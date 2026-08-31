import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacingSizes, textSizes } from '../theme/responsive';

/**
 * InlineBanner — auto-dismissing success/error/info banner.
 *
 * Props:
 *  visible   bool     show/hide
 *  message   string   text to display
 *  type      string   'success' | 'error' | 'warning' | 'info'
 *  duration  number   ms before auto-hide (default 2500)
 *  onHide    fn       called after banner hides
 */
export default function InlineBanner({
  visible,
  message,
  type = 'success',
  duration = 2500,
  onHide,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -10, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(-10);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: { bg: colors.success[50], border: colors.success[200], text: colors.success[700], icon: 'checkmark-circle' },
    error: { bg: colors.danger[50], border: colors.danger[200], text: colors.danger[700], icon: 'close-circle' },
    warning: { bg: colors.warning[50], border: colors.warning[200], text: colors.warning[700], icon: 'warning' },
    info: { bg: colors.primary[50], border: colors.primary[200], text: colors.primary[700], icon: 'information-circle' },
  }[type] || {};

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: config.bg, borderColor: config.border, opacity, transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Ionicons name={config.icon} size={18} color={config.text} />
      <Text style={[styles.text, { color: config.text }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingSizes.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.md,
  },
  text: {
    fontSize: textSizes.medium,
    fontWeight: '600',
    flex: 1,
  },
});
