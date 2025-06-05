import { CosmosInstance, ConfigContainer, HistoryContainer } from '@/services/cosmos'
import { CosmosClient } from '@azure/cosmos'
import { DefaultAzureCredential } from '@azure/identity'

// Mock Azure SDK modules
jest.mock('@azure/cosmos')
jest.mock('@azure/identity')

describe('Cosmos Service', () => {
  const originalEnv = process.env
  
  const mockContainer = { name: 'mock-container' }
  const mockDatabase = {
    container: jest.fn(() => mockContainer),
  }
  const mockCosmosClient = {
    database: jest.fn(() => mockDatabase),
  }

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock CosmosClient constructor
    ;(CosmosClient as jest.Mock).mockImplementation(() => mockCosmosClient)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('CosmosInstance', () => {
    beforeEach(() => {
      process.env.AZURE_COSMOSDB_URI = 'https://test-cosmos.documents.azure.com:443/'
      process.env.AZURE_COSMOSDB_KEY = 'test-key-123'
    })

    it('should create CosmosClient with key-based authentication', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      
      const result = CosmosInstance()
      
      expect(CosmosClient).toHaveBeenCalledWith({
        endpoint: 'https://test-cosmos.documents.azure.com:443/',
        key: 'test-key-123',
      })
      expect(result).toBe(mockCosmosClient)
    })

    it('should create CosmosClient with managed identity authentication', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      delete process.env.AZURE_COSMOSDB_KEY
      
      const result = CosmosInstance()
      
      expect(CosmosClient).toHaveBeenCalledWith({
        endpoint: 'https://test-cosmos.documents.azure.com:443/',
        aadCredentials: expect.any(DefaultAzureCredential),
      })
      expect(result).toBe(mockCosmosClient)
    })

    it('should default to key-based auth when USE_MANAGED_IDENTITIES is not set', () => {
      delete process.env.USE_MANAGED_IDENTITIES
      
      const result = CosmosInstance()
      
      expect(CosmosClient).toHaveBeenCalledWith({
        endpoint: 'https://test-cosmos.documents.azure.com:443/',
        key: 'test-key-123',
      })
      expect(result).toBe(mockCosmosClient)
    })

    it('should throw error when endpoint is not configured', () => {
      delete process.env.AZURE_COSMOSDB_URI
      
      expect(() => CosmosInstance()).toThrow(
        'Azure Cosmos DB endpoint is not configured. Please configure it in the .env file.'
      )
    })

    it('should throw error when key is missing for key-based auth', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      delete process.env.AZURE_COSMOSDB_KEY
      
      expect(() => CosmosInstance()).toThrow(
        'Azure Cosmos DB key is not provided in environment variables.'
      )
    })
  })

  describe('ConfigContainer', () => {
    beforeEach(() => {
      process.env.AZURE_COSMOSDB_URI = 'https://test-cosmos.documents.azure.com:443/'
      process.env.AZURE_COSMOSDB_KEY = 'test-key-123'
      process.env.AZURE_COSMOSDB_DB_NAME = 'test-chat-db'
      process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME = 'test-config'
    })

    it('should return config container with correct names', () => {
      const result = ConfigContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('test-chat-db')
      expect(mockDatabase.container).toHaveBeenCalledWith('test-config')
      expect(result).toBe(mockContainer)
    })

    it('should use default database name when not provided', () => {
      delete process.env.AZURE_COSMOSDB_DB_NAME
      
      const result = ConfigContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('test-config')
      expect(result).toBe(mockContainer)
    })

    it('should use default config container name when not provided', () => {
      delete process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME
      
      const result = ConfigContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('test-chat-db')
      expect(mockDatabase.container).toHaveBeenCalledWith('config')
      expect(result).toBe(mockContainer)
    })

    it('should use all default names when environment variables are missing', () => {
      delete process.env.AZURE_COSMOSDB_DB_NAME
      delete process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME
      
      const result = ConfigContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('config')
      expect(result).toBe(mockContainer)
    })
  })

  describe('HistoryContainer', () => {
    beforeEach(() => {
      process.env.AZURE_COSMOSDB_URI = 'https://test-cosmos.documents.azure.com:443/'
      process.env.AZURE_COSMOSDB_KEY = 'test-key-123'
      process.env.AZURE_COSMOSDB_DB_NAME = 'test-chat-db'
      process.env.AZURE_COSMOSDB_CONTAINER_NAME = 'test-history'
    })

    it('should return history container with correct names', () => {
      const result = HistoryContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('test-chat-db')
      expect(mockDatabase.container).toHaveBeenCalledWith('test-history')
      expect(result).toBe(mockContainer)
    })

    it('should use default database name when not provided', () => {
      delete process.env.AZURE_COSMOSDB_DB_NAME
      
      const result = HistoryContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('test-history')
      expect(result).toBe(mockContainer)
    })

    it('should use default history container name when not provided', () => {
      delete process.env.AZURE_COSMOSDB_CONTAINER_NAME
      
      const result = HistoryContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('test-chat-db')
      expect(mockDatabase.container).toHaveBeenCalledWith('history')
      expect(result).toBe(mockContainer)
    })

    it('should use all default names when environment variables are missing', () => {
      delete process.env.AZURE_COSMOSDB_DB_NAME
      delete process.env.AZURE_COSMOSDB_CONTAINER_NAME
      
      const result = HistoryContainer()
      
      expect(mockCosmosClient.database).toHaveBeenCalledWith('chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('history')
      expect(result).toBe(mockContainer)
    })
  })

  describe('Environment Configuration', () => {
    it('should handle empty string environment variables', () => {
      process.env.AZURE_COSMOSDB_URI = 'https://test-cosmos.documents.azure.com:443/'
      process.env.AZURE_COSMOSDB_KEY = 'test-key-123'
      process.env.AZURE_COSMOSDB_DB_NAME = ''
      process.env.AZURE_COSMOSDB_CONTAINER_NAME = ''
      process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME = ''
      
      const historyResult = HistoryContainer()
      const configResult = ConfigContainer()
      
      // Should use defaults for empty strings
      expect(mockCosmosClient.database).toHaveBeenCalledWith('chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('history')
      expect(mockDatabase.container).toHaveBeenCalledWith('config')
    })

    it('should work with managed identities and custom container names', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_COSMOSDB_URI = 'https://test-cosmos.documents.azure.com:443/'
      process.env.AZURE_COSMOSDB_DB_NAME = 'prod-chat'
      process.env.AZURE_COSMOSDB_CONTAINER_NAME = 'chat-history'
      process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME = 'app-config'
      
      const historyResult = HistoryContainer()
      const configResult = ConfigContainer()
      
      expect(CosmosClient).toHaveBeenCalledWith({
        endpoint: 'https://test-cosmos.documents.azure.com:443/',
        aadCredentials: expect.any(DefaultAzureCredential),
      })
      expect(mockCosmosClient.database).toHaveBeenCalledWith('prod-chat')
      expect(mockDatabase.container).toHaveBeenCalledWith('chat-history')
      expect(mockDatabase.container).toHaveBeenCalledWith('app-config')
    })
  })
})