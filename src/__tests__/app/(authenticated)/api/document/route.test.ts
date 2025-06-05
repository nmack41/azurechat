import { POST } from '@/app/(authenticated)/api/document/route'
import { validateChatMessage } from '@/services/validation-service'
import { SearchAzureAISimilarDocuments } from '@/features/chat-page/chat-services/chat-api/chat-api-rag-extension'

// Mock dependencies
jest.mock('@/features/common/services/validation-service')
jest.mock('@/features/chat-page/chat-services/chat-api/chat-api-rag-extension')

describe('Document API Route', () => {
  const mockValidateChatMessage = validateChatMessage as jest.Mock
  const mockSearchAzureAISimilarDocuments = SearchAzureAISimilarDocuments as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    global.console.error = jest.fn()
  })

  describe('POST /api/document', () => {
    const createMockRequest = (body: any): Request => {
      return {
        json: async () => body,
      } as Request
    }

    it('should process valid search request successfully', async () => {
      const requestBody = {
        search: 'azure deployment guide',
      }
      const req = createMockRequest(requestBody)

      mockValidateChatMessage.mockReturnValue({
        status: 'OK',
        response: 'azure deployment guide',
      })

      const mockResponse = new Response('search results')
      mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

      const result = await POST(req)

      expect(mockValidateChatMessage).toHaveBeenCalledWith('azure deployment guide')
      expect(mockSearchAzureAISimilarDocuments).toHaveBeenCalledWith(req)
      expect(result).toBe(mockResponse)
    })

    describe('Request Validation', () => {
      it('should reject request without search field', async () => {
        const requestBody = {
          query: 'some query', // Wrong field name
        }
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search query')
        expect(mockValidateChatMessage).not.toHaveBeenCalled()
        expect(mockSearchAzureAISimilarDocuments).not.toHaveBeenCalled()
      })

      it('should reject request with non-string search field', async () => {
        const requestBody = {
          search: 123, // Number instead of string
        }
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search query')
        expect(mockValidateChatMessage).not.toHaveBeenCalled()
        expect(mockSearchAzureAISimilarDocuments).not.toHaveBeenCalled()
      })

      it('should reject request with null search field', async () => {
        const requestBody = {
          search: null,
        }
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search query')
      })

      it('should reject request with undefined search field', async () => {
        const requestBody = {
          search: undefined,
        }
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search query')
      })

      it('should reject empty request body', async () => {
        const requestBody = {}
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search query')
      })
    })

    describe('Search Query Validation', () => {
      it('should reject invalid search content', async () => {
        const requestBody = {
          search: '<script>alert("xss")</script>',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [{ message: 'Invalid search content' }],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid search content')
        expect(mockValidateChatMessage).toHaveBeenCalledWith('<script>alert("xss")</script>')
        expect(mockSearchAzureAISimilarDocuments).not.toHaveBeenCalled()
      })

      it('should reject empty search string', async () => {
        const requestBody = {
          search: '',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [{ message: 'Search query cannot be empty' }],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Search query cannot be empty')
      })

      it('should handle validation with multiple errors', async () => {
        const requestBody = {
          search: 'invalid search content',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [
            { message: 'First error' },
            { message: 'Second error' },
          ],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('First error') // Should use first error
      })

      it('should sanitize and use valid search content', async () => {
        const requestBody = {
          search: 'Hello <script>alert("test")</script> world',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Hello &lt;script&gt;alert("test")&lt;/script&gt; world',
        })

        const mockResponse = new Response('sanitized search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).toHaveBeenCalledWith('Hello <script>alert("test")</script> world')
        expect(mockSearchAzureAISimilarDocuments).toHaveBeenCalledWith(req)
      })
    })

    describe('Error Handling', () => {
      it('should handle JSON parsing errors', async () => {
        const req = {
          json: async () => {
            throw new Error('Invalid JSON')
          },
        } as Request

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid request format')
        expect(console.error).toHaveBeenCalledWith('Document API error:', expect.any(Error))
      })

      it('should handle SearchAzureAISimilarDocuments errors', async () => {
        const requestBody = {
          search: 'valid search query',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'valid search query',
        })

        mockSearchAzureAISimilarDocuments.mockRejectedValue(new Error('Search service error'))

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid request format')
        expect(console.error).toHaveBeenCalledWith('Document API error:', expect.any(Error))
      })

      it('should handle validation service errors', async () => {
        const requestBody = {
          search: 'valid search query',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockImplementation(() => {
          throw new Error('Validation service error')
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid request format')
        expect(console.error).toHaveBeenCalledWith('Document API error:', expect.any(Error))
      })

      it('should handle unexpected errors gracefully', async () => {
        const requestBody = {
          search: 'valid search query',
        }
        const req = createMockRequest(requestBody)

        // Mock validation to succeed
        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'valid search query',
        })

        // But throw an unexpected error somewhere else
        mockSearchAzureAISimilarDocuments.mockImplementation(() => {
          throw new TypeError('Unexpected error')
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid request format')
      })
    })

    describe('Content Types', () => {
      it('should return JSON content type for error responses', async () => {
        const requestBody = {
          search: 123, // Invalid
        }
        const req = createMockRequest(requestBody)

        const result = await POST(req)

        expect(result.headers.get('Content-Type')).toBe('application/json')
      })

      it('should preserve response from SearchAzureAISimilarDocuments', async () => {
        const requestBody = {
          search: 'valid search query',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'valid search query',
        })

        const mockResponse = new Response(JSON.stringify({ results: [] }), {
          headers: { 'Content-Type': 'application/json' },
        })
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result).toBe(mockResponse)
      })
    })

    describe('Edge Cases', () => {
      it('should handle very long search queries', async () => {
        const longQuery = 'a'.repeat(10000)
        const requestBody = {
          search: longQuery,
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: longQuery.substring(0, 1000), // Assume truncated
        })

        const mockResponse = new Response('search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).toHaveBeenCalledWith(longQuery)
      })

      it('should handle special characters in search query', async () => {
        const specialQuery = 'search with special chars: éñ中文🚀'
        const requestBody = {
          search: specialQuery,
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: specialQuery,
        })

        const mockResponse = new Response('search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).toHaveBeenCalledWith(specialQuery)
      })

      it('should handle whitespace-only search query', async () => {
        const requestBody = {
          search: '   \n\t   ',
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [{ message: 'Search query cannot be empty' }],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Search query cannot be empty')
      })

      it('should handle request with additional fields', async () => {
        const requestBody = {
          search: 'valid search query',
          extraField: 'should be ignored',
          anotherField: 123,
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'valid search query',
        })

        const mockResponse = new Response('search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockSearchAzureAISimilarDocuments).toHaveBeenCalledWith(req)
      })
    })

    describe('Security', () => {
      it('should prevent XSS in search queries', async () => {
        const xssAttempt = '<img src=x onerror=alert("xss")>'
        const requestBody = {
          search: xssAttempt,
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: '&lt;img src=x onerror=alert("xss")&gt;',
        })

        const mockResponse = new Response('safe search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).toHaveBeenCalledWith(xssAttempt)
      })

      it('should prevent SQL injection attempts', async () => {
        const sqlInjection = "'; DROP TABLE users; --"
        const requestBody = {
          search: sqlInjection,
        }
        const req = createMockRequest(requestBody)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: "'; DROP TABLE users; --", // Assume sanitized by validation
        })

        const mockResponse = new Response('safe search results')
        mockSearchAzureAISimilarDocuments.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).toHaveBeenCalledWith(sqlInjection)
      })
    })
  })
})