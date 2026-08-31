import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacingSizes, iconSizes } from '../../theme/responsive';
import AnimatedCard from '../../components/AnimatedCard';
import ResponsiveText from '../../components/ResponsiveText';

/**
 * The one section container for Reports: an elevated card with a tonal-icon
 * header. Replaces the repeated `sectionCard` + inline SectionHeader markup so
 * every section looks identical.
 *
 * Props: icon, label, color (accent hex), subtitle?, headerRight?, delay?, style
 */
export default function ReportCard({
  icon,
  label,
  color = colors.primary[500],
  subtitle,
  headerRight,
  delay = 0,
  children,
  style,
}) {
  return (
    <AnimatedCard variant="elevated" delay={delay} style={[styles.card, style]}>
      {label ? (
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {icon ? (
              <View style={[styles.iconBadge, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={iconSizes.sm} color={color} />
              </View>
            ) : null}
            <View style={styles.headerText}>
              <ResponsiveText size="medium" weight="bold" numberOfLines={1}>
                {label}
              </ResponsiveText>
              {subtitle ? (
                <ResponsiveText size="tiny" color={colors.text.tertiary} numberOfLines={1}>
                  {subtitle}
                </ResponsiveText>
              ) : null}
            </View>
          </View>
          {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
        </View>
      ) : null}
      {children}
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacingSizes.md,
    marginBottom: spacingSizes.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerRight: {
    flexShrink: 0,
    paddingTop: 2,
  },
});
