// ABOUTME: Test suite for chat input dynamic height functionality
// ABOUTME: Tests row management, keyboard events, and state management
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import {
  useChatInputDynamicHeight,
  SetInputRows,
  SetInputRowsToMax,
  ResetInputRows,
  onKeyDown,
  onKeyUp,
  chatInputState,
} from '@/features/chat-page/chat-input/use-chat-input-dynamic-height'

// Mock keyboard event
const createMockKeyboardEvent = (key: string, options: Partial<React.KeyboardEvent> = {}) => ({
  key,
  nativeEvent: { isComposing: false },
  preventDefault: jest.fn(),
  ...options,
} as React.KeyboardEvent<HTMLTextAreaElement>)

describe('useChatInputDynamicHeight', () => {
  beforeEach(() => {
    // Reset state before each test
    chatInputState.rows = 1
    chatInputState.keysPressed.clear()
  })

  describe('Initial State', () => {
    it('should have initial rows set to 1', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      expect(result.current.rows).toBe(1)
    })

    it('should have empty keysPressed set initially', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      expect(result.current.keysPressed.size).toBe(0)
    })
  })

  describe('SetInputRows', () => {
    it('should increment rows when below max', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(result.current.rows) // Pass current rows
      })
      
      expect(result.current.rows).toBe(2)
    })

    it('should increment multiple times when below max', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(result.current.rows) // 1 -> 2
      })
      
      act(() => {
        SetInputRows(result.current.rows) // 2 -> 3
      })
      
      act(() => {
        SetInputRows(result.current.rows) // 3 -> 4
      })
      
      expect(result.current.rows).toBe(4)
    })

    it('should not exceed max rows (6)', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(6) // Should not increment when >= 6
      })
      
      expect(result.current.rows).toBe(1) // Should remain at initial
    })

    it('should handle edge case at max-1', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      // Set to 5 first
      act(() => {
        SetInputRows(4) // 4 + 1 = 5, which is < 6
      })
      
      expect(result.current.rows).toBe(5)
      
      act(() => {
        SetInputRows(result.current.rows) // 5 + 1 = 6, which is not < 6
      })
      
      expect(result.current.rows).toBe(5) // Should not change
    })
  })

  describe('SetInputRowsToMax', () => {
    it('should set rows to maximum (6)', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRowsToMax()
      })
      
      // Check both the hook result and direct state access
      expect(chatInputState.rows).toBe(6)
      expect(result.current.rows).toBe(6)
    })

    it('should set to max from any starting value', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(2) // Set to 3
        SetInputRowsToMax()
      })
      
      expect(result.current.rows).toBe(6)
    })
  })

  describe('ResetInputRows', () => {
    it('should reset rows to 1', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRowsToMax()
        ResetInputRows()
      })
      
      expect(result.current.rows).toBe(1)
    })

    it('should reset from any value', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(3)
        ResetInputRows()
      })
      
      expect(result.current.rows).toBe(1)
    })
  })

  describe('Keyboard Event Handling', () => {
    describe('onKeyDown', () => {
      it('should add key to keysPressed set', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        })
        
        expect(result.current.keysPressed.has('Enter')).toBe(true)
      })

      it('should increase rows on Shift+Enter', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
          onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        })
        
        expect(result.current.rows).toBe(2)
        expect(mockSubmit).not.toHaveBeenCalled()
      })

      it('should submit on Enter without Shift', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        const mockEvent = createMockKeyboardEvent('Enter')
        
        act(() => {
          onKeyDown(mockEvent, mockSubmit)
        })
        
        expect(mockSubmit).toHaveBeenCalled()
        expect(result.current.rows).toBe(1) // Should reset
        expect(mockEvent.preventDefault).toHaveBeenCalled()
      })

      it('should not submit during composition', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        const mockEvent = createMockKeyboardEvent('Enter', {
          nativeEvent: { isComposing: true }
        })
        
        act(() => {
          onKeyDown(mockEvent, mockSubmit)
        })
        
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      })

      it('should handle multiple keys pressed', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Control'), mockSubmit)
          onKeyDown(createMockKeyboardEvent('c'), mockSubmit)
        })
        
        expect(result.current.keysPressed.has('Control')).toBe(true)
        expect(result.current.keysPressed.has('c')).toBe(true)
      })

      it('should not submit with Shift+Enter combination', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
          onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        })
        
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(result.current.rows).toBe(2)
      })
    })

    describe('onKeyUp', () => {
      it('should remove key from keysPressed set', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        })
        
        expect(result.current.keysPressed.has('Enter')).toBe(true)
        
        act(() => {
          onKeyUp(createMockKeyboardEvent('Enter'))
        })
        
        expect(result.current.keysPressed.has('Enter')).toBe(false)
      })

      it('should handle multiple keys being released', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
          onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        })
        
        expect(result.current.keysPressed.size).toBe(2)
        
        act(() => {
          onKeyUp(createMockKeyboardEvent('Shift'))
          onKeyUp(createMockKeyboardEvent('Enter'))
        })
        
        expect(result.current.keysPressed.size).toBe(0)
      })

      it('should not affect rows count', () => {
        const { result } = renderHook(() => useChatInputDynamicHeight())
        const mockSubmit = jest.fn()
        
        act(() => {
          SetInputRows(2)
        })
        
        const initialRows = result.current.rows
        
        act(() => {
          onKeyUp(createMockKeyboardEvent('Enter'))
        })
        
        expect(result.current.rows).toBe(initialRows)
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete Shift+Enter, then Enter sequence', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      const mockSubmit = jest.fn()
      
      // Shift+Enter (add new line)
      act(() => {
        onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
        onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
      })
      
      expect(result.current.rows).toBe(2)
      expect(mockSubmit).not.toHaveBeenCalled()
      
      // Release keys
      act(() => {
        onKeyUp(createMockKeyboardEvent('Shift'))
        onKeyUp(createMockKeyboardEvent('Enter'))
      })
      
      // Enter alone (submit)
      act(() => {
        onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
      })
      
      expect(mockSubmit).toHaveBeenCalled()
      expect(result.current.rows).toBe(1) // Reset after submit
    })

    it('should maintain state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useChatInputDynamicHeight())
      const { result: result2 } = renderHook(() => useChatInputDynamicHeight())
      
      act(() => {
        SetInputRows(3)
      })
      
      expect(result1.current.rows).toBe(result2.current.rows)
      expect(result1.current.rows).toBe(4)
    })

    it('should handle rapid key sequences', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      const mockSubmit = jest.fn()
      
      act(() => {
        // Rapid sequence of Shift+Enter
        onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
        onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
        onKeyUp(createMockKeyboardEvent('Enter'))
        onKeyUp(createMockKeyboardEvent('Shift'))
        
        onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
        onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
      })
      
      expect(result.current.rows).toBe(3) // Two Shift+Enter sequences
      expect(mockSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle unknown keys gracefully', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      const mockSubmit = jest.fn()
      
      act(() => {
        onKeyDown(createMockKeyboardEvent('F1'), mockSubmit)
        onKeyDown(createMockKeyboardEvent('ArrowUp'), mockSubmit)
      })
      
      expect(result.current.keysPressed.has('F1')).toBe(true)
      expect(result.current.keysPressed.has('ArrowUp')).toBe(true)
      expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('should handle rows at maximum during Shift+Enter', () => {
      const { result } = renderHook(() => useChatInputDynamicHeight())
      const mockSubmit = jest.fn()
      
      act(() => {
        SetInputRowsToMax() // Set to 6
      })
      
      const initialRows = result.current.rows
      
      act(() => {
        onKeyDown(createMockKeyboardEvent('Shift'), mockSubmit)
        onKeyDown(createMockKeyboardEvent('Enter'), mockSubmit)
      })
      
      expect(result.current.rows).toBe(initialRows) // Should not increase beyond max
    })
  })
})