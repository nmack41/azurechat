import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock environment variables for testing
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret'

// Mock Azure services that require external dependencies
jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn(() => ({
    database: jest.fn(() => ({
      container: jest.fn(() => ({
        items: {
          query: jest.fn(() => ({
            fetchAll: jest.fn(() => Promise.resolve({ resources: [] }))
          })),
          create: jest.fn(() => Promise.resolve({ resource: {} })),
          upsert: jest.fn(() => Promise.resolve({ resource: {} })),
        },
        item: jest.fn(() => ({
          read: jest.fn(() => Promise.resolve({ resource: {} })),
          delete: jest.fn(() => Promise.resolve({ resource: {} })),
        })),
      })),
    })),
  })),
}))

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn(),
  getBearerTokenProvider: jest.fn(() => jest.fn()),
}))

jest.mock('@azure/search-documents', () => ({
  AzureKeyCredential: jest.fn(),
  SearchClient: jest.fn(),
  SearchIndexClient: jest.fn(),  
  SearchIndexerClient: jest.fn(),
}))

jest.mock('@azure/ai-form-recognizer', () => ({
  AzureKeyCredential: jest.fn(),
  DocumentAnalysisClient: jest.fn(),
}))

jest.mock('@azure/keyvault-secrets', () => ({
  SecretClient: jest.fn(),
}))

jest.mock('openai', () => ({
  OpenAI: jest.fn(),
  AzureOpenAI: jest.fn(),
}))

jest.mock('@azure/openai', () => ({
  OpenAIClient: jest.fn(() => ({
    getChatCompletions: jest.fn(() => Promise.resolve({
      choices: [{ message: { content: 'Test response' } }]
    })),
  })),
}))

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn(() => ({
    getContainerClient: jest.fn(() => ({
      getBlockBlobClient: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve()),
        download: jest.fn(() => Promise.resolve({ readableStreamBody: new ReadableStream() })),
      })),
    })),
  })),
}))

jest.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: {
    fromAuthorizationToken: jest.fn(() => ({})),
  },
  AudioConfig: {
    fromDefaultMicrophoneInput: jest.fn(() => ({})),
    fromSpeakerOutput: jest.fn(() => ({})),
  },
  SpeechRecognizer: {
    FromConfig: jest.fn(() => ({
      startContinuousRecognitionAsync: jest.fn(),
      stopContinuousRecognitionAsync: jest.fn((callback) => callback && callback()),
      close: jest.fn(),
      recognizing: null,
      canceled: null,
    })),
  },
  SpeechSynthesizer: jest.fn(() => ({
    speakTextAsync: jest.fn((text, callback) => callback && callback({ reason: 'SynthesizingAudioCompleted' })),
    close: jest.fn(),
  })),
  SpeakerAudioDestination: jest.fn(() => ({
    pause: jest.fn(),
    close: jest.fn(),
    onAudioEnd: null,
  })),
  ResultReason: {
    SynthesizingAudioCompleted: 'SynthesizingAudioCompleted',
  },
  AutoDetectSourceLanguageConfig: {
    fromLanguages: jest.fn(() => ({})),
  },
}))

// Mock NextAuth
jest.mock('next-auth', () => ({
  default: jest.fn(() => ({
    handlers: {},
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        isAdmin: false,
      },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}))

// Mock auth API to prevent NextAuth initialization issues
jest.mock('@/features/auth-page/auth-api', () => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock auth helpers 
jest.mock('@/features/auth-page/helpers', () => ({
  userHashedId: jest.fn().mockResolvedValue('test-hashed-user-id'),
  getCurrentUser: jest.fn().mockResolvedValue({
    name: 'Test User',
    email: 'test@example.com',
    image: 'avatar.jpg',
  }),
  isCurrentUserAdmin: jest.fn().mockResolvedValue(false),
  hashValue: jest.fn().mockImplementation((value) => `hashed-${value}`),
}))

// Mock nanoid to avoid ES module issues
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-nanoid-' + Math.random().toString(36).substr(2, 9)),
}))

// Mock common utilities
jest.mock('@/features/common/util', () => ({
  unique: jest.fn().mockImplementation((arr) => [...new Set(arr)]),
  debounce: jest.fn().mockImplementation((fn) => fn),
  formatDate: jest.fn().mockImplementation((date) => date.toISOString()),
}))

// Mock validation service
jest.mock('@/features/common/services/validation-service', () => ({
  sanitizeInput: jest.fn().mockImplementation((input, options = {}) => {
    if (!input || typeof input !== 'string') return null;
    if (input.length > (options.maxLength || 1000)) return null;
    // Basic sanitization - remove dangerous characters
    return input.replace(/[<>&"']/g, '');
  }),
  validateFileType: jest.fn().mockReturnValue(true),
  validateImageBase64: jest.fn().mockReturnValue(true),
  isValidUrl: jest.fn().mockReturnValue(true),
}))

// Mock cosmos service
jest.mock('@/features/common/services/cosmos', () => ({
  CosmosDBContainer: jest.fn().mockResolvedValue({
    items: {
      query: jest.fn().mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      }),
      create: jest.fn().mockResolvedValue({ resource: {} }),
      upsert: jest.fn().mockResolvedValue({ resource: {} }),
    },
    item: jest.fn().mockReturnValue({
      read: jest.fn().mockResolvedValue({ resource: {} }),
      replace: jest.fn().mockResolvedValue({ resource: {} }),
      delete: jest.fn().mockResolvedValue({ resource: {} }),
    }),
  }),
}))

// Global test utilities
global.fetch = jest.fn()

// Add Web API globals for Node.js environment
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Add Web Streams API
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock Web API Request/Response for Node.js environment
class MockHeaders {
  constructor(init) {
    this.data = new Map();
    if (init) {
      if (typeof init === 'object' && init !== null) {
        for (const [key, value] of Object.entries(init)) {
          this.set(key, value);
        }
      }
    }
  }
  
  get(name) {
    return this.data.get(name.toLowerCase()) || null;
  }
  
  set(name, value) {
    this.data.set(name.toLowerCase(), String(value));
  }
  
  has(name) {
    return this.data.has(name.toLowerCase());
  }
  
  delete(name) {
    this.data.delete(name.toLowerCase());
  }
  
  entries() {
    return this.data.entries();
  }
  
  keys() {
    return this.data.keys();
  }
  
  values() {
    return this.data.values();
  }
  
  forEach(callback) {
    for (const [key, value] of this.data.entries()) {
      callback(value, key, this);
    }
  }
}

class MockRequest {
  constructor(input, init = {}) {
    this.url = input;
    this.method = init.method || 'GET';
    this.headers = new MockHeaders(init.headers);
    this.body = init.body || null;
  }
}

class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new MockHeaders(init.headers);
    this.ok = this.status >= 200 && this.status < 300;
  }
  
  async text() {
    if (typeof this.body === 'string') {
      return this.body;
    }
    if (this.body instanceof ArrayBuffer) {
      return new TextDecoder().decode(this.body);
    }
    return String(this.body);
  }
  
  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
  
  async arrayBuffer() {
    if (this.body instanceof ArrayBuffer) {
      return this.body;
    }
    const text = await this.text();
    return new TextEncoder().encode(text).buffer;
  }
}

global.Request = MockRequest;
global.Response = MockResponse;
global.Headers = MockHeaders;

// Enhanced FormData mock
class MockFormData {
  constructor() {
    this.data = new Map();
  }
  
  append(key, value) {
    if (this.data.has(key)) {
      const existing = this.data.get(key);
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        this.data.set(key, [existing, value]);
      }
    } else {
      this.data.set(key, value);
    }
  }
  
  get(key) {
    const value = this.data.get(key);
    return Array.isArray(value) ? value[0] : value;
  }
  
  getAll(key) {
    const value = this.data.get(key);
    return Array.isArray(value) ? value : value ? [value] : [];
  }
  
  has(key) {
    return this.data.has(key);
  }
  
  delete(key) {
    this.data.delete(key);
  }
  
  set(key, value) {
    this.data.set(key, value);
  }
  
  entries() {
    return this.data.entries();
  }
  
  keys() {
    return this.data.keys();
  }
  
  values() {
    return this.data.values();
  }
  
  forEach(callback) {
    for (const [key, value] of this.data.entries()) {
      callback(value, key, this);
    }
  }
}

global.FormData = MockFormData;

// Suppress console warnings in tests unless explicitly testing them
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

beforeEach(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterEach(() => {
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
  jest.clearAllMocks()
})