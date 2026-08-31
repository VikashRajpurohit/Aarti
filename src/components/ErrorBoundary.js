import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacingSizes, textSizes } from '../theme/responsive';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning-outline" size={48} color={colors.error[500]} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Please try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Ionicons name="refresh-outline" size={18} color={colors.white} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingSizes.xxl,
    backgroundColor: colors.neutral[100],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingSizes.lg,
  },
  title: {
    fontSize: textSizes.xlarge,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacingSizes.sm,
  },
  message: {
    fontSize: textSizes.medium,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacingSizes.xl,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    paddingHorizontal: spacingSizes.xl,
    paddingVertical: spacingSizes.md,
    borderRadius: 14,
    backgroundColor: colors.primary[600],
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: textSizes.medium,
  },
});
