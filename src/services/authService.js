
import { supabase, supabaseAnonKey, supabaseUrl } from '../config/supabase';
import { forceReauth, getValidAccessToken } from './sessionService';

const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    if (typeof atob !== 'function') return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const authService = {
  // Login with email and password
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Fetch profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
        // If no profile exists, it might be the very first admin or an error.
        // For now, return user without role if profile fails?
        // Or throw error.
        console.warn("Profile fetch failed:", profileError);
    }

    return { session: data.session, user: data.user, role: profile?.role };
  },

  // Logout
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
        return { session: data.session, user: data.session.user, role: profile?.role };
    }
    return { session: null, user: null, role: null };
  },

  // Admin: Create new user
  createUser: async (userData) => {
    // userData: { email, password, role, full_name }
    const accessToken = await getValidAccessToken();
    const jwtPayload = decodeJwtPayload(accessToken);
    const expectedRef = (() => {
      try {
        return new URL(supabaseUrl).hostname.split('.')[0];
      } catch {
        return null;
      }
    })();
    console.log('createUser session debug:', {
      supabaseUrl,
      expectedRef,
      iss: jwtPayload?.iss,
      ref: jwtPayload?.ref,
      exp: jwtPayload?.exp,
    });
    
    // Direct fetch to ensure headers are set correctly in RN
    const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(userData),
    });

    const rawText = await response.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = rawText;
    }

    if (!response.ok) {
      console.error('Edge function error:', response.status, payload);
      if (response.status === 401) {
        await forceReauth();
      }
      const message = payload?.error || `Edge Function error (${response.status})`;
      throw new Error(message);
    }

    if (payload?.error) throw new Error(payload.error);
    return payload;
  },

  // Admin: Update user password
  updateUserPassword: async ({ userId, password }) => {
    if (!userId || !password) {
      throw new Error('User ID and password are required.');
    }
    const accessToken = await getValidAccessToken();

    const response = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ user_id: userId, password }),
    });

    const rawText = await response.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = rawText;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await forceReauth();
      }
      const message = payload?.error || `Edge Function error (${response.status})`;
      throw new Error(message);
    }

    if (payload?.error) throw new Error(payload.error);
    return payload;
  }
};
