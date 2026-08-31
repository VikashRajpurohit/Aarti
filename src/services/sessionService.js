import { supabase, supabaseUrl } from '../config/supabase';

const shouldRefresh = (session) => {
  if (!session) return true;
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  if (!expiresAtMs) return true;
  // Refresh if token expires within the next 60 seconds
  return expiresAtMs - Date.now() < 60 * 1000;
};

export const getValidAccessToken = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session) {
    throw new Error('No active session. Please log in again.');
  }

  let session = sessionData.session;

  if (shouldRefresh(session)) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (refreshError || !refreshData?.session) {
      await supabase.auth.signOut();
      throw new Error('Session expired. Please log in again.');
    }
    session = refreshData.session;
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('No access token found. Please log in again.');
  }

  // Safety check for project mismatch if user switched projects
  try {
    const expectedRef = new URL(supabaseUrl).hostname.split('.')[0];
    const parts = accessToken.split('.');
    if (parts.length >= 2 && typeof atob === 'function') {
      const payload = JSON.parse(atob(parts[1]));
      if (payload?.ref && payload.ref !== expectedRef) {
        throw new Error('Session belongs to another Supabase project. Please log out and log in again.');
      }
    }
  } catch (error) {
    if (error?.message?.includes('Session belongs to another Supabase project')) {
      throw error;
    }
    // Ignore parse errors; token will be validated by the server.
  }

  return accessToken;
};

export const forceReauth = async () => {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  throw new Error('Session expired or invalid. Please log in again.');
};
