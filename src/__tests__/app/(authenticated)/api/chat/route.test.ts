import { POST } from '@/app/(authenticated)/api/chat/route'
import { validateChatMessage } from '@/features/common/services/validation-service'
import { ChatAPIEntry } from '@/features/chat-page/chat-services/chat-api/chat-api'

// Mock dependencies
jest.mock('@/features/common/services/validation-service')
jest.mock('@/features/chat-page/chat-services/chat-api/chat-api')

describe('Chat API Route', () => {
  const mockValidateChatMessage = validateChatMessage as jest.Mock
  const mockChatAPIEntry = ChatAPIEntry as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    global.console.error = jest.fn()
  })

  describe('POST /api/chat', () => {
    const createMockRequest = (formData: FormData, signal?: AbortSignal): Request => {
      return {
        formData: async () => formData,
        signal: signal || new AbortController().signal,
      } as Request
    }

    const createFormData = (content?: string, image?: string): FormData => {
      const formData = new FormData()
      if (content) formData.append('content', content)
      if (image) formData.append('image-base64', image)
      return formData
    }

    it('should process valid chat request successfully', async () => {
      const validContent = JSON.stringify({
        id: 'thread-123',
        message: 'Hello world',
      })
      const formData = createFormData(validContent)
      const req = createMockRequest(formData)

      mockValidateChatMessage.mockReturnValue({
        status: 'OK',
        response: 'Hello world',
      })

      const mockResponse = new Response('success')
      mockChatAPIEntry.mockResolvedValue(mockResponse)

      const result = await POST(req)

      expect(mockValidateChatMessage).toHaveBeenCalledWith('Hello world')
      expect(mockChatAPIEntry).toHaveBeenCalledWith(
        {
          id: 'thread-123',
          message: 'Hello world',
          multimodalImage: undefined,
        },
        req.signal
      )
      expect(result).toBe(mockResponse)
    })

    it('should handle request with multimodal image', async () => {
      const validContent = JSON.stringify({
        id: 'thread-123',
        message: 'Check this image',
      })
      const validImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ'
      const formData = createFormData(validContent, validImage)
      const req = createMockRequest(formData)

      mockValidateChatMessage.mockReturnValue({
        status: 'OK',
        response: 'Check this image',
      })

      const mockResponse = new Response('success')
      mockChatAPIEntry.mockResolvedValue(mockResponse)

      const result = await POST(req)

      expect(mockChatAPIEntry).toHaveBeenCalledWith(
        {
          id: 'thread-123',
          message: 'Check this image',
          multimodalImage: validImage,
        },
        req.signal
      )
      expect(result).toBe(mockResponse)
    })

    describe('Content Validation', () => {
      it('should reject non-string content', async () => {
        const formData = new FormData()
        formData.append('content', new Blob(['test']))
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid content format')
      })

      it('should reject invalid JSON content', async () => {
        const formData = createFormData('invalid json {')
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid JSON content')
      })

      it('should reject invalid message content', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: '<script>alert("xss")</script>',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [{ message: 'Invalid message content' }],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid message content')
      })

      it('should use sanitized message content', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Hello <script>alert("test")</script> world',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Hello &lt;script&gt;alert("test")&lt;/script&gt; world',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        await POST(req)

        expect(mockChatAPIEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Hello &lt;script&gt;alert("test")&lt;/script&gt; world',
          }),
          req.signal
        )
      })
    })

    describe('Image Validation', () => {
      it('should accept valid JPEG image', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        const validImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ'
        const formData = createFormData(validContent, validImage)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
      })

      it('should accept valid PNG image', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        const validImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY'
        const formData = createFormData(validContent, validImage)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
      })

      it('should reject invalid image format', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        const invalidImage = 'data:text/plain;base64,dGVzdA=='
        const formData = createFormData(validContent, invalidImage)
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.')
      })

      it('should reject malformed base64 image', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        const invalidImage = 'not-a-base64-image'
        const formData = createFormData(validContent, invalidImage)
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.')
      })

      it('should reject oversized images', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        // Create a large base64 string (> 5MB when decoded)
        const largeImage = 'data:image/jpeg;base64,' + 'A'.repeat(7000000)
        const formData = createFormData(validContent, largeImage)
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Image size exceeds 5MB limit')
      })

      it('should handle image at size limit', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        // Create base64 string at exactly 5MB limit
        const limitImage = 'data:image/jpeg;base64,' + 'A'.repeat(6666666) // ~5MB when decoded
        const formData = createFormData(validContent, limitImage)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
      })

      it('should handle non-string image data', async () => {
        const validContent = JSON.stringify({ id: 'thread-123', message: 'Test' })
        const formData = createFormData(validContent)
        formData.append('image-base64', new Blob(['image data']))
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        await POST(req)

        expect(mockChatAPIEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            multimodalImage: undefined,
          }),
          req.signal
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle ChatAPIEntry errors', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Test message',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test message',
        })

        mockChatAPIEntry.mockRejectedValue(new Error('ChatAPI failed'))

        const result = await POST(req)

        expect(result.status).toBe(500)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('An error occurred processing your request')
        expect(console.error).toHaveBeenCalledWith('Chat API error:', expect.any(Error))
      })

      it('should handle FormData parsing errors', async () => {
        const req = {
          formData: async () => {
            throw new Error('FormData parsing failed')
          },
          signal: new AbortController().signal,
        } as Request

        const result = await POST(req)

        expect(result.status).toBe(500)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('An error occurred processing your request')
        expect(console.error).toHaveBeenCalledWith('Chat API error:', expect.any(Error))
      })

      it('should handle validation service errors', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Test message',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockImplementation(() => {
          throw new Error('Validation service error')
        })

        const result = await POST(req)

        expect(result.status).toBe(500)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('An error occurred processing your request')
      })
    })

    describe('Signal Handling', () => {
      it('should pass abort signal to ChatAPIEntry', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Test message',
        })
        const formData = createFormData(validContent)
        const abortController = new AbortController()
        const req = createMockRequest(formData, abortController.signal)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test message',
        })

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        await POST(req)

        expect(mockChatAPIEntry).toHaveBeenCalledWith(
          expect.any(Object),
          abortController.signal
        )
      })

      it('should handle aborted requests', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Test message',
        })
        const formData = createFormData(validContent)
        const abortController = new AbortController()
        abortController.abort()
        const req = createMockRequest(formData, abortController.signal)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test message',
        })

        mockChatAPIEntry.mockRejectedValue(new DOMException('AbortError', 'AbortError'))

        const result = await POST(req)

        expect(result.status).toBe(500)
      })
    })

    describe('Content Types', () => {
      it('should return JSON content type for all responses', async () => {
        const formData = createFormData('invalid json')
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.headers.get('Content-Type')).toBe('application/json')
      })

      it('should maintain JSON content type for success responses', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: 'Test message',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'OK',
          response: 'Test message',
        })

        // Mock ChatAPIEntry to return a response with different content type
        const mockResponse = new Response('success', {
          headers: { 'Content-Type': 'text/plain' },
        })
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        const result = await POST(req)

        // Should preserve the response from ChatAPIEntry as-is
        expect(result).toBe(mockResponse)
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty form data', async () => {
        const formData = new FormData()
        const req = createMockRequest(formData)

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Invalid content format')
      })

      it('should handle content without message field', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          // No message field
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        const mockResponse = new Response('success')
        mockChatAPIEntry.mockResolvedValue(mockResponse)

        const result = await POST(req)

        expect(result.status).toBe(200)
        expect(mockValidateChatMessage).not.toHaveBeenCalled()
        expect(mockChatAPIEntry).toHaveBeenCalledWith(
          {
            id: 'thread-123',
            multimodalImage: undefined,
          },
          req.signal
        )
      })

      it('should handle empty message field', async () => {
        const validContent = JSON.stringify({
          id: 'thread-123',
          message: '',
        })
        const formData = createFormData(validContent)
        const req = createMockRequest(formData)

        mockValidateChatMessage.mockReturnValue({
          status: 'ERROR',
          errors: [{ message: 'Message cannot be empty' }],
        })

        const result = await POST(req)

        expect(result.status).toBe(400)
        const responseBody = await result.json()
        expect(responseBody.error).toBe('Message cannot be empty')
      })
    })
  })
})