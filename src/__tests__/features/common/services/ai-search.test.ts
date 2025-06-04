import {
  GetCredential,
  AzureAISearchInstance,
  AzureAISearchIndexClientInstance,
  AzureAISearchIndexerClientInstance,
} from '@/features/common/services/ai-search'
import { AzureKeyCredential, SearchClient, SearchIndexClient, SearchIndexerClient } from '@azure/search-documents'
import { DefaultAzureCredential } from '@azure/identity'

// Mock Azure SDK modules
jest.mock('@azure/search-documents')
jest.mock('@azure/identity')

describe('AI Search Service', () => {
  const originalEnv = process.env
  const mockSearchClient = {} as SearchClient<any>
  const mockSearchIndexClient = {} as SearchIndexClient
  const mockSearchIndexerClient = {} as SearchIndexerClient
  
  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock constructors
    ;(SearchClient as jest.Mock).mockImplementation(() => mockSearchClient)
    ;(SearchIndexClient as jest.Mock).mockImplementation(() => mockSearchIndexClient)
    ;(SearchIndexerClient as jest.Mock).mockImplementation(() => mockSearchIndexerClient)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GetCredential', () => {
    it('should return DefaultAzureCredential when using managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const result = GetCredential()
      
      expect(DefaultAzureCredential).toHaveBeenCalled()
      expect(result).toBeInstanceOf(DefaultAzureCredential)
    })

    it('should return AzureKeyCredential when not using managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_SEARCH_API_KEY = 'test-api-key'
      
      const result = GetCredential()
      
      expect(AzureKeyCredential).toHaveBeenCalledWith('test-api-key')
      expect(result).toBeInstanceOf(AzureKeyCredential)
    })

    it('should default to AzureKeyCredential when USE_MANAGED_IDENTITIES is not set', () => {
      delete process.env.USE_MANAGED_IDENTITIES
      process.env.AZURE_SEARCH_API_KEY = 'test-api-key'
      
      const result = GetCredential()
      
      expect(AzureKeyCredential).toHaveBeenCalledWith('test-api-key')
      expect(result).toBeInstanceOf(AzureKeyCredential)
    })
  })

  describe('AzureAISearchInstance', () => {
    beforeEach(() => {
      process.env.AZURE_SEARCH_NAME = 'test-search'
      process.env.AZURE_SEARCH_INDEX_NAME = 'test-index'
      process.env.AZURE_SEARCH_ENDPOINT_SUFFIX = 'search.windows.net'
      process.env.AZURE_SEARCH_API_KEY = 'test-key'
    })

    it('should create SearchClient with correct parameters', () => {
      const result = AzureAISearchInstance()
      
      expect(SearchClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        'test-index',
        expect.any(AzureKeyCredential)
      )
      expect(result).toBe(mockSearchClient)
    })

    it('should use default endpoint suffix when not provided', () => {
      delete process.env.AZURE_SEARCH_ENDPOINT_SUFFIX
      
      AzureAISearchInstance()
      
      expect(SearchClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        'test-index',
        expect.any(AzureKeyCredential)
      )
    })

    it('should work with managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const result = AzureAISearchInstance()
      
      expect(SearchClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        'test-index',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSearchClient)
    })
  })

  describe('AzureAISearchIndexClientInstance', () => {
    beforeEach(() => {
      process.env.AZURE_SEARCH_NAME = 'test-search'
      process.env.AZURE_SEARCH_ENDPOINT_SUFFIX = 'search.windows.net'
      process.env.AZURE_SEARCH_API_KEY = 'test-key'
    })

    it('should create SearchIndexClient with correct parameters', () => {
      const result = AzureAISearchIndexClientInstance()
      
      expect(SearchIndexClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        expect.any(AzureKeyCredential)
      )
      expect(result).toBe(mockSearchIndexClient)
    })

    it('should work with managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const result = AzureAISearchIndexClientInstance()
      
      expect(SearchIndexClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSearchIndexClient)
    })
  })

  describe('AzureAISearchIndexerClientInstance', () => {
    beforeEach(() => {
      process.env.AZURE_SEARCH_NAME = 'test-search'
      process.env.AZURE_SEARCH_ENDPOINT_SUFFIX = 'search.windows.net'
      process.env.AZURE_SEARCH_API_KEY = 'test-key'
    })

    it('should create SearchIndexerClient with correct parameters', () => {
      const result = AzureAISearchIndexerClientInstance()
      
      expect(SearchIndexerClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        expect.any(AzureKeyCredential)
      )
      expect(result).toBe(mockSearchIndexerClient)
    })

    it('should work with managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const result = AzureAISearchIndexerClientInstance()
      
      expect(SearchIndexerClient).toHaveBeenCalledWith(
        'https://test-search.search.windows.net',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSearchIndexerClient)
    })
  })

  describe('Environment Configuration Logging', () => {
    it('should log configuration parameters', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_SEARCH_ENDPOINT_SUFFIX = 'custom.net'
      process.env.AZURE_SEARCH_NAME = 'my-search'
      process.env.AZURE_SEARCH_INDEX_NAME = 'my-index'
      
      // Re-import to trigger the logging
      jest.resetModules()
      require('@/features/common/services/ai-search')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Configuration parameters:', {
        USE_MANAGED_IDENTITIES: true,
        endpointSuffix: 'custom.net',
        searchName: 'my-search',
        indexName: 'my-index',
        endpoint: 'https://my-search.custom.net',
      })
      
      consoleLogSpy.mockRestore()
    })
  })

  describe('Debug Mode', () => {
    it('should log credential details when debug is enabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.DEBUG = 'true'
      process.env.AZURE_SEARCH_API_KEY = 'test-key'
      
      GetCredential()
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Credential obtained:', expect.any(AzureKeyCredential))
      
      consoleLogSpy.mockRestore()
    })

    it('should not log credential details when debug is disabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      process.env.DEBUG = 'false'
      process.env.AZURE_SEARCH_API_KEY = 'test-key'
      
      GetCredential()
      
      expect(consoleLogSpy).not.toHaveBeenCalledWith('Credential obtained:', expect.anything())
      
      consoleLogSpy.mockRestore()
    })
  })
})