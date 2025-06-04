// ABOUTME: Page object for chat interface interactions
// ABOUTME: Encapsulates chat page elements and common operations
import { Page, Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly chatMessages: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly fileUploadButton: Locator;
  readonly personaSelector: Locator;
  readonly menuToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.locator('[data-testid="chat-input"]');
    this.sendButton = page.locator('[data-testid="send-button"]');
    this.chatMessages = page.locator('[data-testid="chat-messages"]');
    this.loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.retryButton = page.locator('[data-testid="retry-button"]');
    this.fileUploadButton = page.locator('[data-testid="file-upload"]');
    this.personaSelector = page.locator('[data-testid="persona-selector"]');
    this.menuToggle = page.locator('[data-testid="menu-toggle"]');
  }

  /**
   * Navigate to the chat page
   */
  async goto() {
    await this.page.goto('/chat');
  }

  /**
   * Send a text message
   */
  async sendMessage(message: string) {
    await this.chatInput.fill(message);
    await this.sendButton.click();
  }

  /**
   * Send a message using Enter key
   */
  async sendMessageWithEnter(message: string) {
    await this.chatInput.fill(message);
    await this.chatInput.press('Enter');
  }

  /**
   * Type a multi-line message using Shift+Enter
   */
  async typeMultiLineMessage(lines: string[]) {
    for (let i = 0; i < lines.length; i++) {
      await this.chatInput.type(lines[i]);
      if (i < lines.length - 1) {
        await this.chatInput.press('Shift+Enter');
      }
    }
  }

  /**
   * Wait for AI response to appear
   */
  async waitForAIResponse(timeout: number = 30000) {
    await expect(this.page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout });
  }

  /**
   * Get the latest AI response text
   */
  async getLatestAIResponse(): Promise<string> {
    return await this.page.locator('[data-testid="ai-message"]').last().textContent() || '';
  }

  /**
   * Get the latest user message text
   */
  async getLatestUserMessage(): Promise<string> {
    return await this.page.locator('[data-testid="user-message"]').last().textContent() || '';
  }

  /**
   * Get all messages in the chat
   */
  async getAllMessages(): Promise<string[]> {
    const messages = await this.chatMessages.locator('[data-testid*="message"]').all();
    const messageTexts = [];
    for (const message of messages) {
      const text = await message.textContent();
      if (text) messageTexts.push(text);
    }
    return messageTexts;
  }

  /**
   * Verify chat interface is loaded
   */
  async verifyLoaded() {
    await expect(this.chatInput).toBeVisible();
    await expect(this.sendButton).toBeVisible();
    await expect(this.chatMessages).toBeVisible();
  }

  /**
   * Verify loading state is active
   */
  async verifyLoadingState() {
    await expect(this.loadingIndicator).toBeVisible();
  }

  /**
   * Verify loading state is gone
   */
  async verifyLoadingComplete() {
    await expect(this.loadingIndicator).not.toBeVisible();
  }

  /**
   * Verify error state
   */
  async verifyErrorState(errorText?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (errorText) {
      await expect(this.errorMessage).toContainText(errorText);
    }
  }

  /**
   * Retry failed message
   */
  async retryMessage() {
    await this.retryButton.click();
  }

  /**
   * Upload a file
   */
  async uploadFile(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Select a persona
   */
  async selectPersona(personaName: string) {
    await this.personaSelector.click();
    await this.page.locator(`[data-testid="persona-option"][data-value="${personaName}"]`).click();
  }

  /**
   * Open the side menu
   */
  async openMenu() {
    await this.menuToggle.click();
  }

  /**
   * Start a new chat conversation
   */
  async startNewChat() {
    await this.openMenu();
    await this.page.locator('[data-testid="new-chat-button"]').click();
  }

  /**
   * Wait for message to appear in chat
   */
  async waitForMessage(messageText: string, timeout: number = 10000) {
    await expect(this.page.locator(`text="${messageText}"`)).toBeVisible({ timeout });
  }

  /**
   * Verify message count
   */
  async verifyMessageCount(expectedCount: number) {
    const messages = this.chatMessages.locator('[data-testid*="message"]');
    await expect(messages).toHaveCount(expectedCount);
  }

  /**
   * Clear the chat input
   */
  async clearInput() {
    await this.chatInput.clear();
  }

  /**
   * Check if send button is enabled
   */
  async isSendButtonEnabled(): Promise<boolean> {
    return await this.sendButton.isEnabled();
  }

  /**
   * Check if chat input is focused
   */
  async isInputFocused(): Promise<boolean> {
    return await this.chatInput.isFocused();
  }

  /**
   * Get current input value
   */
  async getInputValue(): Promise<string> {
    return await this.chatInput.inputValue();
  }

  /**
   * Scroll to bottom of chat
   */
  async scrollToBottom() {
    await this.chatMessages.scrollIntoViewIfNeeded();
  }

  /**
   * Scroll to top of chat
   */
  async scrollToTop() {
    await this.chatMessages.first().scrollIntoViewIfNeeded();
  }

  /**
   * Verify message appears in correct order
   */
  async verifyMessageOrder(messages: string[]) {
    for (let i = 0; i < messages.length; i++) {
      const messageLocator = this.chatMessages.locator('[data-testid*="message"]').nth(i);
      await expect(messageLocator).toContainText(messages[i]);
    }
  }

  /**
   * Wait for streaming response to complete
   */
  async waitForStreamingComplete(timeout: number = 60000) {
    // Wait for loading to start
    await this.verifyLoadingState();
    
    // Wait for loading to complete
    await expect(this.loadingIndicator).not.toBeVisible({ timeout });
    
    // Additional wait for streaming to fully complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify citation links are present (for RAG responses)
   */
  async verifyCitationsPresent() {
    await expect(this.page.locator('[data-testid="citation"]')).toBeVisible();
  }

  /**
   * Click on a citation
   */
  async clickCitation(citationIndex: number = 0) {
    await this.page.locator('[data-testid="citation"]').nth(citationIndex).click();
  }

  /**
   * Verify response contains specific content
   */
  async verifyResponseContains(expectedContent: string) {
    const latestResponse = await this.getLatestAIResponse();
    expect(latestResponse.toLowerCase()).toContain(expectedContent.toLowerCase());
  }

  /**
   * Verify response does not contain specific content
   */
  async verifyResponseDoesNotContain(forbiddenContent: string) {
    const latestResponse = await this.getLatestAIResponse();
    expect(latestResponse.toLowerCase()).not.toContain(forbiddenContent.toLowerCase());
  }
}