import {
  validateFile,
  validateDocumentUpload,
  validateImageUpload,
  validateChatMessage,
  validateChatInput,
  sanitizeInput,
  generateSecureSecret,
} from '@/features/common/services/validation-service'

describe('Validation Service', () => {
  describe('sanitizeInput', () => {
    it('should sanitize basic XSS attempts', () => {
      const maliciousInput = '<script>alert("xss")</script>'
      const result = sanitizeInput(maliciousInput, { maxLength: 100, allowNewlines: false })
      
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
    })

    it('should respect max length limits', () => {
      const longInput = 'a'.repeat(1000)
      const result = sanitizeInput(longInput, { maxLength: 10, allowNewlines: false })
      
      expect(result.length).toBe(10)
    })

    it('should handle newlines based on options', () => {
      const inputWithNewlines = 'line1\nline2\rline3'
      
      const withNewlines = sanitizeInput(inputWithNewlines, { maxLength: 100, allowNewlines: true })
      const withoutNewlines = sanitizeInput(inputWithNewlines, { maxLength: 100, allowNewlines: false })
      
      expect(withNewlines).toContain('\n')
      expect(withoutNewlines).not.toContain('\n')
      expect(withoutNewlines).toContain(' ')
    })

    it('should remove control characters', () => {
      const inputWithControls = 'text\x00\x01\x02more'
      const result = sanitizeInput(inputWithControls, { maxLength: 100, allowNewlines: false })
      
      expect(result).toBe('textmore')
    })
  })

  describe('validateChatMessage', () => {
    it('should accept valid messages', () => {
      const validMessage = 'Hello, this is a normal chat message.'
      const result = validateChatMessage(validMessage)
      
      expect(result.status).toBe('OK')
      expect(result.response).toBe(validMessage)
    })

    it('should reject empty messages', () => {
      const result = validateChatMessage('')
      
      expect(result.status).toBe('ERROR')
      expect(result.errors).toEqual([{ message: 'Message is required' }])
    })

    it('should reject non-string inputs', () => {
      const result = validateChatMessage(null as any)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors).toEqual([{ message: 'Message is required' }])
    })

    it('should sanitize XSS in messages', () => {
      const maliciousMessage = 'Hello <script>alert("xss")</script> world'
      const result = validateChatMessage(maliciousMessage)
      
      expect(result.status).toBe('OK')
      expect(result.response).toContain('&lt;script&gt;')
      expect(result.response).not.toContain('<script>')
    })

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(20000)
      const result = validateChatMessage(longMessage)
      
      expect(result.status).toBe('OK')
      expect(result.response!.length).toBeLessThanOrEqual(10000)
    })
  })

  describe('validateChatInput', () => {
    const validInput = {
      content: 'Test message',
      name: 'Test User',
      chatThreadId: 'thread-123',
      multiModalImage: undefined,
    }

    it('should accept valid chat input', async () => {
      const result = await validateChatInput(validInput)
      
      expect(result.status).toBe('OK')
    })

    it('should reject missing content', async () => {
      const result = await validateChatInput({
        ...validInput,
        content: '',
      })
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('required')
    })

    it('should reject invalid thread ID format', async () => {
      const result = await validateChatInput({
        ...validInput,
        chatThreadId: 'invalid thread id with spaces!',
      })
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('Invalid chat thread ID format')
    })

    it('should validate base64 images', async () => {
      const validBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      
      const result = await validateChatInput({
        ...validInput,
        multiModalImage: validBase64,
      })
      
      expect(result.status).toBe('OK')
    })

    it('should reject invalid base64 images', async () => {
      const result = await validateChatInput({
        ...validInput,
        multiModalImage: 'invalid-base64-string',
      })
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('Invalid base64 image format')
    })

    it('should reject oversized images', async () => {
      // Create a very large base64 string (> 5MB)
      const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(7000000)
      
      const result = await validateChatInput({
        ...validInput,
        multiModalImage: largeBase64,
      })
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('exceeds 5MB limit')
    })
  })

  describe('validateFile', () => {
    const createMockFile = (name: string, type: string, size: number, content?: string): File => {
      const blob = new Blob([content || 'test content'], { type })
      const file = new File([blob], name, { type })
      
      // Mock the size property
      Object.defineProperty(file, 'size', {
        value: size,
        writable: false,
      })
      
      return file
    }

    const createMockFileWithContent = (name: string, type: string, size: number, content: Uint8Array): File => {
      // Create a proper mock file with specific binary content
      const mockFile = {
        name,
        type,
        size,
        arrayBuffer: jest.fn().mockResolvedValue(content.buffer),
        text: jest.fn().mockResolvedValue(''),
      } as unknown as File
      
      return mockFile
    }

    it('should accept valid PDF files with correct signature', async () => {
      // PDF signature: %PDF
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      const pdfFile = createMockFileWithContent('test.pdf', 'application/pdf', 1024, pdfContent)
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(pdfFile, allowedTypes)
      
      expect(result.status).toBe('OK')
      expect(result.response!.isValid).toBe(true)
    })

    it('should accept text files without signature check', async () => {
      const mockTextFile = {
        name: 'test.txt',
        type: 'text/plain',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
        text: jest.fn().mockResolvedValue('Hello world'),
      } as unknown as File
      
      const allowedTypes = {
        'text/plain': { ext: ['.txt'], maxSize: 5 * 1024 * 1024 },
      }
      
      const result = await validateFile(mockTextFile, allowedTypes)
      
      expect(result.status).toBe('OK')
      expect(result.response!.isValid).toBe(true)
    })

    it('should reject files with wrong extension', async () => {
      const file = createMockFile('test.txt', 'application/pdf', 1024)
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(file, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain("File extension '.txt' does not match MIME type 'application/pdf'")
    })

    it('should reject oversized files', async () => {
      const largeFile = createMockFile('test.pdf', 'application/pdf', 50 * 1024 * 1024) // 50MB
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 }, // 10MB limit
      }
      
      const result = await validateFile(largeFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('File size exceeds maximum allowed size of 10.0MB')
    })

    it('should reject disallowed file types', async () => {
      const jsFile = createMockFile('malware.js', 'application/javascript', 1024)
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(jsFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain("File type 'application/javascript' is not allowed")
    })

    it('should reject empty files', async () => {
      const emptyFile = createMockFile('empty.pdf', 'application/pdf', 0)
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(emptyFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('File is empty')
    })

    it('should reject files with wrong signature', async () => {
      // Wrong signature for PDF (should start with %PDF)
      const wrongContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG signature
      const fakeFile = createMockFileWithContent('fake.pdf', 'application/pdf', 1024, wrongContent)
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(fakeFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('File content does not match declared file type')
    })

    it('should validate SVG files and reject dangerous content', async () => {
      const dangerousSvg = '<svg><script>alert("xss")</script></svg>'
      const svgBytes = new TextEncoder().encode(dangerousSvg)
      const mockSvgFile = {
        name: 'test.svg',
        type: 'image/svg+xml',
        size: svgBytes.length,
        arrayBuffer: jest.fn().mockResolvedValue(svgBytes.buffer),
        text: jest.fn().mockResolvedValue(dangerousSvg),
      } as unknown as File
      
      const allowedTypes = {
        'image/svg+xml': { ext: ['.svg'], maxSize: 2 * 1024 * 1024 },
      }
      
      const result = await validateFile(mockSvgFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('SVG file contains potentially dangerous content')
    })

    it('should accept safe SVG files', async () => {
      const safeSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>'
      const svgBytes = new TextEncoder().encode(safeSvg)
      const mockSvgFile = {
        name: 'test.svg',
        type: 'image/svg+xml', 
        size: svgBytes.length,
        arrayBuffer: jest.fn().mockResolvedValue(svgBytes.buffer),
        text: jest.fn().mockResolvedValue(safeSvg),
      } as unknown as File
      
      const allowedTypes = {
        'image/svg+xml': { ext: ['.svg'], maxSize: 2 * 1024 * 1024 },
      }
      
      const result = await validateFile(mockSvgFile, allowedTypes)
      
      expect(result.status).toBe('OK')
      expect(result.response!.isValid).toBe(true)
    })

    it('should handle file validation errors gracefully', async () => {
      const errorFile = {
        name: 'error.pdf',
        type: 'application/pdf',
        size: 1024,
        arrayBuffer: jest.fn().mockRejectedValue(new Error('File read error')),
      } as unknown as File
      
      const allowedTypes = {
        'application/pdf': { ext: ['.pdf'], maxSize: 10 * 1024 * 1024 },
      }
      
      const result = await validateFile(errorFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain('File validation error')
    })

    it('should handle files without extensions', async () => {
      const noExtFile = createMockFile('README', 'text/plain', 1024)
      const allowedTypes = {
        'text/plain': { ext: ['.txt'], maxSize: 5 * 1024 * 1024 },
      }
      
      const result = await validateFile(noExtFile, allowedTypes)
      
      expect(result.status).toBe('ERROR')
      expect(result.errors![0].message).toContain("File extension '' does not match MIME type")
    })
  })

  describe('generateSecureSecret', () => {
    it('should generate secrets of correct length', () => {
      const secret32 = generateSecureSecret(32)
      const secret64 = generateSecureSecret(64)
      
      expect(secret32.length).toBe(64) // 32 bytes = 64 hex chars
      expect(secret64.length).toBe(128) // 64 bytes = 128 hex chars
    })

    it('should generate different secrets each time', () => {
      const secret1 = generateSecureSecret()
      const secret2 = generateSecureSecret()
      
      expect(secret1).not.toBe(secret2)
    })

    it('should only contain valid hex characters', () => {
      const secret = generateSecureSecret()
      
      expect(secret).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', async () => {
      expect(() => sanitizeInput(null as any, { maxLength: 100 })).not.toThrow()
      expect(() => sanitizeInput(undefined as any, { maxLength: 100 })).not.toThrow()
      
      const result = validateChatMessage(undefined as any)
      expect(result.status).toBe('ERROR')
    })

    it('should prevent prototype pollution attempts', () => {
      const maliciousInput = '{"__proto__": {"isAdmin": true}}'
      const result = sanitizeInput(maliciousInput, { maxLength: 1000, allowNewlines: false })
      
      // Should be escaped and not executable
      expect(result).toContain('&quot;')
      expect(result).not.toContain('"')
    })

    it('should handle unicode and emoji inputs', () => {
      const unicodeInput = 'Hello 👋 世界 🌍'
      const result = sanitizeInput(unicodeInput, { maxLength: 100, allowNewlines: false })
      
      expect(result).toContain('👋')
      expect(result).toContain('世界')
      expect(result).toContain('🌍')
    })
  })
})