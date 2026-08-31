import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';
import AnimatedButton from './AnimatedButton';

export default function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction, style }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={iconSizes.xl} color={colors.neutral[400]} />
      </View>
      <ResponsiveText size="regular" weight="semibold" align="center">
        {title}
      </ResponsiveText>
      {message ? (
        <ResponsiveText size="small" color={colors.text.tertiary} align="center" style={styles.message}>
          {message}
        </ResponsiveText>
      ) : null}
      {actionLabel && onAction ? (
        <AnimatedButton title={actionLabel} onPress={onAction} size="small" variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacingSizes.xxxl,
    paddingHorizontal: spacingSizes.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacingSizes.md,
  },
  message: {
    marginTop: spacingSizes.xs,
    maxWidth: 280,
  },
  action: {
    marginTop: spacingSizes.lg,
  },
});
