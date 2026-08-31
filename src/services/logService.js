import { supabase } from '../config/supabase';

export const logService = {
  async logEvent({ action, entityType, entityId = null, metadata = {} }) {
    try {
      if (!action || !entityType) return;
      const payload = {
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      };
      const { error } = await supabase.from('activity_logs').insert(payload);
      if (error) {
        console.warn('logService insert error:', error.message);
      }
    } catch (error) {
      console.warn('logService error:', error?.message || error);
    }
  },
};
