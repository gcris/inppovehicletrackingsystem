import { useState, useEffect, useCallback } from 'react';

interface SidebarState {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

/**
 * Hook to manage sidebar collapse/expand state
 * Persists state in localStorage
 */
export function useSidebar(): SidebarState {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    // Try to get from localStorage, default to false (expanded)
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  // Update localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  return {
    isCollapsed,
    toggleSidebar,
    setCollapsed
  };
}