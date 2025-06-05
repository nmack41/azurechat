// ABOUTME: Tests for AppErrorBoundary component and catastrophic error handling
// ABOUTME: Validates error catching, fallback UI, and recovery actions

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppErrorBoundary } from '@/ui/error-boundary/app-error-boundary';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock window.location
const mockReload = jest.fn();
const mockAssign = jest.fn();

const mockLocation = {
  reload: mockReload,
  assign: mockAssign,
  href: 'http://localhost:3000/test',
  origin: 'http://localhost:3000',
  pathname: '/test',
};

// Mock alert
window.alert = jest.fn();

describe('AppErrorBoundary', () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error message');
    }
    return <div data-testid="normal-content">Normal content</div>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AppErrorBoundary>
    );

    expect(screen.getByTestId('normal-content')).toBeInTheDocument();
    expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
  });

  it('catches and displays error with fallback UI', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText(/The application encountered an unexpected error/)).toBeInTheDocument();
    expect(screen.getByText(/We're sorry, but something went wrong/)).toBeInTheDocument();
    expect(screen.queryByTestId('normal-content')).not.toBeInTheDocument();
  });

  it('displays error reference ID when error occurs', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Error Reference:')).toBeInTheDocument();
    // Error ID should be present and follow timestamp-random format
    const errorIdElement = screen.getByText(/^\d{13}-[a-z0-9]+$/);
    expect(errorIdElement).toBeInTheDocument();
  });

  it('provides retry functionality', () => {
    const { rerender } = render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeEnabled();

    // Click retry - should reset error boundary
    fireEvent.click(retryButton);

    // Rerender with no error - should show normal content
    rerender(
      <AppErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AppErrorBoundary>
    );

    expect(screen.getByTestId('normal-content')).toBeInTheDocument();
  });

  it('disables retry after maximum attempts', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    
    // First retry
    fireEvent.click(retryButton);
    expect(retryButton).toBeEnabled();
    
    // Second retry (last one allowed)
    fireEvent.click(retryButton);
    
    // Button should now be disabled and text changed
    expect(screen.getByText('Max Retries Reached')).toBeDisabled();
  });

  it('provides page reload functionality', () => {
    // Mock reload function before render
    const originalReload = window.location.reload;
    window.location.reload = mockReload;

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const reloadButton = screen.getByText('Reload Page');
    fireEvent.click(reloadButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
    
    // Restore original function
    window.location.reload = originalReload;
  });

  it('provides home navigation functionality', () => {
    // Mock the href setter directly
    const mockHrefSetter = jest.fn();
    Object.defineProperty(window.location, 'href', {
      set: mockHrefSetter,
      configurable: true,
    });

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const homeButton = screen.getByText('Go Home');
    fireEvent.click(homeButton);

    expect(mockHrefSetter).toHaveBeenCalledWith('/');
  });

  it('copies error report to clipboard', async () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const copyButton = screen.getByText('Copy Error Report');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    const copiedData = JSON.parse(
      (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]
    );

    expect(copiedData).toMatchObject({
      errorId: expect.stringMatching(/^\d{13}-[a-z0-9]+$/),
      timestamp: expect.any(String),
      userAgent: expect.any(String),
      url: expect.any(String),
      error: {
        name: 'Error',
        message: 'Test error message',
        stack: expect.any(String),
      },
    });

    expect(window.alert).toHaveBeenCalledWith('Error report copied to clipboard');
  });

  it('handles clipboard copy failure gracefully', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Clipboard error')
    );

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const copyButton = screen.getByText('Copy Error Report');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to copy error report:',
        expect.any(Error)
      );
    });
  });

  it('shows development error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('🛠️ Development Error Details')).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(screen.getByText('🛠️ Development Error Details'));
    
    expect(screen.getByText('Error Message:')).toBeInTheDocument();
    expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('hides development error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.queryByText('🛠️ Development Error Details')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('provides helpful support links', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/support');
    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('link', { name: 'System Status' })).toHaveAttribute('href', '/status');
  });

  it('maintains error state across re-renders', () => {
    const { rerender } = render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Application Error')).toBeInTheDocument();

    // Re-render with same error
    rerender(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    // Should still show error UI
    expect(screen.getByText('Application Error')).toBeInTheDocument();
  });

  it('logs errors for monitoring purposes', () => {
    const consoleSpy = jest.spyOn(console, 'error');
    
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
  });
});