import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { textSizes, spacingSizes } from '../theme/responsive';

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.sequence([
      // Logo fade in and scale up
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Text fade in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Loader fade in
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={[colors.primary[600], colors.primary[800], colors.primary[950]]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        {/* Animated Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: Animated.multiply(logoScale, pulseAnim) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.white, colors.primary[100]]}
            style={styles.logoBackground}
          >
            <Ionicons name="cube" size={60} color={colors.primary[600]} />
          </LinearGradient>
        </Animated.View>

        {/* App Name */}
        <Animated.View style={{ opacity: textOpacity }}>
          <Text style={styles.appName}>Aarti Polymers</Text>
          <Text style={styles.tagline}>Quality. Innovation. Trust.</Text>
        </Animated.View>

        {/* Loading indicator */}
        <Animated.View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
          <View style={styles.loader}>
            <Animated.View style={[styles.loaderDot, styles.loaderDot1]} />
            <Animated.View style={[styles.loaderDot, styles.loaderDot2]} />
            <Animated.View style={[styles.loaderDot, styles.loaderDot3]} />
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Aarti Polymers</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: spacingSizes.xl,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: radii.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  appName: {
    fontSize: textSizes.huge || 32,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacingSizes.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: textSizes.medium || 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loaderContainer: {
    marginTop: spacingSizes.xxxl || 32,
    alignItems: 'center',
  },
  loader: {
    flexDirection: 'row',
    marginBottom: spacingSizes.sm,
  },
  loaderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 4,
  },
  loaderDot1: {
    opacity: 0.4,
  },
  loaderDot2: {
    opacity: 0.7,
  },
  loaderDot3: {
    opacity: 1,
  },
  loadingText: {
    fontSize: textSizes.small || 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: spacingSizes.xxxl || 32,
  },
  footerText: {
    fontSize: textSizes.small || 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
