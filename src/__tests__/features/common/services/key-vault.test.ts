import { AzureKeyVaultInstance } from '@/services/key-vault'
import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'

// Mock Azure SDK modules
jest.mock('@azure/identity')
jest.mock('@azure/keyvault-secrets')

describe('Key Vault Service', () => {
  const originalEnv = process.env
  const mockSecretClient = { name: 'mock-secret-client' }

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    
    // Mock SecretClient constructor
    ;(SecretClient as jest.Mock).mockImplementation(() => mockSecretClient)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('AzureKeyVaultInstance', () => {
    it('should create SecretClient with correct parameters', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-keyvault'
      process.env.AZURE_KEY_VAULT_ENDPOINT_SUFFIX = 'vault.azure.net'
      
      const result = AzureKeyVaultInstance()
      
      expect(DefaultAzureCredential).toHaveBeenCalled()
      expect(SecretClient).toHaveBeenCalledWith(
        'https://test-keyvault.vault.azure.net',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSecretClient)
    })

    it('should use default endpoint suffix when not provided', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-keyvault'
      delete process.env.AZURE_KEY_VAULT_ENDPOINT_SUFFIX
      
      const result = AzureKeyVaultInstance()
      
      expect(SecretClient).toHaveBeenCalledWith(
        'https://test-keyvault.vault.azure.net',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSecretClient)
    })

    it('should use custom endpoint suffix when provided', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-keyvault'
      process.env.AZURE_KEY_VAULT_ENDPOINT_SUFFIX = 'vault.azure.cn'
      
      const result = AzureKeyVaultInstance()
      
      expect(SecretClient).toHaveBeenCalledWith(
        'https://test-keyvault.vault.azure.cn',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSecretClient)
    })

    it('should throw error when key vault name is not configured', () => {
      delete process.env.AZURE_KEY_VAULT_NAME
      
      expect(() => AzureKeyVaultInstance()).toThrow(
        'Azure Key vault is not configured correctly, check environment variables.'
      )
    })

    it('should throw error when key vault name is empty string', () => {
      process.env.AZURE_KEY_VAULT_NAME = ''
      
      expect(() => AzureKeyVaultInstance()).toThrow(
        'Azure Key vault is not configured correctly, check environment variables.'
      )
    })

    it('should handle key vault names with special characters', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'my-test-keyvault-123'
      
      const result = AzureKeyVaultInstance()
      
      expect(SecretClient).toHaveBeenCalledWith(
        'https://my-test-keyvault-123.vault.azure.net',
        expect.any(DefaultAzureCredential)
      )
      expect(result).toBe(mockSecretClient)
    })

    it('should always use DefaultAzureCredential (Key Vault requires managed identity)', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-keyvault'
      
      const result = AzureKeyVaultInstance()
      
      expect(DefaultAzureCredential).toHaveBeenCalledTimes(1)
      expect(DefaultAzureCredential).toHaveBeenCalledWith()
      expect(result).toBe(mockSecretClient)
    })
  })

  describe('URL Construction', () => {
    it('should construct URL correctly with different vault names', () => {
      const testCases = [
        { name: 'simple', expected: 'https://simple.vault.azure.net' },
        { name: 'my-vault', expected: 'https://my-vault.vault.azure.net' },
        { name: 'vault123', expected: 'https://vault123.vault.azure.net' },
        { name: 'test-vault-prod', expected: 'https://test-vault-prod.vault.azure.net' },
      ]

      testCases.forEach(({ name, expected }) => {
        jest.resetAllMocks()
        process.env.AZURE_KEY_VAULT_NAME = name
        
        AzureKeyVaultInstance()
        
        expect(SecretClient).toHaveBeenCalledWith(expected, expect.any(DefaultAzureCredential))
      })
    })

    it('should construct URL correctly with different endpoint suffixes', () => {
      const testCases = [
        { suffix: 'vault.azure.net', expected: 'https://test.vault.azure.net' },
        { suffix: 'vault.azure.cn', expected: 'https://test.vault.azure.cn' },
        { suffix: 'vault.azure.us', expected: 'https://test.vault.azure.us' },
        { suffix: 'vault.microsoftazure.de', expected: 'https://test.vault.microsoftazure.de' },
      ]

      testCases.forEach(({ suffix, expected }) => {
        jest.resetAllMocks()
        process.env.AZURE_KEY_VAULT_NAME = 'test'
        process.env.AZURE_KEY_VAULT_ENDPOINT_SUFFIX = suffix
        
        AzureKeyVaultInstance()
        
        expect(SecretClient).toHaveBeenCalledWith(expected, expect.any(DefaultAzureCredential))
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle undefined environment variables gracefully', () => {
      process.env = {}
      
      expect(() => AzureKeyVaultInstance()).toThrow(
        'Azure Key vault is not configured correctly, check environment variables.'
      )
    })

    it('should throw error immediately if key vault name is missing', () => {
      delete process.env.AZURE_KEY_VAULT_NAME
      
      expect(() => AzureKeyVaultInstance()).toThrow()
      expect(SecretClient).not.toHaveBeenCalled()
      expect(DefaultAzureCredential).not.toHaveBeenCalled()
    })

    it('should continue with SecretClient creation if endpoint suffix is missing', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-vault'
      delete process.env.AZURE_KEY_VAULT_ENDPOINT_SUFFIX
      
      expect(() => AzureKeyVaultInstance()).not.toThrow()
      expect(SecretClient).toHaveBeenCalled()
    })
  })

  describe('Credential Creation', () => {
    it('should create new DefaultAzureCredential instance each time', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-vault'
      
      AzureKeyVaultInstance()
      AzureKeyVaultInstance()
      
      expect(DefaultAzureCredential).toHaveBeenCalledTimes(2)
    })

    it('should pass credential to SecretClient constructor', () => {
      process.env.AZURE_KEY_VAULT_NAME = 'test-vault'
      const mockCredential = new DefaultAzureCredential()
      ;(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential)
      
      AzureKeyVaultInstance()
      
      expect(SecretClient).toHaveBeenCalledWith(
        'https://test-vault.vault.azure.net',
        mockCredential
      )
    })
  })
})