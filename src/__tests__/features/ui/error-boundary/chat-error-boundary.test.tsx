// ABOUTME: Tests for ChatErrorBoundary component and chat-specific error handling
// ABOUTME: Validates chat interface error catching, recovery options, and user experience

import { render, screen, fireEvent } from '@testing-library/react';
import { ChatErrorBoundary, withChatErrorBoundary, useErrorHandler } from '@/features/ui/error-boundary/chat-error-boundary';

// Mock window.location
const mockReload = jest.fn();
const mockAssign = jest.fn();

const mockLocation = {
  reload: mockReload,
  assign: mockAssign,
  href: 'http://localhost:3000/chat/test-id',
  origin: 'http://localhost:3000',
  pathname: '/chat/test-id',
};

describe('ChatErrorBoundary', () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Chat component error');
    }
    return <div data-testid="chat-content">Chat content</div>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders chat content when no error occurs', () => {
    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ChatErrorBoundary>
    );

    expect(screen.getByTestId('chat-content')).toBeInTheDocument();
    expect(screen.queryByText('Chat Temporarily Unavailable')).not.toBeInTheDocument();
  });

  it('catches and displays chat-specific error with fallback UI', () => {
    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    expect(screen.getByText('Chat Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong with the chat interface/)).toBeInTheDocument();
    expect(screen.getByText(/your conversation history is safe/)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-content')).not.toBeInTheDocument();
  });

  it('displays error reference ID for support', () => {
    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    expect(screen.getByText('Error Reference:')).toBeInTheDocument();
    const errorIdElement = screen.getByText(/^\d{13}-[a-z0-9]+$/);
    expect(errorIdElement).toBeInTheDocument();
    expect(screen.getByText('Share this reference with support if you need help')).toBeInTheDocument();
  });

  it('provides try again functionality with retry limit', () => {
    const { rerender } = render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeEnabled();

    // First retry
    fireEvent.click(retryButton);
    expect(retryButton).toBeEnabled();

    // Second retry
    fireEvent.click(retryButton);
    expect(retryButton).toBeEnabled();

    // Third retry (should disable)
    fireEvent.click(retryButton);
    expect(screen.getByText('Max Retries')).toBeDisabled();

    // Test successful retry by rerendering without error
    rerender(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ChatErrorBoundary>
    );

    expect(screen.getByTestId('chat-content')).toBeInTheDocument();
  });

  it('provides new chat navigation', () => {
    // Mock the href setter directly
    const mockHrefSetter = jest.fn();
    Object.defineProperty(window.location, 'href', {
      set: mockHrefSetter,
      configurable: true,
    });

    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    const newChatButton = screen.getByText('New Chat');
    fireEvent.click(newChatButton);

    expect(mockHrefSetter).toHaveBeenCalledWith('/chat');
  });

  it('provides page refresh functionality', () => {
    // Mock reload function before render
    const originalReload = window.location.reload;
    window.location.reload = mockReload;

    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    const refreshButton = screen.getByText('Refresh Page');
    fireEvent.click(refreshButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
    
    // Restore original function
    window.location.reload = originalReload;
  });

  it('shows development error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    expect(screen.getByText('🛠️ Developer Error Details')).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(screen.getByText('🛠️ Developer Error Details'));
    
    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
    expect(screen.getByText('Chat component error')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('hides development error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    expect(screen.queryByText('🛠️ Developer Error Details')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('provides support contact link', () => {
    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/support');
  });

  it('displays chat-specific recovery options with appropriate icons', () => {
    render(
      <ChatErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ChatErrorBoundary>
    );

    // Check all three recovery options are present
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
  });
});

describe('withChatErrorBoundary HOC', () => {
  const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('HOC wrapped component error');
    }
    return <div data-testid="wrapped-content">Wrapped content</div>;
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wraps component with ChatErrorBoundary', () => {
    const WrappedComponent = withChatErrorBoundary(TestComponent);
    
    render(<WrappedComponent shouldThrow={false} />);
    
    expect(screen.getByTestId('wrapped-content')).toBeInTheDocument();
  });

  it('catches errors in wrapped component', () => {
    const WrappedComponent = withChatErrorBoundary(TestComponent);
    
    render(<WrappedComponent shouldThrow={true} />);
    
    expect(screen.getByText('Chat Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('wrapped-content')).not.toBeInTheDocument();
  });

  it('sets correct display name for wrapped component', () => {
    TestComponent.displayName = 'TestComponent';
    const WrappedComponent = withChatErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withChatErrorBoundary(TestComponent)');
  });

  it('uses component name when displayName is not available', () => {
    const WrappedComponent = withChatErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withChatErrorBoundary(TestComponent)');
  });
});

describe('useErrorHandler hook', () => {
  it('throws error to trigger error boundary', () => {
    const TestComponent = () => {
      const handleError = useErrorHandler();
      
      const triggerError = () => {
        handleError(new Error('Manual error trigger'));
      };

      return (
        <button onClick={triggerError} data-testid="trigger-error">
          Trigger Error
        </button>
      );
    };

    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChatErrorBoundary>
        <TestComponent />
      </ChatErrorBoundary>
    );

    const triggerButton = screen.getByTestId('trigger-error');
    
    expect(() => {
      fireEvent.click(triggerButton);
    }).toThrow('Manual error trigger');

    jest.restoreAllMocks();
  });
});