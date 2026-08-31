import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ResponsiveText from './ResponsiveText';

/**
 * The one modal shell. Phones get a bottom sheet (or a centered card with
 * presentation="center"); tablets always center at maxWidth. Keyboard
 * avoidance and safe-area padding are built in — screens should not wrap
 * this in their own KeyboardAvoidingView.
 */
export default function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  presentation = 'sheet',
  scrollable = true,
  maxWidth = 560,
}) {
  const { insets, isTablet, height } = useResponsiveLayout();
  const asSheet = presentation === 'sheet' && !isTablet;

  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    ? { keyboardShouldPersistTaps: 'handled', showsVerticalScrollIndicator: false }
    : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType={asSheet ? 'slide' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, asSheet ? styles.backdropSheet : styles.backdropCenter]}
          onPress={onClose}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.card,
              asSheet ? styles.sheet : [styles.center, { maxWidth }],
              {
                maxHeight: height * 0.85,
                paddingBottom: asSheet
                  ? Math.max(insets.bottom, spacingSizes.lg)
                  : spacingSizes.lg,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <ResponsiveText size="large" weight="bold" numberOfLines={1}>
                  {title}
                </ResponsiveText>
                {subtitle ? (
                  <ResponsiveText size="small" color={colors.text.secondary} numberOfLines={2}>
                    {subtitle}
                  </ResponsiveText>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={iconSizes.md} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>
            <Body style={styles.body} {...bodyProps}>
              {children}
            </Body>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  backdropSheet: {
    justifyContent: 'flex-end',
  },
  backdropCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingSizes.xl,
  },
  card: {
    backgroundColor: colors.white,
    paddingTop: spacingSizes.lg,
    paddingHorizontal: spacingSizes.lg,
  },
  sheet: {
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    width: '100%',
  },
  center: {
    borderRadius: radii.xl,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacingSizes.md,
  },
  headerText: {
    flex: 1,
    marginRight: spacingSizes.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flexGrow: 0,
  },
  footer: {
    marginTop: spacingSizes.md,
    flexDirection: 'row',
    gap: spacingSizes.sm,
  },
});
