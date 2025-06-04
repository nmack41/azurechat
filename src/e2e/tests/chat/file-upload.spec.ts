// ABOUTME: E2E test for file upload and chat-over-files functionality
// ABOUTME: Tests document upload, processing, and RAG-based chat
import { test, expect } from '@playwright/test';
import { ChatPage } from '../../page-objects/chat-page';

test.describe('File Upload and Chat Over Files', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.verifyLoaded();
  });

  test('should upload a text file successfully', async ({ page }) => {
    // Create a test file
    const testContent = 'This is a test document about artificial intelligence and machine learning.';
    const testFile = await page.evaluateHandle(() => {
      const file = new File(['This is a test document about artificial intelligence and machine learning.'], 'test.txt', {
        type: 'text/plain',
      });
      return file;
    });

    // Upload the file
    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent),
    });

    // Verify file upload success notification
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Verify file appears in uploaded files list
    await expect(page.locator('[data-testid="uploaded-file"]')).toContainText('test.txt');
  });

  test('should process uploaded document and enable RAG', async ({ page }) => {
    const testContent = 'Azure is a cloud computing platform by Microsoft. It provides various services including AI and machine learning capabilities.';
    
    // Upload document
    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'azure-info.txt',
      mimeType: 'text/plain', 
      buffer: Buffer.from(testContent),
    });

    // Wait for processing to complete
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 60000 });

    // Ask a question about the document
    await chatPage.sendMessage('What is Azure?');

    // Wait for RAG-enhanced response
    await chatPage.waitForAIResponse();

    // Verify response contains information from the document
    await chatPage.verifyResponseContains('cloud computing platform');
    await chatPage.verifyResponseContains('Microsoft');

    // Verify citations are present
    await chatPage.verifyCitationsPresent();
  });

  test('should handle multiple file uploads', async ({ page }) => {
    const files = [
      {
        name: 'doc1.txt',
        content: 'First document about Azure services.',
      },
      {
        name: 'doc2.txt', 
        content: 'Second document about Azure AI capabilities.',
      },
    ];

    // Upload multiple files
    for (const file of files) {
      await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
        name: file.name,
        mimeType: 'text/plain',
        buffer: Buffer.from(file.content),
      });

      // Wait for each upload to complete
      await expect(page.locator(`[data-testid="uploaded-file"]:has-text("${file.name}")`)).toBeVisible();
    }

    // Verify all files are listed
    await expect(page.locator('[data-testid="uploaded-file"]')).toHaveCount(2);

    // Ask question that could be answered by either document
    await chatPage.sendMessage('Tell me about Azure');
    await chatPage.waitForAIResponse();

    // Verify response draws from multiple sources
    await chatPage.verifyCitationsPresent();
  });

  test('should validate file types', async ({ page }) => {
    // Try to upload an unsupported file type
    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'malicious.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake executable content'),
    });

    // Verify error message for invalid file type
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('file type not supported');
  });

  test('should validate file size limits', async ({ page }) => {
    // Create a large file (simulated)
    const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB

    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'large-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(largeContent),
    });

    // Verify error message for file too large
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('file too large');
  });

  test('should handle image uploads', async ({ page }) => {
    // Create a test image (1x1 pixel PNG)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC9, 0x6B, 0x3E, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);

    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: pngData,
    });

    // Verify image upload success
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Verify image appears in uploaded files
    await expect(page.locator('[data-testid="uploaded-file"]')).toContainText('test-image.png');

    // Send message with image context
    await chatPage.sendMessage('What do you see in this image?');
    await chatPage.waitForAIResponse();

    // Verify AI responds about the image
    const response = await chatPage.getLatestAIResponse();
    expect(response.length).toBeGreaterThan(0);
  });

  test('should remove uploaded files', async ({ page }) => {
    const testContent = 'Document to be removed.';

    // Upload file
    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'removeme.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent),
    });

    // Wait for upload
    await expect(page.locator('[data-testid="uploaded-file"]')).toContainText('removeme.txt');

    // Remove the file
    await page.locator('[data-testid="remove-file-button"]').click();

    // Confirm removal
    await page.locator('[data-testid="confirm-remove"]').click();

    // Verify file is removed
    await expect(page.locator('[data-testid="uploaded-file"]')).not.toBeVisible();
  });

  test('should handle PDF document upload', async ({ page }) => {
    // Create minimal PDF content (simplified for testing)
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = pdfHeader + 'This is a test PDF document about Azure AI services.';

    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'azure-guide.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfContent),
    });

    // Wait for PDF processing (may take longer than text files)
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 90000 });

    // Ask question about PDF content
    await chatPage.sendMessage('What does the PDF say about Azure AI?');
    await chatPage.waitForAIResponse();

    // Verify RAG functionality works with PDF
    await chatPage.verifyCitationsPresent();
  });

  test('should display file processing status', async ({ page }) => {
    const testContent = 'Document that will show processing status.';

    // Upload file
    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'status-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent),
    });

    // Verify processing status indicators
    await expect(page.locator('[data-testid="processing-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing');

    // Wait for completion
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 60000 });
    
    // Verify status updates to complete
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Complete');
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Mock network failure for upload
    await page.route('/api/document', route => route.abort('connectionrefused'));

    const testContent = 'Document that will fail to upload.';

    await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
      name: 'fail-upload.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent),
    });

    // Verify error handling
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('upload failed');

    // Verify retry option
    await expect(page.locator('[data-testid="retry-upload"]')).toBeVisible();

    // Remove mock and retry
    await page.unroute('/api/document');
    await page.locator('[data-testid="retry-upload"]').click();

    // Verify successful retry
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
  });

  test('should clear all uploaded files', async ({ page }) => {
    // Upload multiple files
    const files = ['file1.txt', 'file2.txt', 'file3.txt'];
    
    for (const fileName of files) {
      await page.setInputFiles('[data-testid="file-upload"] input[type="file"]', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(`Content of ${fileName}`),
      });
      
      await expect(page.locator(`[data-testid="uploaded-file"]:has-text("${fileName}")`)).toBeVisible();
    }

    // Clear all files
    await page.locator('[data-testid="clear-all-files"]').click();
    await page.locator('[data-testid="confirm-clear-all"]').click();

    // Verify all files are removed
    await expect(page.locator('[data-testid="uploaded-file"]')).not.toBeVisible();
  });
});