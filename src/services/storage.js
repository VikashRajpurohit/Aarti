//Storage Service - Simplified without Companies
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Challan, CHALLAN_STATUS } from '../models/Challan';

const CHALLANS_KEY = '@challans';
const ACTIVE_CHALLAN_KEY = '@active_challan_id';

export const storageService = {
  // Challans - Multiple Challan Support
  async getChallans() {
    try {
      const json = await AsyncStorage.getItem(CHALLANS_KEY);
      if (!json) return [];
      const data = JSON.parse(json);
      return data.map(item => Challan.fromJSON(item));
    } catch (error) {
      console.error('Error getting challans:', error);
      return [];
    }
  },

  async saveChallans(challans) {
    try {
      const list = Array.isArray(challans) ? challans : [];
      await AsyncStorage.setItem(
        CHALLANS_KEY,
        JSON.stringify(list.map((c) => (c?.toJSON ? c.toJSON() : c)))
      );
      return list;
    } catch (error) {
      console.error('Error saving challans:', error);
      throw error;
    }
  },

  async getChallanById(id) {
    try {
      const challans = await this.getChallans();
      return challans.find(c => c.id === id);
    } catch (error) {
      console.error('Error getting challan by id:', error);
      return null;
    }
  },

  async saveChallan(challan) {
    try {
      const challans = await this.getChallans();
      const existingIndex = challans.findIndex(c => c.id === challan.id);
      if (existingIndex >= 0) {
        challans[existingIndex] = challan;
      } else {
        challans.push(challan);
      }
      await AsyncStorage.setItem(CHALLANS_KEY, JSON.stringify(challans.map(c => c.toJSON())));
      return challans;
    } catch (error) {
      console.error('Error saving challan:', error);
      throw error;
    }
  },

  async deleteChallan(id) {
    try {
      const challans = await this.getChallans();
      const filtered = challans.filter(c => c.id !== id);
      await AsyncStorage.setItem(CHALLANS_KEY, JSON.stringify(filtered.map(c => c.toJSON())));
      return filtered;
    } catch (error) {
      console.error('Error deleting challan:', error);
      throw error;
    }
  },

  async updateChallanStatus(id, status) {
    try {
      const challan = await this.getChallanById(id);
      if (challan) {
        challan.status = status;
        await this.saveChallan(challan);
        return challan;
      }
      return null;
    } catch (error) {
      console.error('Error updating challan status:', error);
      throw error;
    }
  },

  // Active Challan Management
  async getActiveChallanId() {
    try {
      return await AsyncStorage.getItem(ACTIVE_CHALLAN_KEY);
    } catch (error) {
      console.error('Error getting active challan id:', error);
      return null;
    }
  },

  async setActiveChallanId(id) {
    try {
      if (id) {
        await AsyncStorage.setItem(ACTIVE_CHALLAN_KEY, id);
      } else {
        await AsyncStorage.removeItem(ACTIVE_CHALLAN_KEY);
      }
    } catch (error) {
      console.error('Error setting active challan id:', error);
      throw error;
    }
  },
};
