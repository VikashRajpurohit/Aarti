import { useCallback, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useRefreshBus } from '../context/RefreshBusContext';

export const useRefreshOnFocus = (refreshFn, deps = [], domain, refreshSignal) => {
  const isFocused = useIsFocused();
  const { subscribe } = useRefreshBus();

  const safeRefresh = useCallback(() => {
    if (typeof refreshFn === 'function') {
      refreshFn();
    }
  }, deps);

  useEffect(() => {
    if (isFocused) {
      safeRefresh();
    }
  }, [isFocused, safeRefresh]);

  useEffect(() => {
    if (refreshSignal === undefined) return;
    if (isFocused) {
      safeRefresh();
    }
  }, [refreshSignal, isFocused, safeRefresh]);

  useEffect(() => {
    if (!domain) return undefined;
    return subscribe(domain, () => {
      if (isFocused) safeRefresh();
    });
  }, [domain, isFocused, safeRefresh, subscribe]);
};
