//Suggestion Service - Persists suggestions for manual entry auto-complete
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUGGESTIONS_KEY = '@suggestions';
const MAX_SUGGESTIONS = 20; // Maximum suggestions per field

/**
 * Structure: {
 *   size: ['300', '200', '250', ...],
 *   batchNo: ['05HD1411', '06AT2233', ...],
 *   product: ['STRETCH', 'FILM', 'WRAP', ...],
 *   lastItem: { boxNo, size, batchNo, product, weight, itemName }
 * }
 */

export const suggestionService = {
  /**
   * Get all suggestions
   */
  async getSuggestions() {
    try {
      const json = await AsyncStorage.getItem(SUGGESTIONS_KEY);
      if (!json) {
        return { size: [], batchNo: [], product: [], lastItem: null };
      }
      return JSON.parse(json);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return { size: [], batchNo: [], product: [], lastItem: null };
    }
  },

  /**
   * Add suggestions from a scanned/manual item
   * Also updates lastItem for auto-populate feature
   */
  async addSuggestionsFromItem(item) {
    try {
      const current = await this.getSuggestions();

      // Helper to add unique value to the front of array
      const addUnique = (arr, value) => {
        if (!value || value.trim() === '') return arr;
        const trimmed = value.trim();
        const filtered = arr.filter(v => v !== trimmed);
        return [trimmed, ...filtered].slice(0, MAX_SUGGESTIONS);
      };

      const updated = {
        size: addUnique(current.size, item.size),
        batchNo: addUnique(current.batchNo, item.batchNo),
        product: addUnique(current.product, item.product),
        lastItem: {
          boxNo: item.boxNo,
          size: item.size,
          batchNo: item.batchNo,
          product: item.product,
          weight: item.weight,
          itemName: item.itemName,
        },
      };

      await AsyncStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error adding suggestions:', error);
      throw error;
    }
  },

  /**
   * Get the last item with auto-incremented box number
   */
  async getLastItemWithIncrementedBox() {
    try {
      const { lastItem } = await this.getSuggestions();
      if (!lastItem) return null;

      // Increment box number
      const boxNoNum = parseInt(lastItem.boxNo, 10);
      if (isNaN(boxNoNum)) {
        return { ...lastItem, boxNo: '' };
      }

      // Preserve leading zeros
      const originalLength = lastItem.boxNo.length;
      const incrementedBoxNo = String(boxNoNum + 1).padStart(originalLength, '0');

      return {
        ...lastItem,
        boxNo: incrementedBoxNo,
      };
    } catch (error) {
      console.error('Error getting last item:', error);
      return null;
    }
  },

  /**
   * Get suggestions for a specific field
   */
  async getFieldSuggestions(field) {
    try {
      const suggestions = await this.getSuggestions();
      return suggestions[field] || [];
    } catch (error) {
      console.error('Error getting field suggestions:', error);
      return [];
    }
  },

  /**
   * Clear all suggestions (for testing/reset)
   */
  async clearSuggestions() {
    try {
      await AsyncStorage.removeItem(SUGGESTIONS_KEY);
    } catch (error) {
      console.error('Error clearing suggestions:', error);
      throw error;
    }
  },
};
