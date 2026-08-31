import React, { createContext, useContext, useMemo, useRef } from 'react';

const RefreshBusContext = createContext({
  emitRefresh: () => {},
  subscribe: () => () => {},
});

export const RefreshBusProvider = ({ children }) => {
  const listenersRef = useRef(new Map());

  const emitRefresh = (domain) => {
    if (!domain) return;
    const listeners = listenersRef.current.get(domain);
    if (!listeners) return;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  };

  const subscribe = (domain, fn) => {
    if (!domain || typeof fn !== 'function') return () => {};
    if (!listenersRef.current.has(domain)) {
      listenersRef.current.set(domain, new Set());
    }
    const set = listenersRef.current.get(domain);
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  };

  const value = useMemo(() => ({ emitRefresh, subscribe }), []);

  return (
    <RefreshBusContext.Provider value={value}>
      {children}
    </RefreshBusContext.Provider>
  );
};

export const useRefreshBus = () => {
  const ctx = useContext(RefreshBusContext);
  if (!ctx) {
    throw new Error('useRefreshBus must be used within RefreshBusProvider');
  }
  return ctx;
};
