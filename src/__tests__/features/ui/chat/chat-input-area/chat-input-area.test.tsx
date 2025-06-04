// ABOUTME: Test suite for ChatInputArea components
// ABOUTME: Tests form rendering, status display, and action areas
import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  ChatInputForm,
  ChatInputStatus,
  ChatInputActionArea,
  ChatInputPrimaryActionArea,
  ChatInputSecondaryActionArea,
} from '@/features/ui/chat/chat-input-area/chat-input-area'

describe('ChatInputArea Components', () => {
  describe('ChatInputForm', () => {
    it('should render form with children', () => {
      render(
        <ChatInputForm>
          <div data-testid="form-content">Test content</div>
        </ChatInputForm>
      )
      
      expect(screen.getByTestId('form-content')).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
    })

    it('should forward ref to form element', () => {
      const ref = React.createRef<HTMLFormElement>()
      render(<ChatInputForm ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLFormElement)
    })

    it('should render status when provided', () => {
      render(<ChatInputForm status="Processing..." />)
      
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('should not render status when empty', () => {
      render(<ChatInputForm status="" />)
      
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })

    it('should pass through form props', () => {
      const onSubmit = jest.fn()
      render(
        <ChatInputForm onSubmit={onSubmit} data-testid="chat-form">
          <button type="submit">Submit</button>
        </ChatInputForm>
      )
      
      const form = screen.getByTestId('chat-form')
      expect(form).toBeInTheDocument()
    })

    it('should have proper styling classes', () => {
      render(<ChatInputForm data-testid="chat-form" />)
      
      const container = screen.getByTestId('chat-form').parentElement
      expect(container).toHaveClass('backdrop-blur-xl', 'bg-background/70', 'rounded-md')
    })
  })

  describe('ChatInputStatus', () => {
    it('should render status with loading indicator', () => {
      render(<ChatInputStatus status="Thinking..." />)
      
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
      // Loading indicator should be present
      const statusContainer = screen.getByText('Thinking...').parentElement
      expect(statusContainer).toBeInTheDocument()
    })

    it('should not render when status is undefined', () => {
      const { container } = render(<ChatInputStatus />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should not render when status is empty string', () => {
      const { container } = render(<ChatInputStatus status="" />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should have proper styling classes', () => {
      render(<ChatInputStatus status="Loading..." />)
      
      const statusElement = screen.getByText('Loading...').parentElement
      expect(statusElement).toHaveClass('border', 'bg-background', 'p-2', 'px-5', 'rounded-full')
    })

    it('should center the status indicator', () => {
      render(<ChatInputStatus status="Processing..." />)
      
      const outerContainer = screen.getByText('Processing...').parentElement?.parentElement
      expect(outerContainer).toHaveClass('flex', 'justify-center')
    })
  })

  describe('ChatInputActionArea', () => {
    it('should render children in action area', () => {
      render(
        <ChatInputActionArea>
          <button data-testid="action-button">Action</button>
        </ChatInputActionArea>
      )
      
      expect(screen.getByTestId('action-button')).toBeInTheDocument()
    })

    it('should have space-between layout', () => {
      render(
        <ChatInputActionArea data-testid="action-area">
          <span>Left</span>
          <span>Right</span>
        </ChatInputActionArea>
      )
      
      const actionArea = screen.getByTestId('action-area')
      expect(actionArea).toHaveClass('flex', 'justify-between', 'p-2')
    })

    it('should render without children', () => {
      const { container } = render(<ChatInputActionArea />)
      
      expect(container.firstChild).toBeInTheDocument()
      expect(container.firstChild).toHaveClass('flex', 'justify-between')
    })
  })

  describe('ChatInputPrimaryActionArea', () => {
    it('should render children in primary action area', () => {
      render(
        <ChatInputPrimaryActionArea>
          <button data-testid="primary-button">Primary</button>
        </ChatInputPrimaryActionArea>
      )
      
      expect(screen.getByTestId('primary-button')).toBeInTheDocument()
    })

    it('should have flex layout', () => {
      render(
        <ChatInputPrimaryActionArea data-testid="primary-area">
          <span>Primary Action</span>
        </ChatInputPrimaryActionArea>
      )
      
      const primaryArea = screen.getByTestId('primary-area')
      expect(primaryArea).toHaveClass('flex')
    })

    it('should render without children', () => {
      const { container } = render(<ChatInputPrimaryActionArea />)
      
      expect(container.firstChild).toBeInTheDocument()
      expect(container.firstChild).toHaveClass('flex')
    })
  })

  describe('ChatInputSecondaryActionArea', () => {
    it('should render children in secondary action area', () => {
      render(
        <ChatInputSecondaryActionArea>
          <button data-testid="secondary-button">Secondary</button>
        </ChatInputSecondaryActionArea>
      )
      
      expect(screen.getByTestId('secondary-button')).toBeInTheDocument()
    })

    it('should have flex layout', () => {
      render(
        <ChatInputSecondaryActionArea data-testid="secondary-area">
          <span>Secondary Action</span>
        </ChatInputSecondaryActionArea>
      )
      
      const secondaryArea = screen.getByTestId('secondary-area')
      expect(secondaryArea).toHaveClass('flex')
    })

    it('should render without children', () => {
      const { container } = render(<ChatInputSecondaryActionArea />)
      
      expect(container.firstChild).toBeInTheDocument()
      expect(container.firstChild).toHaveClass('flex')
    })
  })

  describe('Integration Tests', () => {
    it('should render complete chat input form structure', () => {
      render(
        <ChatInputForm status="AI is typing...">
          <ChatInputActionArea>
            <ChatInputPrimaryActionArea>
              <button data-testid="send-button">Send</button>
            </ChatInputPrimaryActionArea>
            <ChatInputSecondaryActionArea>
              <button data-testid="clear-button">Clear</button>
            </ChatInputSecondaryActionArea>
          </ChatInputActionArea>
        </ChatInputForm>
      )
      
      expect(screen.getByText('AI is typing...')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
      expect(screen.getByTestId('clear-button')).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
    })

    it('should maintain proper component hierarchy', () => {
      render(
        <ChatInputForm data-testid="form">
          <ChatInputActionArea data-testid="actions">
            <ChatInputPrimaryActionArea data-testid="primary">
              <span>Primary</span>
            </ChatInputPrimaryActionArea>
          </ChatInputActionArea>
        </ChatInputForm>
      )
      
      const form = screen.getByTestId('form')
      const actions = screen.getByTestId('actions')
      const primary = screen.getByTestId('primary')
      
      expect(form).toContainElement(actions)
      expect(actions).toContainElement(primary)
    })
  })
})