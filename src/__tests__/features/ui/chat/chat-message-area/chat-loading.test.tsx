// ABOUTME: Test suite for ChatLoading component
// ABOUTME: Tests loading indicator display and styling in chat context
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChatLoading } from '@/features/ui/chat/chat-message-area/chat-loading'

// Mock the LoadingIndicator component
jest.mock('@/features/ui/loading', () => ({
  LoadingIndicator: jest.fn(({ isLoading }) => (
    isLoading ? <div data-testid="loading-indicator">Loading...</div> : null
  ))
}))

describe('ChatLoading', () => {
  const { LoadingIndicator } = require('@/features/ui/loading')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render loading indicator', () => {
      render(<ChatLoading />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should pass isLoading=true to LoadingIndicator', () => {
      render(<ChatLoading />)
      
      expect(LoadingIndicator).toHaveBeenCalledWith(
        { isLoading: true },
        expect.any(Object)
      )
    })

    it('should render LoadingIndicator component', () => {
      render(<ChatLoading />)
      
      expect(LoadingIndicator).toHaveBeenCalledTimes(1)
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper container styling', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      expect(loadingContainer).toHaveClass('flex', 'justify-center', 'p-8')
    })

    it('should center the loading indicator', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      expect(loadingContainer).toHaveClass('justify-center')
    })

    it('should have proper padding', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      expect(loadingContainer).toHaveClass('p-8')
    })

    it('should use flex layout', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      expect(loadingContainer).toHaveClass('flex')
    })
  })

  describe('Component Integration', () => {
    it('should integrate with LoadingIndicator properly', () => {
      render(<ChatLoading />)
      
      // Verify the LoadingIndicator was called with correct props
      expect(LoadingIndicator).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: true
        }),
        expect.any(Object)
      )
    })

    it('should render in chat message context', () => {
      render(
        <div data-testid="chat-messages">
          <div>Previous message</div>
          <ChatLoading />
          <div>Next message placeholder</div>
        </div>
      )
      
      const chatMessages = screen.getByTestId('chat-messages')
      const loadingIndicator = screen.getByTestId('loading-indicator')
      
      expect(chatMessages).toContainElement(loadingIndicator)
    })
  })

  describe('Accessibility', () => {
    it('should be accessible for screen readers', () => {
      render(<ChatLoading />)
      
      // The loading text should be available to screen readers
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should work with ARIA labels if needed', () => {
      render(
        <div aria-label="Chat loading status">
          <ChatLoading />
        </div>
      )
      
      const container = screen.getByLabelText('Chat loading status')
      expect(container).toContainElement(screen.getByTestId('loading-indicator'))
    })
  })

  describe('Visual Consistency', () => {
    it('should provide consistent spacing in chat flow', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      // p-8 provides consistent spacing with other chat elements
      expect(loadingContainer).toHaveClass('p-8')
    })

    it('should center loading indicator for better UX', () => {
      const { container } = render(<ChatLoading />)
      const loadingContainer = container.firstChild
      
      expect(loadingContainer).toHaveClass('flex', 'justify-center')
    })
  })

  describe('Performance Considerations', () => {
    it('should render efficiently without props', () => {
      const { rerender } = render(<ChatLoading />)
      
      expect(LoadingIndicator).toHaveBeenCalledTimes(1)
      
      // Re-render should work without issues
      rerender(<ChatLoading />)
      expect(LoadingIndicator).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle multiple instances', () => {
      render(
        <div>
          <ChatLoading />
          <ChatLoading />
        </div>
      )
      
      const loadingIndicators = screen.getAllByTestId('loading-indicator')
      expect(loadingIndicators).toHaveLength(2)
      expect(LoadingIndicator).toHaveBeenCalledTimes(2)
    })

    it('should render consistently', () => {
      const { container, rerender } = render(<ChatLoading />)
      const initialHTML = container.innerHTML
      
      rerender(<ChatLoading />)
      expect(container.innerHTML).toBe(initialHTML)
    })
  })

  describe('Integration with Chat System', () => {
    it('should work in typical chat loading scenario', () => {
      render(
        <div data-testid="chat-interface">
          <div data-testid="user-message">User: Hello</div>
          <ChatLoading />
        </div>
      )
      
      expect(screen.getByTestId('user-message')).toBeInTheDocument()
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('should maintain proper DOM structure', () => {
      const { container } = render(<ChatLoading />)
      
      expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
      expect(container.firstChild?.firstChild).toEqual(screen.getByTestId('loading-indicator'))
    })
  })
})