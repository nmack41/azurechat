import { DocumentIntelligenceInstance } from '@/services/document-intelligence'
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer'
import { DefaultAzureCredential } from '@azure/identity'

// Mock Azure SDK modules
jest.mock('@azure/ai-form-recognizer')
jest.mock('@azure/identity')

describe('Document Intelligence Service', () => {
  const originalEnv = process.env
  const mockDocumentAnalysisClient = { name: 'mock-client' }

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock DocumentAnalysisClient constructor
    ;(DocumentAnalysisClient as jest.Mock).mockImplementation(() => mockDocumentAnalysisClient)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('DocumentIntelligenceInstance', () => {
    beforeEach(() => {
      // Suppress console.log calls during tests
      jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      ;(console.log as jest.Mock).mockRestore()
    })

    it('should create DocumentAnalysisClient with key-based authentication', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key-123'
      
      const result = DocumentIntelligenceInstance()
      
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://test-doc-intel.cognitiveservices.azure.com/',
        expect.any(AzureKeyCredential)
      )
      expect(AzureKeyCredential).toHaveBeenCalledWith('test-key-123')
      expect(result).toBe(mockDocumentAnalysisClient)
    })

    it('should create DocumentAnalysisClient with managed identity authentication', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      
      const result = DocumentIntelligenceInstance()
      
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://test-doc-intel.cognitiveservices.azure.com/',
        expect.any(DefaultAzureCredential)
      )
      expect(DefaultAzureCredential).toHaveBeenCalled()
      expect(result).toBe(mockDocumentAnalysisClient)
    })

    it('should default to key-based auth when USE_MANAGED_IDENTITIES is not set', () => {
      delete process.env.USE_MANAGED_IDENTITIES
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key-123'
      
      const result = DocumentIntelligenceInstance()
      
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://test-doc-intel.cognitiveservices.azure.com/',
        expect.any(AzureKeyCredential)
      )
      expect(result).toBe(mockDocumentAnalysisClient)
    })

    it('should throw error when endpoint is not configured', () => {
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
      
      expect(() => DocumentIntelligenceInstance()).toThrow(
        'Document Intelligence environment variable for the endpoint is not set'
      )
    })

    it('should throw error when key is missing for key-based auth', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
      
      expect(() => DocumentIntelligenceInstance()).toThrow(
        'Document Intelligence environment variable for the key is not set'
      )
    })

    it('should not require key when using managed identities', () => {
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
      
      expect(() => DocumentIntelligenceInstance()).not.toThrow()
      
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://test-doc-intel.cognitiveservices.azure.com/',
        expect.any(DefaultAzureCredential)
      )
    })
  })

  describe('Logging Behavior', () => {
    it('should log managed identities usage', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      
      // Re-import to trigger the console.log at module level
      jest.resetModules()
      require('@/features/common/services/document-intelligence')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Using Managed Identities:', true)
      
      consoleLogSpy.mockRestore()
    })

    it('should log endpoint when creating instance', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key'
      
      DocumentIntelligenceInstance()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Document Intelligence Endpoint:',
        'https://test-doc-intel.cognitiveservices.azure.com/'
      )
      
      consoleLogSpy.mockRestore()
    })

    it('should log credential type being used', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key'
      
      DocumentIntelligenceInstance()
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Credential obtained using', 'API Key')
      
      consoleLogSpy.mockRestore()
    })

    it('should log credential type for managed identities', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.USE_MANAGED_IDENTITIES = 'true'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      
      DocumentIntelligenceInstance()
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Credential obtained using', 'Managed Identities')
      
      consoleLogSpy.mockRestore()
    })
  })

  describe('Debug Mode', () => {
    it('should log client details when debug is enabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.DEBUG = 'true'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key'
      
      DocumentIntelligenceInstance()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Document Analysis Client created:',
        mockDocumentAnalysisClient
      )
      
      consoleLogSpy.mockRestore()
    })

    it('should not log client details when debug is disabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      
      process.env.DEBUG = 'false'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key'
      
      DocumentIntelligenceInstance()
      
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'Document Analysis Client created:',
        expect.anything()
      )
      
      consoleLogSpy.mockRestore()
    })
  })

  describe('Environment Variable Edge Cases', () => {
    it('should handle empty endpoint gracefully', () => {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = ''
      
      expect(() => DocumentIntelligenceInstance()).toThrow(
        'Document Intelligence environment variable for the endpoint is not set'
      )
    })

    it('should handle empty key for key-based auth', () => {
      process.env.USE_MANAGED_IDENTITIES = 'false'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test-doc-intel.cognitiveservices.azure.com/'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = ''
      
      expect(() => DocumentIntelligenceInstance()).toThrow(
        'Document Intelligence environment variable for the key is not set'
      )
    })

    it('should work with different endpoint formats', () => {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://my-custom-endpoint.com'
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key'
      
      const result = DocumentIntelligenceInstance()
      
      expect(DocumentAnalysisClient).toHaveBeenCalledWith(
        'https://my-custom-endpoint.com',
        expect.any(AzureKeyCredential)
      )
    })
  })
})