import React, { forwardRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, iconSizes, sizes } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';

/**
 * Standard labeled text input. forwardRef points at the inner TextInput so
 * forms can chain focus: returnKeyType="next" + onSubmitEditing={() =>
 * nextRef.current?.focus()}. blurOnSubmit defaults to false to keep the
 * keyboard up between fields (hardware-keyboard friendly).
 */
const AppTextInput = forwardRef(function AppTextInput(
  {
    label,
    error,
    helper,
    leftIcon,
    rightNode,
    containerStyle,
    inputStyle,
    multiline = false,
    onFocus,
    onBlur,
    blurOnSubmit = false,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <ResponsiveText size="small" weight="semibold" color={colors.text.secondary} style={styles.label}>
          {label}
        </ResponsiveText>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          focused && styles.inputWrapFocused,
          !!error && styles.inputWrapError,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={iconSizes.md}
            color={focused ? colors.primary[500] : colors.neutral[400]}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          placeholderTextColor={colors.text.tertiary}
          multiline={multiline}
          blurOnSubmit={blurOnSubmit}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightNode}
      </View>
      {error || helper ? (
        <ResponsiveText
          size="tiny"
          color={error ? colors.error[600] : colors.text.tertiary}
          style={styles.helper}
        >
          {error || helper}
        </ResponsiveText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacingSizes.md,
  },
  label: {
    marginBottom: spacingSizes.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.inputHeight,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacingSizes.md,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacingSizes.sm,
  },
  inputWrapFocused: {
    borderColor: colors.primary[400],
  },
  inputWrapError: {
    borderColor: colors.error[500],
  },
  leftIcon: {
    marginRight: spacingSizes.sm,
  },
  input: {
    flex: 1,
    fontSize: textSizes.regular,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  helper: {
    marginTop: spacingSizes.xs,
  },
});

export default AppTextInput;
