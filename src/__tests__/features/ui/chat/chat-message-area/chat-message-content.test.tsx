// ABOUTME: Test suite for ChatMessageContentArea component
// ABOUTME: Tests message content area rendering, ref forwarding, and layout
import React from 'react'
import { render, screen } from '@testing-library/react'
import ChatMessageContentArea from '@/ui/chat/chat-message-area/chat-message-content'

describe('ChatMessageContentArea', () => {
  describe('Basic Rendering', () => {
    it('should render with children', () => {
      render(
        <ChatMessageContentArea>
          <div data-testid="message-1">Hello</div>
          <div data-testid="message-2">World</div>
        </ChatMessageContentArea>
      )
      
      expect(screen.getByTestId('message-1')).toBeInTheDocument()
      expect(screen.getByTestId('message-2')).toBeInTheDocument()
    })

    it('should render without children', () => {
      const { container } = render(<ChatMessageContentArea />)
      
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should have proper CSS classes for layout', () => {
      render(<ChatMessageContentArea data-testid="content-area" />)
      
      const contentArea = screen.getByTestId('content-area')
      expect(contentArea).toHaveClass(
        'container',
        'max-w-3xl',
        'relative',
        'min-h-screen',
        'pb-[240px]',
        'pt-16',
        'flex',
        'flex-col',
        'gap-16'
      )
    })
  })

  describe('Ref Forwarding', () => {
    it('should forward ref to div element', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<ChatMessageContentArea ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('should allow ref-based manipulation', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<ChatMessageContentArea ref={ref} />)
      
      // Should be able to access div properties
      expect(ref.current?.tagName).toBe('DIV')
      
      // Should be able to modify properties via ref
      if (ref.current) {
        ref.current.scrollTop = 100
        expect(ref.current.scrollTop).toBe(100)
      }
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper container styling', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('container', 'max-w-3xl')
    })

    it('should have proper spacing and positioning', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('relative', 'min-h-screen', 'pb-[240px]', 'pt-16')
    })

    it('should have flex layout with proper gap', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('flex', 'flex-col', 'gap-16')
    })
  })

  describe('Content Organization', () => {
    it('should maintain proper order of children', () => {
      render(
        <ChatMessageContentArea data-testid="content-area">
          <div data-testid="first">First message</div>
          <div data-testid="second">Second message</div>
          <div data-testid="third">Third message</div>
        </ChatMessageContentArea>
      )
      
      const contentArea = screen.getByTestId('content-area')
      const children = Array.from(contentArea.children)
      
      expect(children[0]).toHaveAttribute('data-testid', 'first')
      expect(children[1]).toHaveAttribute('data-testid', 'second')
      expect(children[2]).toHaveAttribute('data-testid', 'third')
    })

    it('should handle mixed content types', () => {
      render(
        <ChatMessageContentArea>
          <div data-testid="text-message">Text message</div>
          <img data-testid="image-message" src="/test.jpg" alt="test" />
          <button data-testid="action-button">Action</button>
        </ChatMessageContentArea>
      )
      
      expect(screen.getByTestId('text-message')).toBeInTheDocument()
      expect(screen.getByTestId('image-message')).toBeInTheDocument()
      expect(screen.getByTestId('action-button')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should be accessible as a generic container', () => {
      render(<ChatMessageContentArea aria-label="Chat messages" />)
      
      const container = screen.getByLabelText('Chat messages')
      expect(container).toBeInTheDocument()
    })

    it('should support ARIA attributes', () => {
      render(
        <ChatMessageContentArea 
          role="main" 
          aria-label="Chat conversation"
          data-testid="content"
        />
      )
      
      const content = screen.getByTestId('content')
      expect(content).toHaveAttribute('role', 'main')
      expect(content).toHaveAttribute('aria-label', 'Chat conversation')
    })
  })

  describe('Responsive Behavior', () => {
    it('should have responsive container styling', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      // The container class should provide responsive behavior
      expect(content).toHaveClass('container')
      // Max width should be constrained for readability
      expect(content).toHaveClass('max-w-3xl')
    })
  })

  describe('Scrolling Behavior', () => {
    it('should provide proper padding for scrolling context', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      // Bottom padding should provide space for input area
      expect(content).toHaveClass('pb-[240px]')
      // Top padding should provide space for header
      expect(content).toHaveClass('pt-16')
    })

    it('should have minimum height for proper scrolling', () => {
      render(<ChatMessageContentArea data-testid="content" />)
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('min-h-screen')
    })
  })

  describe('Integration Tests', () => {
    it('should work with complex message structures', () => {
      render(
        <ChatMessageContentArea data-testid="chat-area">
          <div className="message-group">
            <div data-testid="user-message">User: Hello</div>
            <div data-testid="ai-message">AI: Hi there!</div>
          </div>
          <div className="message-group">
            <div data-testid="user-follow-up">User: How are you?</div>
            <div data-testid="ai-response">AI: I'm doing well!</div>
          </div>
        </ChatMessageContentArea>
      )
      
      const chatArea = screen.getByTestId('chat-area')
      expect(chatArea).toBeInTheDocument()
      expect(screen.getByTestId('user-message')).toBeInTheDocument()
      expect(screen.getByTestId('ai-message')).toBeInTheDocument()
      expect(screen.getByTestId('user-follow-up')).toBeInTheDocument()
      expect(screen.getByTestId('ai-response')).toBeInTheDocument()
    })

    it('should maintain proper spacing between message groups', () => {
      render(
        <ChatMessageContentArea data-testid="content">
          <div>Group 1</div>
          <div>Group 2</div>
        </ChatMessageContentArea>
      )
      
      const content = screen.getByTestId('content')
      // gap-16 should provide proper spacing between children
      expect(content).toHaveClass('gap-16')
    })
  })
})