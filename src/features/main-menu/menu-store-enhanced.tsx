// ABOUTME: Enhanced menu store with performance optimizations and persistence
// ABOUTME: Uses optimized Valtio patterns with local storage sync and selective subscriptions

import { proxy, useSnapshot } from "valtio";
import { subscribeKey } from "valtio/utils";
import { 
  OptimizedStoreBase, 
  createDebouncedUpdater,
  OptimizedStoreState 
} from "../common/valtio-patterns/optimized-store-base";

interface EnhancedMenuState extends OptimizedStoreState {
  isMenuOpen: boolean;
  menuWidth: number;
  isCollapsed: boolean;
  lastToggleTime: number;
  userPreferences: {
    rememberState: boolean;
    autoCollapse: boolean;
    collapseThreshold: number; // screen width threshold
  };
}

class EnhancedMenuStore extends OptimizedStoreBase<EnhancedMenuState> {
  private debouncedPersist: (state: EnhancedMenuState) => void;
  private resizeObserver?: ResizeObserver;
  
  constructor() {
    const savedState = typeof window !== 'undefined' ? 
      localStorage.getItem('azurechat-menu-state') : null;
      
    const defaultState: EnhancedMenuState = {
      isMenuOpen: true,
      menuWidth: 280,
      isCollapsed: false,
      lastToggleTime: 0,
      userPreferences: {
        rememberState: true,
        autoCollapse: true,
        collapseThreshold: 768 // Mobile breakpoint
      },
      _lastUpdated: Date.now(),
      _isDirty: false
    };

    const initialState = savedState ? 
      { ...defaultState, ...JSON.parse(savedState) } : 
      defaultState;

    super(proxy(initialState), {
      maxAge: 60 * 60 * 1000, // 1 hour
      autoCleanup: false, // Menu state doesn't need cleanup
      batchInterval: 100 // Slower batching for UI state
    });

    // Create debounced persist function
    this.debouncedPersist = createDebouncedUpdater(
      (state: EnhancedMenuState) => this.persistState(state), 
      500 // 500ms debounce for localStorage writes
    );

    this.initializeResponsiveBehavior();
    this.setupStatePersistence();
  }

  private initializeResponsiveBehavior(): void {
    if (typeof window === 'undefined') return;

    // Setup responsive behavior
    const handleResize = () => {
      const { autoCollapse, collapseThreshold } = this.store.userPreferences;
      if (autoCollapse) {
        const shouldCollapse = window.innerWidth <= collapseThreshold;
        if (shouldCollapse !== this.store.isCollapsed) {
          this.updateProperty('isCollapsed', shouldCollapse);
          if (shouldCollapse) {
            this.updateProperty('isMenuOpen', false);
          }
        }
      }
    };

    // Initial check
    handleResize();

    // Setup resize observer for smooth responsive behavior
    this.resizeObserver = new ResizeObserver(entries => {
      // Throttle resize handling
      clearTimeout((window as any).__menuResizeTimeout);
      (window as any).__menuResizeTimeout = setTimeout(handleResize, 100);
    });

    this.resizeObserver.observe(document.body);

    // Fallback resize listener
    window.addEventListener('resize', handleResize);
  }

  private setupStatePersistence(): void {
    if (typeof window === 'undefined') return;

    // Subscribe to state changes and persist to localStorage
    subscribeKey(this.store, 'isMenuOpen', () => {
      if (this.store.userPreferences.rememberState) {
        this.debouncedPersist(this.store);
      }
    });

    subscribeKey(this.store, 'menuWidth', () => {
      if (this.store.userPreferences.rememberState) {
        this.debouncedPersist(this.store);
      }
    });

    subscribeKey(this.store, 'userPreferences', () => {
      this.debouncedPersist(this.store);
    });
  }

  private persistState(state: EnhancedMenuState): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stateToSave = {
        isMenuOpen: state.isMenuOpen,
        menuWidth: state.menuWidth,
        isCollapsed: state.isCollapsed,
        userPreferences: state.userPreferences
      };
      localStorage.setItem('azurechat-menu-state', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to persist menu state:', error);
    }
  }

  // Public API
  public toggleMenu(): void {
    const now = Date.now();
    const timeSinceLastToggle = now - this.store.lastToggleTime;
    
    // Prevent rapid toggling (debounce)
    if (timeSinceLastToggle < 100) return;

    this.batchUpdate('toggle_menu', () => {
      this.store.isMenuOpen = !this.store.isMenuOpen;
      this.store.lastToggleTime = now;
    });
  }

  public setMenuOpen(isOpen: boolean): void {
    if (this.store.isMenuOpen !== isOpen) {
      this.updateProperty('isMenuOpen', isOpen);
      this.updateProperty('lastToggleTime', Date.now());
    }
  }

  public setMenuWidth(width: number): void {
    // Validate width bounds
    const minWidth = 200;
    const maxWidth = 400;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
    
    if (this.store.menuWidth !== clampedWidth) {
      this.updateProperty('menuWidth', clampedWidth);
    }
  }

  public updateUserPreferences(updates: Partial<EnhancedMenuState['userPreferences']>): void {
    const newPreferences = { ...this.store.userPreferences, ...updates };
    this.updateProperty('userPreferences', newPreferences);
  }

  public resetToDefaults(): void {
    this.mergeProperties({
      isMenuOpen: true,
      menuWidth: 280,
      isCollapsed: false,
      userPreferences: {
        rememberState: true,
        autoCollapse: true,
        collapseThreshold: 768
      }
    });
  }

  // Responsive helpers
  public isMobile(): boolean {
    return typeof window !== 'undefined' && 
           window.innerWidth <= this.store.userPreferences.collapseThreshold;
  }

  public shouldAutoCollapse(): boolean {
    return this.store.userPreferences.autoCollapse && this.isMobile();
  }

  // Cleanup
  public dispose(): void {
    super.dispose();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (typeof window !== 'undefined') {
      clearTimeout((window as any).__menuResizeTimeout);
    }
  }
}

// Create enhanced menu store instance
const enhancedMenuStore = new EnhancedMenuStore();

// Export the store proxy
export const menuStore = enhancedMenuStore.store;

// Enhanced hooks with performance optimizations
export const useMenuState = () => {
  return useSnapshot(menuStore);
};

// Selective hooks for specific menu properties
export const useMenuOpen = () => {
  return useSnapshot(menuStore).isMenuOpen;
};

export const useMenuWidth = () => {
  return useSnapshot(menuStore).menuWidth;
};

export const useMenuCollapsed = () => {
  return useSnapshot(menuStore).isCollapsed;
};

// Enhanced store API
export const menuStoreAPI = {
  toggleMenu: () => enhancedMenuStore.toggleMenu(),
  setMenuOpen: (isOpen: boolean) => enhancedMenuStore.setMenuOpen(isOpen),
  setMenuWidth: (width: number) => enhancedMenuStore.setMenuWidth(width),
  updateUserPreferences: (updates: Partial<EnhancedMenuState['userPreferences']>) => 
    enhancedMenuStore.updateUserPreferences(updates),
  resetToDefaults: () => enhancedMenuStore.resetToDefaults(),
  isMobile: () => enhancedMenuStore.isMobile(),
  shouldAutoCollapse: () => enhancedMenuStore.shouldAutoCollapse(),
  getPerformanceMetrics: () => enhancedMenuStore.getPerformanceMetrics(),
  dispose: () => enhancedMenuStore.dispose()
};

// Auto-collapse on mobile when component mounts
if (typeof window !== 'undefined') {
  const checkInitialCollapse = () => {
    if (menuStoreAPI.shouldAutoCollapse() && menuStore.isMenuOpen) {
      menuStoreAPI.setMenuOpen(false);
    }
  };
  
  // Run check after initial render
  setTimeout(checkInitialCollapse, 100);
}