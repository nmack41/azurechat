import { InputImageStore, useInputImage } from '@/ui/chat/chat-input-area/input-image-store'
import { renderHook, act } from '@testing-library/react'

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock FileReader
class MockFileReader {
  result: string | null = null
  onload: ((event: any) => void) | null = null
  
  readAsDataURL(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      this.result = `data:${file.type};base64,mockbase64data`
      if (this.onload) {
        this.onload({ target: this })
      }
    }, 0)
  }
}

global.FileReader = MockFileReader as any

// Mock alert
global.alert = jest.fn()

describe('Input Image Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset store state
    InputImageStore.Reset()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(InputImageStore.previewImage).toBe('')
      expect(InputImageStore.base64Image).toBe('')
      expect(InputImageStore.fileUrl).toBe('')
    })

    it('should have working PreViewImage getter', () => {
      expect(InputImageStore.PreViewImage).toBe('')
      
      InputImageStore.previewImage = 'test-url'
      expect(InputImageStore.PreViewImage).toBe('test-url')
    })
  })

  describe('useInputImage Hook', () => {
    it('should return snapshot of image state', () => {
      const { result } = renderHook(() => useInputImage())
      
      expect(result.current.previewImage).toBe('')
      expect(result.current.base64Image).toBe('')
      expect(result.current.fileUrl).toBe('')
    })

    it('should reflect state changes', () => {
      const { result } = renderHook(() => useInputImage())
      
      act(() => {
        InputImageStore.UpdateBase64Image('test-base64')
      })
      
      expect(result.current.base64Image).toBe('test-base64')
    })

    it('should use sync option for immediate updates', () => {
      const { result } = renderHook(() => useInputImage())
      
      act(() => {
        InputImageStore.previewImage = 'new-preview'
      })
      
      // Should immediately reflect the change due to sync: true
      expect(result.current.previewImage).toBe('new-preview')
    })
  })

  describe('State Management', () => {
    it('should update base64 image', () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      
      act(() => {
        InputImageStore.UpdateBase64Image(base64Data)
      })
      
      expect(InputImageStore.base64Image).toBe(base64Data)
    })

    it('should reset all state', () => {
      // Set some state first
      InputImageStore.previewImage = 'test-preview'
      InputImageStore.base64Image = 'test-base64'
      InputImageStore.fileUrl = 'test-filename.jpg'
      
      act(() => {
        InputImageStore.Reset()
      })
      
      expect(InputImageStore.previewImage).toBe('')
      expect(InputImageStore.base64Image).toBe('')
      expect(InputImageStore.fileUrl).toBe('')
    })
  })

  describe('File Processing', () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      const file = new File(['mock content'], name, { type })
      
      // Mock the size property
      Object.defineProperty(file, 'size', {
        value: size,
        writable: false,
      })
      
      return file
    }

    const createMockEvent = (file: File | null): React.ChangeEvent<HTMLInputElement> => {
      const mockInput = {
        files: file ? [file] : null,
        value: file ? file.name : '',
      } as any
      
      return {
        target: mockInput,
      } as React.ChangeEvent<HTMLInputElement>
    }

    it('should process valid image file successfully', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024) // 1MB
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        // Wait for FileReader mock to complete
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(InputImageStore.previewImage).toBe('blob:mock-url')
      expect(InputImageStore.base64Image).toBe('data:image/jpeg;base64,mockbase64data')
      expect(InputImageStore.fileUrl).toBe('test.jpg')
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file)
    })

    it('should handle PNG files', async () => {
      const file = createMockFile('test.png', 'image/png', 2 * 1024 * 1024) // 2MB
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(InputImageStore.base64Image).toBe('data:image/png;base64,mockbase64data')
      expect(InputImageStore.fileUrl).toBe('test.png')
    })

    it('should handle GIF files', async () => {
      const file = createMockFile('test.gif', 'image/gif', 3 * 1024 * 1024) // 3MB
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(InputImageStore.base64Image).toBe('data:image/gif;base64,mockbase64data')
      expect(InputImageStore.fileUrl).toBe('test.gif')
    })

    it('should handle WebP files', async () => {
      const file = createMockFile('test.webp', 'image/webp', 1.5 * 1024 * 1024) // 1.5MB
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(InputImageStore.base64Image).toBe('data:image/webp;base64,mockbase64data')
      expect(InputImageStore.fileUrl).toBe('test.webp')
    })
  })

  describe('File Validation', () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      const file = new File(['mock content'], name, { type })
      Object.defineProperty(file, 'size', { value: size, writable: false })
      return file
    }

    const createMockEvent = (file: File | null): React.ChangeEvent<HTMLInputElement> => {
      const mockInput = {
        files: file ? [file] : null,
        value: file ? file.name : '',
      } as any
      
      return {
        target: mockInput,
      } as React.ChangeEvent<HTMLInputElement>
    }

    it('should reject invalid file types', async () => {
      const file = createMockFile('test.txt', 'text/plain', 1024)
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
      })
      
      expect(global.alert).toHaveBeenCalledWith('Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.')
      expect(event.target.value).toBe('')
      expect(InputImageStore.previewImage).toBe('')
      expect(InputImageStore.base64Image).toBe('')
    })

    it('should reject files that are too large', async () => {
      const file = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024) // 6MB (exceeds 5MB limit)
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
      })
      
      expect(global.alert).toHaveBeenCalledWith('Image size exceeds 5MB limit.')
      expect(event.target.value).toBe('')
      expect(InputImageStore.previewImage).toBe('')
      expect(InputImageStore.base64Image).toBe('')
    })

    it('should accept file at size limit', async () => {
      const file = createMockFile('limit.jpg', 'image/jpeg', 5 * 1024 * 1024) // Exactly 5MB
      const event = createMockEvent(file)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.fileUrl).toBe('limit.jpg')
    })

    it('should handle jpeg vs jpg MIME types', async () => {
      const jpegFile = createMockFile('test.jpeg', 'image/jpeg', 1024)
      const jpgFile = createMockFile('test.jpg', 'image/jpg', 1024)
      
      // Test JPEG
      const jpegEvent = createMockEvent(jpegFile)
      await act(async () => {
        await InputImageStore.OnFileChange(jpegEvent)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.fileUrl).toBe('test.jpeg')
      
      // Reset and test JPG
      InputImageStore.Reset()
      jest.clearAllMocks()
      
      const jpgEvent = createMockEvent(jpgFile)
      await act(async () => {
        await InputImageStore.OnFileChange(jpgEvent)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.fileUrl).toBe('test.jpg')
    })
  })

  describe('Error Handling', () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      const file = new File(['mock content'], name, { type })
      Object.defineProperty(file, 'size', { value: size, writable: false })
      return file
    }

    const createMockEvent = (file: File | null): React.ChangeEvent<HTMLInputElement> => {
      const mockInput = {
        files: file ? [file] : null,
        value: file ? file.name : '',
      } as any
      
      return {
        target: mockInput,
      } as React.ChangeEvent<HTMLInputElement>
    }

    it('should handle FileReader errors', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const event = createMockEvent(file)
      
      // Mock FileReader to reject
      class ErrorFileReader {
        readAsDataURL() {
          setTimeout(() => {
            throw new Error('File read error')
          }, 0)
        }
      }
      
      const originalFileReader = global.FileReader
      global.FileReader = ErrorFileReader as any
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(global.alert).toHaveBeenCalledWith('Failed to process image. Please try again.')
      expect(event.target.value).toBe('')
      
      // Restore original FileReader
      global.FileReader = originalFileReader
    })

    it('should handle no file selected', async () => {
      const event = createMockEvent(null)
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
      })
      
      // Should not do anything, no alerts
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.previewImage).toBe('')
    })

    it('should handle empty files array', async () => {
      const event = {
        target: {
          files: [],
          value: '',
        },
      } as any
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
      })
      
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.previewImage).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero-byte files', async () => {
      const file = new File([], 'empty.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 0, writable: false })
      
      const event = {
        target: {
          files: [file],
          value: 'empty.jpg',
        },
      } as any
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      // Should process normally (0 bytes is valid)
      expect(global.alert).not.toHaveBeenCalled()
      expect(InputImageStore.fileUrl).toBe('empty.jpg')
    })

    it('should handle files with unusual names', async () => {
      const file = new File(['content'], 'file with spaces & symbols!.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 1024, writable: false })
      
      const event = {
        target: {
          files: [file],
          value: 'file with spaces & symbols!.png',
        },
      } as any
      
      await act(async () => {
        await InputImageStore.OnFileChange(event)
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      expect(InputImageStore.fileUrl).toBe('file with spaces & symbols!.png')
    })

    it('should handle concurrent file changes', async () => {
      const file1 = new File(['content1'], 'first.jpg', { type: 'image/jpeg' })
      const file2 = new File(['content2'], 'second.png', { type: 'image/png' })
      
      Object.defineProperty(file1, 'size', { value: 1024, writable: false })
      Object.defineProperty(file2, 'size', { value: 2048, writable: false })
      
      const event1 = { target: { files: [file1], value: 'first.jpg' } } as any
      const event2 = { target: { files: [file2], value: 'second.png' } } as any
      
      // Start both file processing concurrently
      await act(async () => {
        const promise1 = InputImageStore.OnFileChange(event1)
        const promise2 = InputImageStore.OnFileChange(event2)
        
        await Promise.all([promise1, promise2])
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      
      // Last processed file should win
      expect(InputImageStore.fileUrl).toBe('second.png')
      expect(InputImageStore.base64Image).toBe('data:image/png;base64,mockbase64data')
    })
  })
})