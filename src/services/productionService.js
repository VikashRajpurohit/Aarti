import { supabase } from '../config/supabase';

export const productionService = {
  async fetchMaterials() {
    return supabase
      .from('raw_material_types')
      .select('*')
      .order('created_at', { ascending: true });
  },

  async fetchEntriesByDate(shiftDate) {
    return supabase
      .from('raw_material_entries')
      .select('*')
      .eq('shift_date', shiftDate)
      .order('shift_type', { ascending: true });
  },

  async createShiftEntry(payload) {
    return supabase
      .from('raw_material_entries')
      .insert(payload)
      .select('*')
      .single();
  },

  async updateShiftEntry(entryId, payload) {
    return supabase
      .from('raw_material_entries')
      .update(payload)
      .eq('id', entryId)
      .select('*')
      .single();
  },

  async endShift(entryId, payload) {
    return supabase
      .from('raw_material_entries')
      .update(payload)
      .eq('id', entryId)
      .select('*')
      .single();
  },

  async restartShift(entryId) {
    return supabase.rpc('restart_raw_material_shift', { entry_id: entryId });
  },

  async addMaterial(name) {
    return supabase
      .from('raw_material_types')
      .insert({ name })
      .select('*')
      .single();
  },

  async updateMaterial(materialId, payload) {
    return supabase
      .from('raw_material_types')
      .update(payload)
      .eq('id', materialId)
      .select('*')
      .single();
  },
};
