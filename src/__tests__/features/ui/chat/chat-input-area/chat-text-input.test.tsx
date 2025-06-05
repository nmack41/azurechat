// ABOUTME: Test suite for ChatTextInput component
// ABOUTME: Tests textarea functionality, refs, props, and accessibility
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatTextInput } from '@/ui/chat/chat-input-area/chat-text-input'

describe('ChatTextInput', () => {
  describe('Basic Rendering', () => {
    it('should render textarea element', () => {
      render(<ChatTextInput />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('should have default placeholder text', () => {
      render(<ChatTextInput />)
      
      expect(screen.getByPlaceholderText('Type your message here...')).toBeInTheDocument()
    })

    it('should have proper CSS classes', () => {
      render(<ChatTextInput data-testid="chat-input" />)
      
      const textarea = screen.getByTestId('chat-input')
      expect(textarea).toHaveClass('p-4', 'w-full', 'focus:outline-none', 'bg-transparent', 'resize-none')
    })
  })

  describe('Ref Forwarding', () => {
    it('should forward ref to textarea element', () => {
      const ref = React.createRef<HTMLTextAreaElement>()
      render(<ChatTextInput ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })

    it('should allow ref-based manipulation', () => {
      const ref = React.createRef<HTMLTextAreaElement>()
      render(<ChatTextInput ref={ref} />)
      
      // Focus via ref
      ref.current?.focus()
      expect(ref.current).toEqual(document.activeElement)

      // Set value via ref
      if (ref.current) {
        ref.current.value = 'Test via ref'
        expect(ref.current.value).toBe('Test via ref')
      }
    })
  })

  describe('Props Handling', () => {
    it('should accept and apply custom placeholder', () => {
      render(<ChatTextInput placeholder="Enter your question..." />)
      
      expect(screen.getByPlaceholderText('Enter your question...')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Type your message here...')).not.toBeInTheDocument()
    })

    it('should accept and apply value prop', () => {
      render(<ChatTextInput value="Test message" readOnly />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Test message')
    })

    it('should accept and apply defaultValue prop', () => {
      render(<ChatTextInput defaultValue="Default message" />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Default message')
    })

    it('should accept custom className (overrides default)', () => {
      render(<ChatTextInput className="custom-class" data-testid="input" />)
      
      const textarea = screen.getByTestId('input')
      // The way the component is implemented, props are spread after className
      // so custom className overrides the default
      expect(textarea).toHaveClass('custom-class')
    })

    it('should accept and apply rows prop', () => {
      render(<ChatTextInput rows={5} data-testid="input" />)
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toHaveAttribute('rows', '5')
    })

    it('should accept and apply disabled prop', () => {
      render(<ChatTextInput disabled />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('should accept and apply required prop', () => {
      render(<ChatTextInput required data-testid="input" />)
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toBeRequired()
    })

    it('should accept and apply maxLength prop', () => {
      render(<ChatTextInput maxLength={100} data-testid="input" />)
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toHaveAttribute('maxLength', '100')
    })
  })

  describe('Event Handling', () => {
    it('should handle onChange events', async () => {
      const user = userEvent.setup()
      const handleChange = jest.fn()
      render(<ChatTextInput onChange={handleChange} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')
      
      expect(handleChange).toHaveBeenCalled()
      expect(textarea).toHaveValue('Hello')
    })

    it('should handle onKeyDown events', () => {
      const handleKeyDown = jest.fn()
      render(<ChatTextInput onKeyDown={handleKeyDown} />)
      
      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
      
      expect(handleKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'Enter',
          code: 'Enter'
        })
      )
    })

    it('should handle onFocus and onBlur events', () => {
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()
      render(<ChatTextInput onFocus={handleFocus} onBlur={handleBlur} />)
      
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      expect(handleFocus).toHaveBeenCalled()
      
      fireEvent.blur(textarea)
      expect(handleBlur).toHaveBeenCalled()
    })

    it('should handle onPaste events', () => {
      const handlePaste = jest.fn()
      render(<ChatTextInput onPaste={handlePaste} />)
      
      const textarea = screen.getByRole('textbox')
      fireEvent.paste(textarea, {
        clipboardData: {
          getData: () => 'pasted text'
        }
      })
      
      expect(handlePaste).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should be accessible by default', () => {
      render(<ChatTextInput />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
    })

    it('should accept aria-label prop', () => {
      render(<ChatTextInput aria-label="Chat message input" />)
      
      const textarea = screen.getByRole('textbox', { name: 'Chat message input' })
      expect(textarea).toBeInTheDocument()
    })

    it('should accept aria-describedby prop', () => {
      render(
        <>
          <ChatTextInput aria-describedby="help-text" data-testid="input" />
          <div id="help-text">Enter your message</div>
        </>
      )
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('should accept name prop for form integration', () => {
      render(<ChatTextInput name="message" data-testid="input" />)
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toHaveAttribute('name', 'message')
    })
  })

  describe('Form Integration', () => {
    it('should work within a form', () => {
      const handleSubmit = jest.fn((e) => e.preventDefault())
      render(
        <form onSubmit={handleSubmit}>
          <ChatTextInput name="message" required />
          <button type="submit">Submit</button>
        </form>
      )
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button')
      
      // Fill in the textarea to satisfy the required validation
      fireEvent.change(textarea, { target: { value: 'test message' } })
      fireEvent.click(button)
      expect(handleSubmit).toHaveBeenCalled()
    })

    it('should support form validation', () => {
      render(
        <form>
          <ChatTextInput name="message" required minLength={5} data-testid="input" />
        </form>
      )
      
      const textarea = screen.getByTestId('input')
      expect(textarea).toHaveAttribute('required')
      expect(textarea).toHaveAttribute('minLength', '5')
    })
  })

  describe('Display Name', () => {
    it('should have correct display name', () => {
      expect(ChatTextInput.displayName).toBe('ChatTextInput')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty value gracefully', () => {
      render(<ChatTextInput value="" readOnly />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('')
    })

    it('should handle null/undefined props gracefully', () => {
      render(<ChatTextInput placeholder={undefined} />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
    })

    it('should handle very long text', async () => {
      const user = userEvent.setup()
      const longText = 'a'.repeat(1000)
      render(<ChatTextInput />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, longText)
      
      expect(textarea).toHaveValue(longText)
    })
  })
})