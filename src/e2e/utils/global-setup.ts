// ABOUTME: Global setup for E2E tests
// ABOUTME: Prepares test environment and dependencies before test execution
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  
  // Use test-specific secrets (these should be safe test values)
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-e2e-testing-only';
  process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
  process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret';
  process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';

  // Configure for test mode
  process.env.USE_AZURE_SERVICES = 'false';
  process.env.USE_MOCK_SERVICES = 'true';
  process.env.ENABLE_TEST_MODE = 'true';

  console.log('📦 Environment variables configured for testing');

  // Optionally, set up test database or mock services
  try {
    await setupTestDatabase();
    await setupMockServices();
    console.log('✅ Test infrastructure setup complete');
  } catch (error) {
    console.error('❌ Failed to set up test infrastructure:', error);
    throw error;
  }

  // Verify the application is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Verifying application accessibility...');
    await page.goto('http://localhost:3000', { timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Basic smoke test - check if the app loads
    const title = await page.title();
    console.log(`📄 Application loaded with title: "${title}"`);
    
    if (!title || title.includes('Error')) {
      throw new Error('Application failed to load properly');
    }
    
  } catch (error) {
    console.error('❌ Application accessibility check failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

/**
 * Set up test database
 */
async function setupTestDatabase() {
  // TODO: Implement test database setup
  // This could include:
  // - Creating test Cosmos DB containers
  // - Seeding test data
  // - Setting up test user accounts
  console.log('📊 Test database setup (TODO: implement)');
}

/**
 * Set up mock services
 */
async function setupMockServices() {
  // TODO: Implement mock service setup
  // This could include:
  // - Mock Azure OpenAI responses
  // - Mock Azure Storage
  // - Mock Azure AI Search
  console.log('🎭 Mock services setup (TODO: implement)');
}

export default globalSetup;