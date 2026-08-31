import { supabase } from '../config/supabase';

export const purchaseService = {
  async fetchMaterials() {
    return supabase
      .from('raw_material_types')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
  },

  async fetchEntriesByDate(purchaseDate) {
    return supabase
      .from('purchase_entries')
      .select('*')
      .eq('purchase_date', purchaseDate)
      .order('created_at', { ascending: true });
  },

  async fetchEntriesByDateRange(startDate, endDate) {
    return supabase
      .from('purchase_entries')
      .select('*')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate)
      .order('purchase_date', { ascending: true });
  },

  async createPurchaseEntry(payload) {
    return supabase
      .from('purchase_entries')
      .insert(payload)
      .select('*')
      .single();
  },

  async updatePurchaseEntry(id, payload) {
    return supabase
      .from('purchase_entries')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
  },

  async deletePurchaseEntry(id) {
    return supabase
      .from('purchase_entries')
      .delete()
      .eq('id', id);
  },
};
