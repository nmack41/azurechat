// ABOUTME: E2E test for basic chat functionality
// ABOUTME: Tests user can send messages and receive AI responses
import { test, expect } from '@playwright/test';

test.describe('Basic Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // TODO: Add authentication steps when auth is set up
    // For now, assume we land on the chat page or implement mock auth
  });

  test('should display chat interface', async ({ page }) => {
    // Verify main chat elements are present
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should send a basic message', async ({ page }) => {
    const messageText = 'Hello, this is a test message';
    
    // Type message in the input
    await page.locator('[data-testid="chat-input"]').fill(messageText);
    
    // Send the message
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify message appears in chat history
    await expect(page.locator(`text="${messageText}"`)).toBeVisible();
    
    // Verify input is cleared after sending
    await expect(page.locator('[data-testid="chat-input"]')).toHaveValue('');
  });

  test('should receive AI response', async ({ page }) => {
    const messageText = 'What is Azure?';
    
    // Send message
    await page.locator('[data-testid="chat-input"]').fill(messageText);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for AI response (with reasonable timeout)
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 30000 });
    
    // Verify response contains some content
    const responseContent = await page.locator('[data-testid="ai-message"]').textContent();
    expect(responseContent).toBeTruthy();
    expect(responseContent!.length).toBeGreaterThan(10);
  });

  test('should handle message sending with Enter key', async ({ page }) => {
    const messageText = 'Test message via Enter key';
    
    // Focus on input and type message
    await page.locator('[data-testid="chat-input"]').click();
    await page.locator('[data-testid="chat-input"]').fill(messageText);
    
    // Press Enter to send
    await page.locator('[data-testid="chat-input"]').press('Enter');
    
    // Verify message was sent
    await expect(page.locator(`text="${messageText}"`)).toBeVisible();
  });

  test('should handle Shift+Enter for new line', async ({ page }) => {
    const firstLine = 'First line';
    const secondLine = 'Second line';
    
    // Type first line
    await page.locator('[data-testid="chat-input"]').fill(firstLine);
    
    // Press Shift+Enter for new line
    await page.locator('[data-testid="chat-input"]').press('Shift+Enter');
    
    // Type second line
    await page.locator('[data-testid="chat-input"]').type(secondLine);
    
    // Verify textarea contains both lines
    const textareaContent = await page.locator('[data-testid="chat-input"]').inputValue();
    expect(textareaContent).toContain(firstLine);
    expect(textareaContent).toContain(secondLine);
    
    // Send message
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify multi-line message appears correctly
    await expect(page.locator(`text="${firstLine}"`)).toBeVisible();
    await expect(page.locator(`text="${secondLine}"`)).toBeVisible();
  });

  test('should display loading state while AI is responding', async ({ page }) => {
    const messageText = 'Tell me about artificial intelligence';
    
    // Send message
    await page.locator('[data-testid="chat-input"]').fill(messageText);
    await page.locator('[data-testid="send-button"]').click();
    
    // Check for loading indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    
    // Wait for response and verify loading disappears
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
  });

  test('should maintain chat history', async ({ page }) => {
    const messages = [
      'First message',
      'Second message',
      'Third message'
    ];
    
    // Send multiple messages
    for (const message of messages) {
      await page.locator('[data-testid="chat-input"]').fill(message);
      await page.locator('[data-testid="send-button"]').click();
      await page.waitForTimeout(1000); // Brief pause between messages
    }
    
    // Verify all messages are visible in order
    for (const message of messages) {
      await expect(page.locator(`text="${message}"`)).toBeVisible();
    }
  });

  test('should handle empty message gracefully', async ({ page }) => {
    // Try to send empty message
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify no empty message was sent (button should be disabled or ignored)
    // The exact behavior depends on implementation
    const chatMessages = page.locator('[data-testid="chat-messages"] > *');
    const messageCount = await chatMessages.count();
    
    // Should either have 0 messages or an error indicator
    if (messageCount === 0) {
      // No messages sent - good
      expect(messageCount).toBe(0);
    } else {
      // Check if there's an error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    }
  });

  test('should handle very long messages', async ({ page }) => {
    const longMessage = 'This is a very long message. '.repeat(100);
    
    // Send long message
    await page.locator('[data-testid="chat-input"]').fill(longMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify message was sent (might be truncated or handled specially)
    await expect(page.locator(`text="${longMessage.substring(0, 50)}"`)).toBeVisible();
  });

  test('should support message retry on failure', async ({ page }) => {
    // This test would need to simulate network failure
    // Implementation depends on how error handling is built
    
    // Mock network failure
    await page.route('/api/chat', route => route.abort('connectionrefused'));
    
    const messageText = 'This message should fail';
    await page.locator('[data-testid="chat-input"]').fill(messageText);
    await page.locator('[data-testid="send-button"]').click();
    
    // Verify error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Verify retry option is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Remove network mock and retry
    await page.unroute('/api/chat');
    await page.locator('[data-testid="retry-button"]').click();
    
    // Verify message eventually succeeds
    await expect(page.locator(`text="${messageText}"`)).toBeVisible();
  });
});