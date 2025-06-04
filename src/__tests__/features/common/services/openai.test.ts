import {
  OpenAIInstance,
  OpenAIEmbeddingInstance,
  OpenAIDALLEInstance,
} from '@/features/common/services/openai'
import { OpenAI } from 'openai'
import { AzureOpenAI } from 'openai'
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity'

// Mock dependencies
jest.mock('openai')
jest.mock('@azure/identity')

describe('OpenAI Service', () => {
  const originalEnv = process.env
  const mockOpenAIClient = { name: 'mock-openai-client' }
  const mockAzureOpenAIClient = { name: 'mock-azure-openai-client' }
  const mockTokenProvider = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock constructors
    ;(OpenAI as jest.Mock).mockImplementation(() => mockOpenAIClient)
    ;(AzureOpenAI as jest.Mock).mockImplementation(() => mockAzureOpenAIClient)
    ;(getBearerTokenProvider as jest.Mock).mockReturnValue(mockTokenProvider)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('OpenAIInstance', () => {
    const setupCommonEnv = () => {
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = 'gpt-4'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'
      process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX = 'openai.azure.com'
    }

    describe('with key-based authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'false'
        process.env.AZURE_OPENAI_API_KEY = 'test-api-key'
        setupCommonEnv()
      })

      it('should create OpenAI client with correct configuration', () => {
        const result = OpenAIInstance()

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-api-key',
          baseURL: 'https://test-openai.openai.azure.com/openai/deployments/gpt-4',
          defaultQuery: { 'api-version': '2024-02-01' },
          defaultHeaders: { 'api-key': 'test-api-key' },
        })
        expect(result).toBe(mockOpenAIClient)
      })

      it('should use default endpoint suffix when not provided', () => {
        delete process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX

        OpenAIInstance()

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-api-key',
          baseURL: 'https://test-openai.openai.azure.com/openai/deployments/gpt-4',
          defaultQuery: { 'api-version': '2024-02-01' },
          defaultHeaders: { 'api-key': 'test-api-key' },
        })
      })
    })

    describe('with managed identity authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'true'
        setupCommonEnv()
      })

      it('should create AzureOpenAI client with managed identity', () => {
        const result = OpenAIInstance()

        expect(DefaultAzureCredential).toHaveBeenCalled()
        expect(getBearerTokenProvider).toHaveBeenCalledWith(
          expect.any(DefaultAzureCredential),
          'https://cognitiveservices.azure.com/.default'
        )
        expect(AzureOpenAI).toHaveBeenCalledWith({
          azureADTokenProvider: mockTokenProvider,
          deployment: 'gpt-4',
          apiVersion: '2024-02-01',
          baseURL: 'https://test-openai.openai.azure.com/openai/deployments/gpt-4',
        })
        expect(result).toBe(mockAzureOpenAIClient)
      })
    })

    describe('with default configuration', () => {
      it('should default to key-based auth when USE_MANAGED_IDENTITIES is not set', () => {
        delete process.env.USE_MANAGED_IDENTITIES
        process.env.AZURE_OPENAI_API_KEY = 'test-key'
        setupCommonEnv()

        const result = OpenAIInstance()

        expect(OpenAI).toHaveBeenCalled()
        expect(AzureOpenAI).not.toHaveBeenCalled()
        expect(result).toBe(mockOpenAIClient)
      })
    })
  })

  describe('OpenAIEmbeddingInstance', () => {
    const setupEmbeddingEnv = () => {
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME = 'text-embedding-ada-002'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'
      process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX = 'openai.azure.com'
    }

    describe('with key-based authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'false'
        process.env.AZURE_OPENAI_API_KEY = 'test-api-key'
        setupEmbeddingEnv()
      })

      it('should create OpenAI client for embeddings', () => {
        const result = OpenAIEmbeddingInstance()

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-api-key',
          baseURL: 'https://test-openai.openai.azure.com/openai/deployments/text-embedding-ada-002',
          defaultQuery: { 'api-version': '2024-02-01' },
          defaultHeaders: { 'api-key': 'test-api-key' },
        })
        expect(result).toBe(mockOpenAIClient)
      })
    })

    describe('with managed identity authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'true'
        setupEmbeddingEnv()
      })

      it('should create AzureOpenAI client for embeddings with managed identity', () => {
        const result = OpenAIEmbeddingInstance()

        expect(AzureOpenAI).toHaveBeenCalledWith({
          azureADTokenProvider: mockTokenProvider,
          deployment: 'text-embedding-ada-002',
          apiVersion: '2024-02-01',
          baseURL: 'https://test-openai.openai.azure.com/openai/deployments/text-embedding-ada-002',
        })
        expect(result).toBe(mockAzureOpenAIClient)
      })
    })
  })

  describe('OpenAIDALLEInstance', () => {
    const setupDALLEEnv = () => {
      process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME = 'test-dalle'
      process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME = 'dall-e-3'
    }

    describe('with key-based authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'false'
        process.env.AZURE_OPENAI_DALLE_API_KEY = 'test-dalle-key'
        setupDALLEEnv()
      })

      it('should create OpenAI client for DALL-E with default API version', () => {
        const result = OpenAIDALLEInstance()

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-dalle-key',
          baseURL: 'https://test-dalle.openai.azure.com/openai/deployments/dall-e-3',
          defaultQuery: { 'api-version': '2023-12-01-preview' },
          defaultHeaders: { 'api-key': 'test-dalle-key' },
        })
        expect(result).toBe(mockOpenAIClient)
      })

      it('should use custom API version when provided', () => {
        process.env.AZURE_OPENAI_DALLE_API_VERSION = '2024-01-01-preview'

        OpenAIDALLEInstance()

        expect(OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-dalle-key',
          baseURL: 'https://test-dalle.openai.azure.com/openai/deployments/dall-e-3',
          defaultQuery: { 'api-version': '2024-01-01-preview' },
          defaultHeaders: { 'api-key': 'test-dalle-key' },
        })
      })
    })

    describe('with managed identity authentication', () => {
      beforeEach(() => {
        process.env.USE_MANAGED_IDENTITIES = 'true'
        setupDALLEEnv()
      })

      it('should create AzureOpenAI client for DALL-E with managed identity', () => {
        const result = OpenAIDALLEInstance()

        expect(AzureOpenAI).toHaveBeenCalledWith({
          azureADTokenProvider: mockTokenProvider,
          deployment: 'dall-e-3',
          apiVersion: '2023-12-01-preview',
          baseURL: 'https://test-dalle.openai.azure.com/openai/deployments/dall-e-3',
        })
        expect(result).toBe(mockAzureOpenAIClient)
      })

      it('should use custom API version for DALL-E managed identity', () => {
        process.env.AZURE_OPENAI_DALLE_API_VERSION = '2024-01-01-preview'

        OpenAIDALLEInstance()

        expect(AzureOpenAI).toHaveBeenCalledWith({
          azureADTokenProvider: mockTokenProvider,
          deployment: 'dall-e-3',
          apiVersion: '2024-01-01-preview',
          baseURL: 'https://test-dalle.openai.azure.com/openai/deployments/dall-e-3',
        })
      })
    })
  })

  describe('Configuration Variations', () => {
    it('should handle different endpoint suffixes', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_OPENAI_API_KEY = 'test-key'
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = 'gpt-4'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'
      process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX = 'openai.azure.cn'

      OpenAIInstance()

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://test-openai.openai.azure.cn/openai/deployments/gpt-4',
        defaultQuery: { 'api-version': '2024-02-01' },
        defaultHeaders: { 'api-key': 'test-key' },
      })
    })

    it('should handle missing endpoint suffix with default', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_OPENAI_API_KEY = 'test-key'
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = 'gpt-4'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'
      delete process.env.AZURE_OPENAI_API_ENDPOINT_SUFFIX

      OpenAIInstance()

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://test-openai.openai.azure.com/openai/deployments/gpt-4',
        defaultQuery: { 'api-version': '2024-02-01' },
        defaultHeaders: { 'api-key': 'test-key' },
      })
    })
  })

  describe('Bearer Token Provider', () => {
    it('should create bearer token provider with correct scope for managed identity', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = 'gpt-4'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'

      OpenAIInstance()

      expect(getBearerTokenProvider).toHaveBeenCalledWith(
        expect.any(DefaultAzureCredential),
        'https://cognitiveservices.azure.com/.default'
      )
    })

    it('should reuse credential instance for embedding service', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_OPENAI_API_INSTANCE_NAME = 'test-openai'
      process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME = 'ada-002'
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-01'

      OpenAIEmbeddingInstance()

      expect(DefaultAzureCredential).toHaveBeenCalledTimes(1)
      expect(getBearerTokenProvider).toHaveBeenCalledWith(
        expect.any(DefaultAzureCredential),
        'https://cognitiveservices.azure.com/.default'
      )
    })
  })
})