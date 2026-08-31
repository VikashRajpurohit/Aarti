//PREMIUM Responsive Text Component with Smooth Rendering
import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { textSizes } from '../theme/responsive';
import { colors } from '../theme/colors';

export default function ResponsiveText({
  children,
  size = 'regular',
  color = colors.text.primary,
  weight = 'normal',
  style,
  numberOfLines,
  align = 'left',
  ...props
}) {
  const fontSizeMap = {
    tiny: textSizes.tiny,
    small: textSizes.small,
    medium: textSizes.medium,
    regular: textSizes.regular,
    large: textSizes.large,
    xlarge: textSizes.xlarge,
    xxlarge: textSizes.xxlarge,
    huge: textSizes.huge,
    display: textSizes.display,
  };

  const fontWeightMap = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  };

  const lineHeightMap = {
    tiny: textSizes.tiny * 1.4,
    small: textSizes.small * 1.4,
    medium: textSizes.medium * 1.5,
    regular: textSizes.regular * 1.5,
    large: textSizes.large * 1.4,
    xlarge: textSizes.xlarge * 1.3,
    xxlarge: textSizes.xxlarge * 1.2,
    huge: textSizes.huge * 1.2,
    display: textSizes.display * 1.1,
  };

  return (
    <Text
      style={[
        styles.text,
        {
          fontSize: fontSizeMap[size] || textSizes.regular,
          color,
          fontWeight: fontWeightMap[weight] || '400',
          lineHeight: lineHeightMap[size] || textSizes.regular * 1.5,
          textAlign: align,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
      allowFontScaling={false}
      {...props}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    flexShrink: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
    }),
  },
});
