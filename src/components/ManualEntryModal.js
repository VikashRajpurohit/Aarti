//Premium Manual Entry Modal with Auto-complete Suggestions
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { responsive, spacingSizes, shadows, textSizes } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';
import AnimatedButton from './AnimatedButton';
import { suggestionService } from '../services/suggestionService';

export default function ManualEntryModal({
  visible,
  onClose,
  onSubmit,
  checkItemExists,
}) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    boxNo: '',
    size: '',
    batchNo: '',
    product: '',
    weight: '',
  });
  const [suggestions, setSuggestions] = useState({
    size: [],
    batchNo: [],
    product: [],
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (visible) {
      loadDefaults();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(screenHeight);
    }
  }, [visible, screenHeight]);

  const loadDefaults = async () => {
    try {
      const allSuggestions = await suggestionService.getSuggestions();
      setSuggestions({
        size: allSuggestions.size || [],
        batchNo: allSuggestions.batchNo || [],
        product: allSuggestions.product || [],
      });

      const lastItem = await suggestionService.getLastItemWithIncrementedBox();
      if (lastItem) {
        setFormData({
          boxNo: lastItem.boxNo || '',
          size: lastItem.size || '',
          batchNo: lastItem.batchNo || '',
          product: lastItem.product || '',
          weight: lastItem.weight ? String(lastItem.weight) : '',
        });
      } else {
        setFormData({ boxNo: '', size: '', batchNo: '', product: '', weight: '' });
      }
      setErrors({});
    } catch (error) {
      console.error('Error loading defaults:', error);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSuggestionTap = (field, value) => {
    handleFieldChange(field, value);
    Keyboard.dismiss();
  };

  const validateForm = async () => {
    const newErrors = {};

    if (!formData.boxNo.trim()) newErrors.boxNo = 'Required';
    else {
      const exists = await checkItemExists(formData.boxNo.trim());
      if (exists) newErrors.boxNo = 'Already exists';
    }

    if (!formData.size.trim()) newErrors.size = 'Required';
    if (!formData.batchNo.trim()) newErrors.batchNo = 'Required';
    if (!formData.product.trim()) newErrors.product = 'Required';

    if (!formData.weight.trim()) {
      newErrors.weight = 'Required';
    } else {
      const weightNum = parseFloat(formData.weight);
      if (isNaN(weightNum) || weightNum <= 0) {
        newErrors.weight = 'Invalid';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const isValid = await validateForm();
      if (!isValid) {
        setLoading(false);
        return;
      }

      const batchNo = formData.batchNo.trim();
      const size = formData.size.trim();
      const itemName = batchNo.length >= 2
        ? `${size}/${batchNo.substring(0, 2)}`
        : size;

      const item = {
        boxNo: formData.boxNo.trim(),
        size: size,
        batchNo: batchNo,
        product: formData.product.trim(),
        weight: parseFloat(formData.weight),
        itemName: itemName,
        scannedAt: new Date(),
      };

      await onSubmit(item);
      onClose();
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: screenHeight, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const renderSuggestionChips = (field) => {
    const fieldSuggestions = suggestions[field] || [];
    if (fieldSuggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsContent}
          keyboardShouldPersistTaps="handled"
        >
          {fieldSuggestions.map((value, index) => (
            <TouchableOpacity
              key={`${field}-${index}`}
              style={[
                styles.suggestionChip,
                formData[field] === value && styles.suggestionChipActive,
              ]}
              onPress={() => handleSuggestionTap(field, value)}
              activeOpacity={0.7}
            >
              <ResponsiveText
                size="tiny"
                weight="semibold"
                color={formData[field] === value ? colors.white : colors.primary[700]}
              >
                {value}
              </ResponsiveText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderInputField = (field, label, options = {}) => {
    const {
      keyboardType = 'default',
      showSuggestions = false,
      halfWidth = false,
      style,
    } = options;
    const hasError = !!errors[field];

    return (
      <View style={[styles.fieldContainer, halfWidth && styles.halfWidthField, style]}>
        <View style={styles.labelRow}>
          <ResponsiveText size="small" weight="bold" color={colors.text.secondary} style={styles.label}>
            {label}
          </ResponsiveText>
          {hasError && (
            <ResponsiveText size="tiny" color={colors.danger[500]} style={styles.errorText}>
              {errors[field]}
            </ResponsiveText>
          )}
        </View>

        <View style={[styles.inputWrapper, hasError && styles.inputError]}>
          <TextInput
            style={styles.input}
            value={formData[field]}
            onChangeText={(value) => handleFieldChange(field, value)}
            placeholder={`Enter ${label}`}
            placeholderTextColor={colors.text.tertiary}
            keyboardType={keyboardType}
            returnKeyType="next"
            autoCapitalize="characters"
          />
        </View>
        {showSuggestions && renderSuggestionChips(field)}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlayContainer}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}>
            
            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <ResponsiveText size="h4" weight="bold" color={colors.text.primary}>
                  Manual Entry
                </ResponsiveText>
                <ResponsiveText size="small" color={colors.text.secondary}>
                  Fill in the details to add a new box
                </ResponsiveText>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Box Number - Prominent */}
              <View style={styles.section}>
                 {renderInputField('boxNo', 'Box Number', { keyboardType: 'number-pad' })}
              </View>

              {/* Size & Product Row */}
              <View style={styles.row}>
                {renderInputField('size', 'Size', { halfWidth: true, showSuggestions: true })}
                {renderInputField('product', 'Product', { halfWidth: true, showSuggestions: true })}
              </View>

              {/* Batch No - Prominent */}
              <View style={styles.section}>
                {renderInputField('batchNo', 'Batch Number', { showSuggestions: true })}
              </View>

              {/* Weight */}
              <View style={styles.section}>
                {renderInputField('weight', 'Net Weight (kg)', { keyboardType: 'decimal-pad' })}
              </View>
              
              {/* Spacing for keyboard */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer Action */}
            <View style={[styles.footer, { paddingBottom: spacingSizes.xl + insets.bottom }]}>
              <AnimatedButton
                title="Add to Challan"
                onPress={handleSubmit}
                variant="primary"
                gradient
                size="large"
                loading={loading}
                icon={<Ionicons name="checkmark" size={22} color={colors.white} />}
                style={styles.submitButton}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '92%', // Increased height
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
    overflow: 'hidden',
  },
  handleBarContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.neutral[300],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingSizes.xl,
    paddingBottom: spacingSizes.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitleContainer: {
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacingSizes.md,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacingSizes.xl,
    gap: spacingSizes.lg,
  },
  section: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacingSizes.md,
  },
  fieldContainer: {
    gap: 8,
    marginBottom: 12,
  },
  halfWidthField: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    marginLeft: 2,
  },
  inputWrapper: {
    backgroundColor: colors.neutral[50], // Slightly darker background for contrast
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    height: 56,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: colors.danger[400],
    backgroundColor: colors.danger[50],
  },
  input: {
    paddingHorizontal: 16,
    fontSize: textSizes.medium,
    color: colors.text.primary,
    fontWeight: '500',
    height: '100%',
  },
  errorText: {
    marginRight: 2,
  },
  suggestionsWrapper: {
    marginTop: 8,
  },
  suggestionsContent: {
    paddingRight: 20,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  suggestionChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  footer: {
    padding: spacingSizes.xl,
    paddingTop: spacingSizes.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.white,
  },
  submitButton: {
    width: '100%',
    height: 58,
    borderRadius: 18,
  },
});
