import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { textSizes, spacingSizes, iconSizes, shadows } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { Ionicons } from '@expo/vector-icons';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch (_) {}

const REMEMBER_EMAIL_KEY = '@aarti_polymers_remember_email';
const REMEMBER_ME_KEY = '@aarti_polymers_remember_me';

export default function LoginScreen() {
  const { insets } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const { login } = useAuth();
  const passwordRef = useRef(null);
  
  // Animations
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Load saved email on mount
    loadSavedEmail();
    
    // Entrance animations
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedRememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (savedRememberMe === 'true') {
        setRememberMe(true);
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
        }
      }
    } catch (e) {
      console.log('Error loading saved email:', e);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    // Normalize — keyboards/autocomplete commonly append a trailing space or
    // capitalize the first letter, which breaks Supabase email/password auth.
    const cleanEmail = email.trim().toLowerCase();

    try { Haptics?.impactAsync?.(Haptics?.ImpactFeedbackStyle?.Medium); } catch (_) {}
    setIsLoading(true);

    try {
      // Save or remove email based on remember me
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, cleanEmail);
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'false');
      }

      const result = await login(cleanEmail, password);
      
      if (!result.success) {
        Alert.alert('Login Failed', result.error);
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Please contact your administrator to reset your password.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary[600], colors.primary[800], colors.primary[950]]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacingSizes.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <Animated.View 
            style={[
              styles.logoSection,
              { transform: [{ scale: logoScale }] }
            ]}
          >
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[colors.white, colors.primary[50]]}
                style={styles.logoBackground}
              >
                <Ionicons name="cube" size={50} color={colors.primary[600]} />
              </LinearGradient>
            </View>
            <Text style={styles.appName}>Aarti Polymers</Text>
            <Text style={styles.tagline}>Sign in to continue</Text>
          </Animated.View>

          {/* Login Card */}
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslate }],
              }
            ]}
          >
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={emailFocused ? colors.primary[600] : colors.neutral[400]} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.neutral[400]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  accessibilityLabel="Email address"
                  accessibilityHint="Enter your registered email address"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={passwordFocused ? colors.primary[600] : colors.neutral[400]} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.neutral[400]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your account password"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={colors.neutral[400]} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={styles.optionsRow}>
              <TouchableOpacity 
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
                accessibilityLabel={rememberMe ? 'Remember me, enabled' : 'Remember me, disabled'}
                accessibilityRole="checkbox"
              >
                <View style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked
                ]}>
                  {rememberMe && (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  )}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleForgotPassword}
                accessibilityLabel="Forgot password"
                accessibilityRole="button"
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity 
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
              accessibilityLabel="Sign in"
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
            >
              <LinearGradient
                colors={isLoading 
                  ? [colors.neutral[400], colors.neutral[500]] 
                  : [colors.primary[500], colors.primary[600], colors.primary[700]]}
                style={styles.loginButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacingSizes.xl) }]}>
          <Text style={styles.footerText}>© 2026 Aarti Polymers. All rights reserved.</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacingSizes.lg,
    paddingBottom: spacingSizes.lg,
    // Tablet: keep the form a comfortable width, centered
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacingSizes.xl,
  },
  logoContainer: {
    marginBottom: spacingSizes.md,
  },
  logoBackground: {
    width: 90,
    height: 90,
    borderRadius: radii.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  appName: {
    fontSize: textSizes.xxlarge || 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacingSizes.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagline: {
    fontSize: textSizes.medium || 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xxl,
    padding: spacingSizes.xl || 20,
    ...shadows.large,
  },
  inputContainer: {
    marginBottom: spacingSizes.md,
  },
  label: {
    fontSize: textSizes.small || 12,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacingSizes.xs,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderRadius: radii.md,
    paddingHorizontal: spacingSizes.md,
    height: 56,
  },
  inputWrapperFocused: {
    borderColor: colors.primary[400],
    backgroundColor: colors.white,
  },
  inputIcon: {
    marginRight: spacingSizes.sm,
  },
  input: {
    flex: 1,
    fontSize: textSizes.medium || 14,
    color: colors.neutral[900],
  },
  eyeButton: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingSizes.lg,
    marginTop: spacingSizes.xs,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingSizes.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  rememberMeText: {
    fontSize: textSizes.small || 12,
    color: colors.neutral[600],
  },
  forgotText: {
    fontSize: textSizes.small || 12,
    color: colors.primary[600],
    fontWeight: '600',
  },
  loginButton: {
    height: 56,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: textSizes.regular || 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: spacingSizes.xl || 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: textSizes.tiny || 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
