
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { supabaseUrl } from '../config/supabase';

const AuthContext = createContext({});

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

const getExpectedRef = () => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return null;
  }
};

// Fetch the profile row, retrying transient failures. A flaky fetch here must
// never silently produce a role-less session (which strands the user on a
// Profile-only tab set), so callers treat a returned error as fatal.
const fetchProfileWithRetry = async (userId, attempts = 3) => {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, roles, is_disabled, full_name')
      .eq('id', userId)
      .single();
    if (!error) return { data, error: null };
    lastError = error;
    // PGRST116 = no matching row; retrying won't help.
    if (error.code === 'PGRST116') break;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  return { data: null, error: lastError };
};

const deriveRoleList = (profile) =>
  (Array.isArray(profile?.roles) && profile.roles.length > 0)
    ? profile.roles
    : (profile?.role ? [profile.role] : []);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [fullName, setFullName] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Use refs to track state without triggering re-renders in callbacks
  const isMountedRef = useRef(true);
  const loginInProgressRef = useRef(false); // Flag to prevent listener interference

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check active session on startup
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Session found:', session.user.email);

          const expectedRef = getExpectedRef();
          const jwtPayload = decodeJwtPayload(session.access_token);
          if (expectedRef && jwtPayload?.ref && jwtPayload.ref !== expectedRef) {
            console.log('Session belongs to different project. Signing out.');
            await supabase.auth.signOut();
            if (isMountedRef.current) {
              setUser(null);
              setRole(null);
            }
            return;
          }
          
          // Fetch role (with retry — see fetchProfileWithRetry).
          const { data: profile, error: profileError } = await fetchProfileWithRetry(session.user.id);

          if (isMountedRef.current) {
            if (profileError || !profile) {
              // Couldn't establish the user's roles — don't strand them in a
              // role-less session. Sign out so they land back on Login.
              console.log('Profile fetch failed on init — signing out.', profileError?.message);
              await supabase.auth.signOut();
              setUser(null);
              setRole(null);
              setRoles([]);
              setFullName(null);
            } else if (profile.is_disabled) {
              await supabase.auth.signOut();
              setUser(null);
              setRole(null);
              setRoles([]);
              setFullName(null);
            } else {
              const roleList = deriveRoleList(profile);
              setUser(session.user);
              setRole(roleList[0] || profile?.role || null);
              setRoles(roleList);
              setFullName(profile?.full_name || null);
            }
          }
        } else {
          console.log('No session found');
        }
      } catch (e) {
        console.log("Auth Init Error:", e.message);
      } finally {
        if (isMountedRef.current) {
          console.log('Auth initialized, setting loading to false');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes (mainly for logout and token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

      if (!isMountedRef.current) return;

      // Skip if a login is in progress (we handle it in the login function)
      if (loginInProgressRef.current) {
        console.log('Skipping auth listener - login in progress');
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setUser(null);
        setRole(null);
        setRoles([]);
        setFullName(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('Token refreshed');
        setUser(session.user);
      }
      // Note: We don't handle SIGNED_IN here because login() handles it directly
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // Real-time listener: force logout when profile is disabled or deleted
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-watch-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;
          if (payload.new?.is_disabled) {
            console.log('User disabled in real-time — forcing logout');
            supabase.auth.signOut();
            setUser(null);
            setRole(null);
            setRoles([]);
            setFullName(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          if (!isMountedRef.current) return;
          console.log('User profile deleted in real-time — forcing logout');
          supabase.auth.signOut();
          setUser(null);
          setRole(null);
          setRoles([]);
          setFullName(null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Periodic heartbeat: update last_login every 10 minutes while app is active
  useEffect(() => {
    if (!user?.id) return;

    const updateLastActive = () => {
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {});
    };

    // Update immediately on mount (app open / user switch)
    updateLastActive();

    const interval = setInterval(updateLastActive, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
  }, [user?.id]);

  const login = async (email, password) => {
    loginInProgressRef.current = true; // Prevent listener interference
    
    try {
      console.log('Login attempt for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }

      const expectedRef = getExpectedRef();
      const jwtPayload = decodeJwtPayload(data?.session?.access_token);
      if (expectedRef && jwtPayload?.ref && jwtPayload.ref !== expectedRef) {
        await supabase.auth.signOut();
        return { success: false, error: 'Session belongs to another project. Please clear app data and log in again.' };
      }
      
      console.log('Supabase login successful:', data.user?.email);

      // Fetch role (with retry — see fetchProfileWithRetry).
      const { data: profile, error: profileError } = await fetchProfileWithRetry(data.user.id);

      if (profileError || !profile) {
        // Don't sign the user into a role-less session — fail the login so they
        // can retry rather than landing on an empty app.
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Could not load your profile. Check your connection and try again.',
        };
      }

      if (profile.is_disabled) {
        await supabase.auth.signOut();
        return { success: false, error: 'Account disabled. Contact admin.' };
      }

      if (isMountedRef.current) {
        const roleList = deriveRoleList(profile);
        setUser(data.user);
        setRole(roleList[0] || profile?.role || null);
        setRoles(roleList);
        setFullName(profile?.full_name || null);
        setLoading(false);
        console.log('State updated - user:', data.user?.email, 'role:', profile?.role);
      }

      // Record last login timestamp
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {});

      return { success: true };
    } catch (error) {
      console.error('Login error:', error.message);
      return { success: false, error: error.message };
    } finally {
      // Reset the flag after a short delay to ensure any pending listener events are skipped
      setTimeout(() => {
        loginInProgressRef.current = false;
      }, 500);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch(e) {
      console.error("Logout error", e);
    }
    setUser(null);
    setRole(null);
    setRoles([]);
    setFullName(null);
  };

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, roles, is_disabled, full_name')
        .eq('id', user.id)
        .single();

      if (error) return;

      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
        setRoles([]);
        setFullName(null);
        return;
      }

      const roleList = (Array.isArray(profile?.roles) && profile.roles.length > 0)
        ? profile.roles
        : (profile?.role ? [profile.role] : []);
      setRole(roleList[0] || profile?.role || null);
      setRoles(roleList);
      setFullName(profile?.full_name || null);
    } catch (e) {
      console.log('Refresh profile error:', e?.message);
    }
  }, [user?.id]);

  // Debug: Log current state
  console.log('AuthContext render - user:', user?.email, 'role:', role, 'loading:', loading);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAuthenticated: !!user,
      roles,
      isAdmin: roles.includes('admin'),
      isGeneralManager: roles.includes('general_manager'),
      isSalesManager: roles.includes('sales_manager'),
      isPurchaseManager: roles.includes('purchase_manager'),
      isProductionManager: roles.includes('production_manager'),
      fullName,
      loading,
      login,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
