import { supabase } from '../config/supabase';

export const productionOutputService = {
  async fetchProducts() {
    return supabase
      .from('production_product_types')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
  },

  async fetchShiftsByDate(shiftDate) {
    return supabase
      .from('production_shifts')
      .select('*, production_outputs(*)')
      .eq('shift_date', shiftDate)
      .order('shift_type', { ascending: true });
  },

  async createShift(payload) {
    return supabase
      .from('production_shifts')
      .insert(payload)
      .select('*')
      .single();
  },

  async updateShift(shiftId, payload) {
    return supabase
      .from('production_shifts')
      .update(payload)
      .eq('id', shiftId)
      .select('*')
      .single();
  },

  async restartShift(shiftId) {
    return supabase.rpc('restart_production_shift', { shift_id: shiftId });
  },

  async upsertOutputs(rows) {
    return supabase
      .from('production_outputs')
      .upsert(rows, { onConflict: 'shift_id,product_id' })
      .select('*');
  },

  async addProduct(payload) {
    return supabase
      .from('production_product_types')
      .insert(payload)
      .select('*')
      .single();
  },

  async updateProduct(productId, payload) {
    return supabase
      .from('production_product_types')
      .update(payload)
      .eq('id', productId)
      .select('*')
      .single();
  },
};
