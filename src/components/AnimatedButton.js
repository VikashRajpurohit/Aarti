//Clean Professional Button Component
import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { responsive, spacingSizes, shadows } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';

export default function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  gradient = false,
  ...props
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getButtonColors = () => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primary[600], text: colors.white };
      case 'secondary':
        return { bg: colors.primary[50], text: colors.primary[700] };
      case 'outline':
        return { bg: 'transparent', text: colors.primary[600], border: colors.primary[300] };
      case 'ghost':
        return { bg: 'transparent', text: colors.text.secondary };
      case 'danger':
        return { bg: colors.danger[500], text: colors.white };
      case 'success':
        return { bg: colors.success[600], text: colors.white };
      default:
        return { bg: colors.primary[600], text: colors.white };
    }
  };

  const getGradientColors = () => {
    switch (variant) {
      case 'primary': return [colors.primary[600], colors.primary[700]];
      case 'danger': return [colors.danger[500], colors.danger[600]];
      case 'success': return [colors.success[500], colors.success[600]];
      default: return null;
    }
  };

  const buttonColors = getButtonColors();
  const gradientColors = gradient ? getGradientColors() : null;

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: spacingSizes.xs + 4,
          paddingHorizontal: spacingSizes.md,
          minHeight: 36,
          borderRadius: 10,
        };
      case 'large':
        return {
          paddingVertical: spacingSizes.md + 4,
          paddingHorizontal: spacingSizes.xl,
          minHeight: 52,
          borderRadius: 14,
        };
      default:
        return {
          paddingVertical: spacingSizes.sm + 4,
          paddingHorizontal: spacingSizes.lg,
          minHeight: 46,
          borderRadius: 12,
        };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small': return 'small';
      case 'large': return 'large';
      default: return 'regular';
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        style={[
          styles.button,
          getSizeStyle(),
          !gradient && { backgroundColor: buttonColors.bg },
          variant === 'outline' && { borderWidth: 1.5, borderColor: buttonColors.border },
          disabled && styles.disabled,
        ]}
        {...props}
      >
        {gradient && !disabled && gradientColors ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={buttonColors.text} size="small" />
          ) : (
            <>
              {icon && <View style={styles.icon}>{icon}</View>}
              {title && (
                <ResponsiveText size={getTextSize()} color={buttonColors.text} weight="semibold">
                  {title}
                </ResponsiveText>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingSizes.sm,
    zIndex: 1,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
