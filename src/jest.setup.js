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
  default: jest.fn(),
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

// Global test utilities
global.fetch = jest.fn()
global.FormData = jest.fn(() => ({
  append: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
}))

// Add TextEncoder/TextDecoder for Node.js environment
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

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