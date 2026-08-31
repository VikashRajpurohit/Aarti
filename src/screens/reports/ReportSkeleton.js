import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacingSizes } from '../../theme/responsive';

/** Pulsing placeholder block. */
export function SkeletonBlock({ width = '100%', height = 16, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radii.sm, backgroundColor: colors.neutral[200], opacity: anim },
        style,
      ]}
    />
  );
}

/** The single loading treatment for every Reports section. */
export default function ReportSkeleton({ columns = 1 }) {
  const kpiBasis = columns >= 3 ? '30%' : columns >= 2 ? '31%' : '45%';
  return (
    <View style={styles.container}>
      <View style={styles.kpiGrid}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.kpiCard, { flexBasis: kpiBasis }]}>
            <SkeletonBlock height={12} width="60%" style={{ marginBottom: 8 }} />
            <SkeletonBlock height={26} width="80%" style={{ marginBottom: 6 }} />
            <SkeletonBlock height={10} width="50%" />
          </View>
        ))}
      </View>
      <SkeletonBlock height={200} style={styles.block} />
      <SkeletonBlock height={150} style={styles.block} />
      <SkeletonBlock height={120} style={styles.block} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacingSizes.md },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.xs,
  },
  kpiCard: {
    flexGrow: 1,
    borderRadius: radii.lg,
    padding: spacingSizes.lg,
    backgroundColor: colors.neutral[100],
  },
  block: { borderRadius: radii.lg },
});
