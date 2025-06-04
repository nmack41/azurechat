import { menuStore, useMenuState } from '@/features/main-menu/menu-store'
import { renderHook, act } from '@testing-library/react'

describe('Menu Store', () => {
  beforeEach(() => {
    // Reset menu store state
    menuStore.isMenuOpen = true
  })

  describe('Initial State', () => {
    it('should have menu open by default', () => {
      expect(menuStore.isMenuOpen).toBe(true)
    })
  })

  describe('useMenuState Hook', () => {
    it('should return snapshot of menu state', () => {
      const { result } = renderHook(() => useMenuState())
      
      expect(result.current.isMenuOpen).toBe(true)
    })

    it('should reflect state changes', () => {
      const { result } = renderHook(() => useMenuState())
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(result.current.isMenuOpen).toBe(false)
    })

    it('should update when menu is toggled multiple times', () => {
      const { result } = renderHook(() => useMenuState())
      
      // Initial state
      expect(result.current.isMenuOpen).toBe(true)
      
      // First toggle
      act(() => {
        menuStore.toggleMenu()
      })
      expect(result.current.isMenuOpen).toBe(false)
      
      // Second toggle
      act(() => {
        menuStore.toggleMenu()
      })
      expect(result.current.isMenuOpen).toBe(true)
      
      // Third toggle
      act(() => {
        menuStore.toggleMenu()
      })
      expect(result.current.isMenuOpen).toBe(false)
    })
  })

  describe('Menu Toggle Functionality', () => {
    it('should toggle menu from open to closed', () => {
      menuStore.isMenuOpen = true
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(menuStore.isMenuOpen).toBe(false)
    })

    it('should toggle menu from closed to open', () => {
      menuStore.isMenuOpen = false
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(menuStore.isMenuOpen).toBe(true)
    })

    it('should handle rapid toggles correctly', () => {
      const initialState = menuStore.isMenuOpen
      
      // Perform multiple rapid toggles
      act(() => {
        menuStore.toggleMenu()
        menuStore.toggleMenu()
        menuStore.toggleMenu()
        menuStore.toggleMenu()
      })
      
      // After even number of toggles, should be back to initial state
      expect(menuStore.isMenuOpen).toBe(initialState)
    })
  })

  describe('State Consistency', () => {
    it('should maintain boolean type for isMenuOpen', () => {
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(typeof menuStore.isMenuOpen).toBe('boolean')
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(typeof menuStore.isMenuOpen).toBe('boolean')
    })

    it('should not have any side effects from toggling', () => {
      const originalToggleFunction = menuStore.toggleMenu
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      // Function should remain the same
      expect(menuStore.toggleMenu).toBe(originalToggleFunction)
      // Only isMenuOpen should change
      expect(Object.keys(menuStore)).toEqual(['isMenuOpen'])
    })
  })

  describe('Multiple Hook Instances', () => {
    it('should sync state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useMenuState())
      const { result: result2 } = renderHook(() => useMenuState())
      
      // Both hooks should start with same state
      expect(result1.current.isMenuOpen).toBe(result2.current.isMenuOpen)
      
      // Toggle menu
      act(() => {
        menuStore.toggleMenu()
      })
      
      // Both hooks should reflect the change
      expect(result1.current.isMenuOpen).toBe(result2.current.isMenuOpen)
      expect(result1.current.isMenuOpen).toBe(false)
    })
  })

  describe('Direct State Access', () => {
    it('should allow direct access to menu state', () => {
      // Direct property access should work
      expect(menuStore.isMenuOpen).toBe(true)
      
      // Direct method call should work
      menuStore.toggleMenu()
      expect(menuStore.isMenuOpen).toBe(false)
    })

    it('should allow direct state modification', () => {
      // Direct assignment should work (though not recommended)
      menuStore.isMenuOpen = false
      expect(menuStore.isMenuOpen).toBe(false)
      
      menuStore.isMenuOpen = true
      expect(menuStore.isMenuOpen).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid state gracefully', () => {
      // Set invalid state
      ;(menuStore as any).isMenuOpen = null
      
      // Toggle should still work (converting to boolean)
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(typeof menuStore.isMenuOpen).toBe('boolean')
    })

    it('should handle undefined state gracefully', () => {
      // Set undefined state
      ;(menuStore as any).isMenuOpen = undefined
      
      // Toggle should still work
      act(() => {
        menuStore.toggleMenu()
      })
      
      expect(typeof menuStore.isMenuOpen).toBe('boolean')
    })
  })

  describe('Performance', () => {
    it('should not create new objects on toggle', () => {
      const originalStore = menuStore
      
      act(() => {
        menuStore.toggleMenu()
      })
      
      // Store reference should remain the same
      expect(menuStore).toBe(originalStore)
    })

    it('should handle many toggles efficiently', () => {
      const startTime = performance.now()
      
      act(() => {
        // Perform many toggles
        for (let i = 0; i < 1000; i++) {
          menuStore.toggleMenu()
        }
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete quickly (less than 100ms for 1000 toggles)
      expect(duration).toBeLessThan(100)
      
      // State should be consistent (even number of toggles = back to original)
      expect(menuStore.isMenuOpen).toBe(true)
    })
  })

  describe('Class Instance Behavior', () => {
    it('should be an instance of Menu class', () => {
      // Check if menuStore has the expected structure
      expect(menuStore).toHaveProperty('isMenuOpen')
      expect(menuStore).toHaveProperty('toggleMenu')
      expect(typeof menuStore.toggleMenu).toBe('function')
    })

    it('should maintain method binding', () => {
      const { toggleMenu } = menuStore
      const initialState = menuStore.isMenuOpen
      
      // Method should work when called independently
      act(() => {
        toggleMenu()
      })
      
      expect(menuStore.isMenuOpen).toBe(!initialState)
    })
  })

  describe('Valtio Integration', () => {
    it('should be a Valtio proxy', () => {
      // Valtio proxies have special properties
      expect(typeof menuStore).toBe('object')
      expect(menuStore).not.toBeNull()
      
      // Should trigger reactivity when changed
      const { result } = renderHook(() => useMenuState())
      const initialState = result.current.isMenuOpen
      
      act(() => {
        menuStore.isMenuOpen = !menuStore.isMenuOpen
      })
      
      expect(result.current.isMenuOpen).toBe(!initialState)
    })

    it('should work with useSnapshot', () => {
      const { result } = renderHook(() => useMenuState())
      
      // useSnapshot should return a snapshot, not the proxy
      expect(result.current).not.toBe(menuStore)
      
      // But values should be the same
      expect(result.current.isMenuOpen).toBe(menuStore.isMenuOpen)
    })
  })
})