import { UploadBlob, GetBlob } from '@/features/common/services/azure-storage'
import { BlobServiceClient, RestError } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'

// Mock Azure SDK modules
jest.mock('@azure/storage-blob')
jest.mock('@azure/identity')

describe('Azure Storage Service', () => {
  const originalEnv = process.env
  
  const mockBlobServiceClient = {
    getContainerClient: jest.fn(),
  }
  
  const mockContainerClient = {
    getBlockBlobClient: jest.fn(),
  }
  
  const mockBlockBlobClient = {
    uploadData: jest.fn(),
    download: jest.fn(),
    url: 'https://test-storage.blob.core.windows.net/container/blob.txt',
  }

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock BlobServiceClient methods
    ;(BlobServiceClient as any).mockImplementation(() => mockBlobServiceClient)
    ;(BlobServiceClient.fromConnectionString as jest.Mock) = jest.fn(() => mockBlobServiceClient)
    
    mockBlobServiceClient.getContainerClient.mockReturnValue(mockContainerClient)
    mockContainerClient.getBlockBlobClient.mockReturnValue(mockBlockBlobClient)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('UploadBlob', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
      process.env.AZURE_STORAGE_ACCOUNT_KEY = 'testkey'
      process.env.AZURE_STORAGE_ENDPOINT_SUFFIX = 'core.windows.net'
    })

    it('should successfully upload blob and return URL', async () => {
      const mockResponse = { errorCode: undefined }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      const result = await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(mockBlobServiceClient.getContainerClient).toHaveBeenCalledWith('test-container')
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('test-blob.txt')
      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(testData)
      
      expect(result).toEqual({
        status: 'OK',
        response: 'https://test-storage.blob.core.windows.net/container/blob.txt',
      })
    })

    it('should return error when upload fails', async () => {
      const mockResponse = { errorCode: 'BlobAlreadyExists' }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      const result = await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(result).toEqual({
        status: 'ERROR',
        errors: [
          {
            message: 'Error uploading blob to storage: BlobAlreadyExists',
          },
        ],
      })
    })

    it('should work with managed identities', async () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      delete process.env.AZURE_STORAGE_ACCOUNT_KEY
      
      const mockResponse = { errorCode: undefined }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(BlobServiceClient).toHaveBeenCalledWith(
        'https://teststorage.blob.core.windows.net',
        expect.any(DefaultAzureCredential)
      )
    })

    it('should throw error when storage account is not configured properly', async () => {
      delete process.env.AZURE_STORAGE_ACCOUNT_NAME
      delete process.env.AZURE_STORAGE_ACCOUNT_KEY
      process.env.USE_MANAGED_IDENTITIES = 'false'
      
      const testData = Buffer.from('test data')
      
      await expect(UploadBlob('test-container', 'test-blob.txt', testData)).rejects.toThrow(
        'Azure Storage Account not configured correctly, check environment variables.'
      )
    })

    it('should use custom endpoint suffix', async () => {
      process.env.AZURE_STORAGE_ENDPOINT_SUFFIX = 'custom.net'
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const mockResponse = { errorCode: undefined }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(BlobServiceClient).toHaveBeenCalledWith(
        'https://teststorage.blob.custom.net',
        expect.any(DefaultAzureCredential)
      )
    })
  })

  describe('GetBlob', () => {
    beforeEach(() => {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
      process.env.AZURE_STORAGE_ACCOUNT_KEY = 'testkey'
    })

    it('should successfully download blob and return stream', async () => {
      const mockStream = new ReadableStream()
      const mockResponse = {
        readableStreamBody: mockStream,
      }
      mockBlockBlobClient.download.mockResolvedValue(mockResponse)
      
      const result = await GetBlob('test-container', 'test-blob.txt')
      
      expect(mockBlobServiceClient.getContainerClient).toHaveBeenCalledWith('test-container')
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('test-blob.txt')
      expect(mockBlockBlobClient.download).toHaveBeenCalledWith(0)
      
      expect(result).toEqual({
        status: 'OK',
        response: mockStream,
      })
    })

    it('should return error when blob has no readable stream', async () => {
      const mockResponse = {
        readableStreamBody: null,
      }
      mockBlockBlobClient.download.mockResolvedValue(mockResponse)
      
      const result = await GetBlob('test-container', 'test-blob.txt')
      
      expect(result).toEqual({
        status: 'ERROR',
        errors: [
          {
            message: 'Error downloading blob: test-blob.txt',
          },
        ],
      })
    })

    it('should return NOT_FOUND when blob does not exist', async () => {
      const notFoundError = new RestError('Not Found', { statusCode: 404 })
      mockBlockBlobClient.download.mockRejectedValue(notFoundError)
      
      const result = await GetBlob('test-container', 'nonexistent-blob.txt')
      
      expect(result).toEqual({
        status: 'NOT_FOUND',
        errors: [
          {
            message: 'Blob not found: nonexistent-blob.txt',
          },
        ],
      })
    })

    it('should return ERROR for other RestError status codes', async () => {
      const serverError = new RestError('Internal Server Error', { statusCode: 500 })
      mockBlockBlobClient.download.mockRejectedValue(serverError)
      
      const result = await GetBlob('test-container', 'test-blob.txt')
      
      expect(result).toEqual({
        status: 'ERROR',
        errors: [
          {
            message: 'Error downloading blob: test-blob.txt',
          },
        ],
      })
    })

    it('should return ERROR for non-RestError exceptions', async () => {
      const genericError = new Error('Network error')
      mockBlockBlobClient.download.mockRejectedValue(genericError)
      
      const result = await GetBlob('test-container', 'test-blob.txt')
      
      expect(result).toEqual({
        status: 'ERROR',
        errors: [
          {
            message: 'Error downloading blob: test-blob.txt',
          },
        ],
      })
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should use default endpoint suffix when not provided', async () => {
      delete process.env.AZURE_STORAGE_ENDPOINT_SUFFIX
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
      process.env.USE_MANAGED_IDENTITIES = 'true'
      
      const mockResponse = { errorCode: undefined }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(BlobServiceClient).toHaveBeenCalledWith(
        'https://teststorage.blob.core.windows.net',
        expect.any(DefaultAzureCredential)
      )
    })

    it('should create connection string correctly for key-based auth', async () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorage'
      process.env.AZURE_STORAGE_ACCOUNT_KEY = 'testkey123'
      process.env.AZURE_STORAGE_ENDPOINT_SUFFIX = 'core.windows.net'
      
      const mockResponse = { errorCode: undefined }
      mockBlockBlobClient.uploadData.mockResolvedValue(mockResponse)
      
      const testData = Buffer.from('test data')
      await UploadBlob('test-container', 'test-blob.txt', testData)
      
      expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith(
        'DefaultEndpointsProtocol=https;AccountName=teststorage;AccountKey=testkey123;EndpointSuffix=core.windows.net'
      )
    })
  })
})