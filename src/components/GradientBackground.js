//Clean Professional Background - No Floating Orbs
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

export default function GradientBackground({
  children,
  variant = 'background',
  style,
  ...props
}) {
  const getGradientColors = () => {
    switch (variant) {
      case 'background':
        return [colors.background, colors.surfaceHighlight];
      case 'primary':
        return colors.gradients.primary;
      case 'premium':
        return [colors.background, colors.primary[50]];
      default:
        return [colors.background, colors.white];
    }
  };

  return (
    <View style={[styles.container, style]} {...props}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
