# E2E Testing Setup for Azure Chat

## Overview

This document describes the End-to-End (E2E) testing infrastructure for the Azure Chat application.

## Test Framework

We recommend using **Playwright** for E2E testing because:
- Excellent support for modern web applications
- Built-in waiting mechanisms
- Cross-browser testing capabilities
- Strong TypeScript support
- Good integration with CI/CD pipelines

## Installation

To set up E2E testing, install Playwright:

```bash
npm install --save-dev @playwright/test
npx playwright install
```

## Test Structure

E2E tests should be organized as follows:

```
src/e2e/
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── chat/
│   │   ├── basic-chat.spec.ts
│   │   ├── file-upload.spec.ts
│   │   └── persona-selection.spec.ts
│   ├── extensions/
│   │   ├── create-extension.spec.ts
│   │   └── use-extension.spec.ts
│   └── api/
│       ├── chat-endpoints.spec.ts
│       └── document-endpoints.spec.ts
├── fixtures/
│   ├── test-files/
│   └── mock-data/
├── page-objects/
│   ├── login-page.ts
│   ├── chat-page.ts
│   └── extensions-page.ts
└── utils/
    ├── test-helpers.ts
    └── api-helpers.ts
```

## Critical Test Scenarios

### 1. Authentication Flow
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Logout functionality
- [ ] Session persistence
- [ ] Admin vs non-admin access

### 2. Core Chat Functionality
- [ ] Send basic text message
- [ ] Receive AI response
- [ ] Message history persistence
- [ ] Real-time message streaming
- [ ] Error handling for failed messages

### 3. File Upload and Processing
- [ ] Upload supported file types
- [ ] File validation (size, type)
- [ ] Document processing workflow
- [ ] Chat over uploaded files
- [ ] File deletion

### 4. Persona Management
- [ ] Create new persona
- [ ] Edit existing persona
- [ ] Delete persona
- [ ] Use persona in chat
- [ ] Persona-specific responses

### 5. Extensions System
- [ ] Create custom extension
- [ ] Test extension functionality
- [ ] Use extension in chat
- [ ] Extension error handling
- [ ] Extension permissions

### 6. API Endpoints
- [ ] Chat API response validation
- [ ] Document API functionality
- [ ] Authentication middleware
- [ ] Rate limiting behavior
- [ ] Error response formats

## Test Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Test Environment Setup

### Environment Variables
Create `.env.e2e` file:

```env
# Test environment variables
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-secret-for-e2e-only
AZURE_AD_CLIENT_ID=test-client-id
AZURE_AD_CLIENT_SECRET=test-client-secret
AZURE_AD_TENANT_ID=test-tenant-id

# Use test Azure services or mocks
USE_AZURE_SERVICES=false
USE_MOCK_SERVICES=true
```

### Test Data Management
- Use isolated test databases
- Implement proper test data cleanup
- Create reusable test fixtures
- Mock external Azure services when appropriate

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up test data after each test
- Use unique identifiers for test resources

### 2. Wait Strategies
- Use Playwright's built-in waiting mechanisms
- Avoid hard-coded timeouts
- Wait for network requests to complete

### 3. Page Object Pattern
- Encapsulate page interactions in page objects
- Keep tests focused on business logic
- Reuse common page interactions

### 4. Error Handling
- Test both success and failure scenarios
- Verify error messages and states
- Test network failure scenarios

### 5. Performance
- Monitor page load times
- Test with realistic data volumes
- Verify streaming functionality

## CI/CD Integration

Add to `package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "e2e:report": "playwright show-report"
  }
}
```

Add to CI pipeline:

```yaml
- name: Run E2E tests
  run: |
    npm run build
    npm run e2e
```

## Security Considerations

- Never commit real Azure credentials
- Use test-specific service accounts
- Implement proper access controls for test environments
- Regular cleanup of test resources

## Coverage Goals

Target E2E test coverage:
- [ ] 100% of critical user flows
- [ ] 80% of main application features  
- [ ] All API endpoints
- [ ] Error scenarios and edge cases

## Maintenance

- Review and update tests with feature changes
- Regular test data cleanup
- Monitor test execution times
- Update browser versions as needed