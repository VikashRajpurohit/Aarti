//Content view - Responsive Typography System
import { textSizes } from './responsive';
import { colors } from './colors';

export const typography = {
  // Headings
  h1: {
    fontSize: textSizes.huge,
    fontWeight: '700',
    lineHeight: textSizes.huge * 1.2,
    color: colors.text.primary,
  },
  h2: {
    fontSize: textSizes.xxlarge,
    fontWeight: '700',
    lineHeight: textSizes.xxlarge * 1.2,
    color: colors.text.primary,
  },
  h3: {
    fontSize: textSizes.xlarge,
    fontWeight: '600',
    lineHeight: textSizes.xlarge * 1.3,
    color: colors.text.primary,
  },
  h4: {
    fontSize: textSizes.large,
    fontWeight: '600',
    lineHeight: textSizes.large * 1.3,
    color: colors.text.primary,
  },

  // Body text
  body1: {
    fontSize: textSizes.regular,
    fontWeight: '400',
    lineHeight: textSizes.regular * 1.5,
    color: colors.text.primary,
  },
  body2: {
    fontSize: textSizes.medium,
    fontWeight: '400',
    lineHeight: textSizes.medium * 1.5,
    color: colors.text.secondary,
  },

  // Button
  button: {
    fontSize: textSizes.medium,
    fontWeight: '600',
    lineHeight: textSizes.medium * 1.2,
    letterSpacing: 0.5,
  },

  // Caption
  caption: {
    fontSize: textSizes.small,
    fontWeight: '400',
    lineHeight: textSizes.small * 1.4,
    color: colors.text.secondary,
  },

  // Overline
  overline: {
    fontSize: textSizes.tiny,
    fontWeight: '600',
    lineHeight: textSizes.tiny * 1.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.secondary,
  },
};
