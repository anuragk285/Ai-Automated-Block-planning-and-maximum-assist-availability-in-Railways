import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePersistedFiltersOptions {
  debounceMs?: number;
}

/**
 * Reusable React hook to persist filter/search state across page navigation
 * and browser reloads using localStorage with namespaced keys.
 */
export function usePersistedFilters<T extends Record<string, any>>(
  storageKey: string,
  defaultFilters: T,
  options?: UsePersistedFiltersOptions
) {
  const debounceMs = options?.debounceMs ?? 250;

  // Initialize from storage or fallback to defaults
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultFilters, ...parsed };
      }
    } catch (e) {
      console.warn(`[usePersistedFilters] Failed to parse ${storageKey}:`, e);
    }
    return defaultFilters;
  });

  // Track latest state in a ref for unmount & beforeunload flushes
  const filtersRef = useRef<T>(filters);
  filtersRef.current = filters;

  // Check if current filter values match default values
  const isDefault = useCallback(
    (current: T) => {
      return Object.keys(defaultFilters).every((key) => current[key] === defaultFilters[key]);
    },
    [defaultFilters]
  );

  const saveToStorage = useCallback(
    (data: T) => {
      try {
        if (isDefault(data)) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      } catch (e) {
        console.warn(`[usePersistedFilters] Failed to write ${storageKey}:`, e);
      }
    },
    [storageKey, isDefault]
  );

  // Debounce writes to localStorage (e.g. for search inputs)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToStorage(filters);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      // Flush latest filters on unmount so tab navigation immediately persists state
      saveToStorage(filtersRef.current);
    };
  }, [filters, debounceMs, saveToStorage]);

  // Flush before page reload / browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveToStorage(filtersRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveToStorage]);

  // Update a single filter field
  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Update multiple filter fields
  const setFilters = useCallback((updater: Partial<T> | ((prev: T) => Partial<T>)) => {
    setFiltersState((prev) => {
      const partial = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...partial };
    });
  }, []);

  // Reset filters to defaults and remove entry from localStorage
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn(`[usePersistedFilters] Failed to remove ${storageKey}:`, e);
    }
  }, [storageKey, defaultFilters]);

  const hasActiveFilters = !isDefault(filters);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
