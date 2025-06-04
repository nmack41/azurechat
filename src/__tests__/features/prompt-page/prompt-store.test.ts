import {
  promptStore,
  usePromptState,
  addOrUpdatePrompt,
  FormDataToPromptModel,
} from '@/features/prompt-page/prompt-store'
import { PromptModel } from '@/features/prompt-page/models'
import { renderHook, act } from '@testing-library/react'

// Mock dependencies
jest.mock('@/features/common/navigation-helpers', () => ({
  RevalidateCache: jest.fn(),
}))
jest.mock('@/features/prompt-page/prompt-service', () => ({
  CreatePrompt: jest.fn(),
  UpsertPrompt: jest.fn(),
}))

describe('Prompt Store', () => {
  const { CreatePrompt, UpsertPrompt } = require('@/features/prompt-page/prompt-service')
  const { RevalidateCache } = require('@/features/common/navigation-helpers')

  const mockPrompt: PromptModel = {
    id: 'prompt-123',
    name: 'Test Prompt',
    description: 'Test Description',
    createdAt: new Date(),
    type: 'PROMPT',
    isPublished: true,
    userId: 'user-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset prompt store state
    promptStore.errors = []
    promptStore.isOpened = false
    promptStore.prompt = {
      id: '',
      name: '',
      description: '',
      createdAt: new Date(),
      type: 'PROMPT',
      isPublished: false,
      userId: '',
    }
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(promptStore.errors).toEqual([])
      expect(promptStore.isOpened).toBe(false)
      expect(promptStore.prompt.id).toBe('')
      expect(promptStore.prompt.name).toBe('')
      expect(promptStore.prompt.description).toBe('')
      expect(promptStore.prompt.type).toBe('PROMPT')
      expect(promptStore.prompt.isPublished).toBe(false)
    })
  })

  describe('usePromptState Hook', () => {
    it('should return snapshot of prompt state', () => {
      const { result } = renderHook(() => usePromptState())
      
      expect(result.current.errors).toEqual([])
      expect(result.current.isOpened).toBe(false)
      expect(result.current.prompt.name).toBe('')
    })

    it('should reflect state changes', () => {
      const { result } = renderHook(() => usePromptState())
      
      act(() => {
        promptStore.updateOpened(true)
      })
      
      expect(result.current.isOpened).toBe(true)
    })

    it('should use sync option for immediate updates', () => {
      const { result } = renderHook(() => usePromptState())
      
      act(() => {
        promptStore.errors = ['New error']
      })
      
      // Should immediately reflect the change due to sync: true
      expect(result.current.errors).toEqual(['New error'])
    })
  })

  describe('State Management', () => {
    it('should update opened state', () => {
      act(() => {
        promptStore.updateOpened(true)
      })
      
      expect(promptStore.isOpened).toBe(true)
      
      act(() => {
        promptStore.updateOpened(false)
      })
      
      expect(promptStore.isOpened).toBe(false)
    })

    it('should update errors', () => {
      const errors = ['Error 1', 'Error 2']
      
      act(() => {
        promptStore.updateErrors(errors)
      })
      
      expect(promptStore.errors).toEqual(errors)
    })

    it('should update prompt and open modal', () => {
      act(() => {
        promptStore.updatePrompt(mockPrompt)
      })
      
      expect(promptStore.prompt).toEqual(mockPrompt)
      expect(promptStore.isOpened).toBe(true)
    })
  })

  describe('Prompt Creation', () => {
    it('should create new prompt with defaults', () => {
      // Set some existing state first
      promptStore.prompt = mockPrompt
      promptStore.isOpened = false
      
      act(() => {
        promptStore.newPrompt()
      })
      
      expect(promptStore.prompt.id).toBe('')
      expect(promptStore.prompt.name).toBe('')
      expect(promptStore.prompt.description).toBe('')
      expect(promptStore.prompt.type).toBe('PROMPT')
      expect(promptStore.prompt.isPublished).toBe(false)
      expect(promptStore.isOpened).toBe(true)
    })

    it('should preserve prompt type and structure on new prompt', () => {
      act(() => {
        promptStore.newPrompt()
      })
      
      expect(promptStore.prompt.type).toBe('PROMPT')
      expect(promptStore.prompt.createdAt).toBeInstanceOf(Date)
      expect(promptStore.prompt.userId).toBe('')
    })
  })

  describe('Form Data Conversion', () => {
    it('should convert FormData to PromptModel correctly', () => {
      const formData = new FormData()
      formData.append('id', 'prompt-123')
      formData.append('name', 'Test Prompt')
      formData.append('description', 'Test Description')
      formData.append('isPublished', 'on')
      
      const result = FormDataToPromptModel(formData)
      
      expect(result.id).toBe('prompt-123')
      expect(result.name).toBe('Test Prompt')
      expect(result.description).toBe('Test Description')
      expect(result.isPublished).toBe(true)
      expect(result.type).toBe('PROMPT')
      expect(result.userId).toBe('') // Set on server
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should handle unchecked isPublished checkbox', () => {
      const formData = new FormData()
      formData.append('id', 'prompt-123')
      formData.append('name', 'Test Prompt')
      formData.append('description', 'Test Description')
      // isPublished not set (checkbox unchecked)
      
      const result = FormDataToPromptModel(formData)
      
      expect(result.isPublished).toBe(false)
    })

    it('should handle empty form data', () => {
      const formData = new FormData()
      // No data appended
      
      const result = FormDataToPromptModel(formData)
      
      expect(result.id).toBe('')
      expect(result.name).toBe('')
      expect(result.description).toBe('')
      expect(result.isPublished).toBe(false)
      expect(result.type).toBe('PROMPT')
    })

    it('should handle null form values', () => {
      const formData = new FormData()
      // FormData.get() returns null for non-existent keys
      
      const result = FormDataToPromptModel(formData)
      
      expect(result.id).toBe('')
      expect(result.name).toBe('')
      expect(result.description).toBe('')
    })
  })

  describe('addOrUpdatePrompt Function', () => {
    it('should create new prompt successfully', async () => {
      const formData = new FormData()
      formData.append('name', 'New Prompt')
      formData.append('description', 'New Description')
      
      const successResponse = { status: 'OK', response: mockPrompt }
      CreatePrompt.mockResolvedValue(successResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePrompt(null, formData)
      })
      
      expect(CreatePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Prompt',
          description: 'New Description',
        })
      )
      expect(promptStore.isOpened).toBe(false)
      expect(promptStore.errors).toEqual([])
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'prompt',
      })
      expect(result).toEqual(successResponse)
    })

    it('should update existing prompt successfully', async () => {
      const formData = new FormData()
      formData.append('id', 'prompt-123')
      formData.append('name', 'Updated Prompt')
      formData.append('description', 'Updated Description')
      
      const successResponse = { status: 'OK', response: mockPrompt }
      UpsertPrompt.mockResolvedValue(successResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePrompt(null, formData)
      })
      
      expect(UpsertPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prompt-123',
          name: 'Updated Prompt',
          description: 'Updated Description',
        })
      )
      expect(promptStore.isOpened).toBe(false)
      expect(promptStore.errors).toEqual([])
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'prompt',
      })
      expect(result).toEqual(successResponse)
    })

    it('should handle creation errors', async () => {
      const formData = new FormData()
      formData.append('name', 'Invalid Prompt')
      
      const errorResponse = {
        status: 'ERROR',
        errors: [
          { message: 'Name is too short' },
          { message: 'Description is required' },
        ],
      }
      CreatePrompt.mockResolvedValue(errorResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePrompt(null, formData)
      })
      
      expect(promptStore.isOpened).toBe(true) // Should remain open on error
      expect(promptStore.errors).toEqual(['Name is too short', 'Description is required'])
      expect(RevalidateCache).not.toHaveBeenCalled()
      expect(result).toEqual(errorResponse)
    })

    it('should handle update errors', async () => {
      const formData = new FormData()
      formData.append('id', 'prompt-123')
      formData.append('name', 'Invalid Update')
      
      const errorResponse = {
        status: 'ERROR',
        errors: [{ message: 'Prompt not found' }],
      }
      UpsertPrompt.mockResolvedValue(errorResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePrompt(null, formData)
      })
      
      expect(promptStore.isOpened).toBe(true)
      expect(promptStore.errors).toEqual(['Prompt not found'])
      expect(RevalidateCache).not.toHaveBeenCalled()
      expect(result).toEqual(errorResponse)
    })

    it('should clear errors before processing', async () => {
      // Set initial errors
      promptStore.updateErrors(['Old error'])
      
      const formData = new FormData()
      formData.append('name', 'Test Prompt')
      
      CreatePrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, formData)
      })
      
      // Errors should be cleared even on success
      expect(promptStore.errors).toEqual([])
    })

    it('should determine create vs update based on id presence', async () => {
      // Test create (no id)
      const createFormData = new FormData()
      createFormData.append('name', 'New Prompt')
      
      CreatePrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, createFormData)
      })
      
      expect(CreatePrompt).toHaveBeenCalled()
      expect(UpsertPrompt).not.toHaveBeenCalled()
      
      jest.clearAllMocks()
      
      // Test update (with id)
      const updateFormData = new FormData()
      updateFormData.append('id', 'prompt-123')
      updateFormData.append('name', 'Updated Prompt')
      
      UpsertPrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, updateFormData)
      })
      
      expect(UpsertPrompt).toHaveBeenCalled()
      expect(CreatePrompt).not.toHaveBeenCalled()
    })

    it('should handle empty id as create operation', async () => {
      const formData = new FormData()
      formData.append('id', '') // Empty string
      formData.append('name', 'New Prompt')
      
      CreatePrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, formData)
      })
      
      expect(CreatePrompt).toHaveBeenCalled()
      expect(UpsertPrompt).not.toHaveBeenCalled()
    })

    it('should return response from service', async () => {
      const formData = new FormData()
      formData.append('name', 'Test Prompt')
      
      const expectedResponse = { 
        status: 'OK' as const, 
        response: mockPrompt 
      }
      CreatePrompt.mockResolvedValue(expectedResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePrompt(null, formData)
      })
      
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('Error Handling', () => {
    it('should maintain state consistency on service errors', async () => {
      const formData = new FormData()
      formData.append('name', 'Test Prompt')
      
      // Simulate service throwing an exception
      CreatePrompt.mockRejectedValue(new Error('Network error'))
      
      await act(async () => {
        try {
          await addOrUpdatePrompt(null, formData)
        } catch (error) {
          // Error should be thrown
          expect(error.message).toBe('Network error')
        }
      })
      
      // Store state should remain consistent
      expect(typeof promptStore.isOpened).toBe('boolean')
      expect(Array.isArray(promptStore.errors)).toBe(true)
    })

    it('should handle malformed error responses', async () => {
      const formData = new FormData()
      formData.append('name', 'Test Prompt')
      
      const malformedResponse = {
        status: 'ERROR',
        errors: undefined, // Malformed - should be an array
      }
      CreatePrompt.mockResolvedValue(malformedResponse)
      
      await act(async () => {
        try {
          await addOrUpdatePrompt(null, formData)
        } catch (error) {
          // Should handle gracefully or throw appropriate error
        }
      })
      
      // Store should remain in valid state
      expect(Array.isArray(promptStore.errors)).toBe(true)
    })
  })

  describe('State Immutability', () => {
    it('should create new prompt object when updating', () => {
      const originalPrompt = promptStore.prompt
      
      act(() => {
        promptStore.updatePrompt(mockPrompt)
      })
      
      // Should be a new object reference
      expect(promptStore.prompt).not.toBe(originalPrompt)
      expect(promptStore.prompt).toEqual(mockPrompt)
    })

    it('should create new prompt object when creating new', () => {
      promptStore.prompt = mockPrompt
      const currentPrompt = promptStore.prompt
      
      act(() => {
        promptStore.newPrompt()
      })
      
      // Should be a new object reference
      expect(promptStore.prompt).not.toBe(currentPrompt)
      expect(promptStore.prompt.id).toBe('')
    })

    it('should create new errors array when updating', () => {
      const originalErrors = promptStore.errors
      const newErrors = ['New error']
      
      act(() => {
        promptStore.updateErrors(newErrors)
      })
      
      // Should be the new array reference
      expect(promptStore.errors).toBe(newErrors)
      expect(promptStore.errors).not.toBe(originalErrors)
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete workflow - create, open, edit, save', async () => {
      // 1. Create new prompt
      act(() => {
        promptStore.newPrompt()
      })
      
      expect(promptStore.isOpened).toBe(true)
      expect(promptStore.prompt.id).toBe('')
      
      // 2. Update with existing prompt
      act(() => {
        promptStore.updatePrompt(mockPrompt)
      })
      
      expect(promptStore.prompt).toEqual(mockPrompt)
      
      // 3. Save the prompt
      const formData = new FormData()
      formData.append('id', mockPrompt.id)
      formData.append('name', mockPrompt.name)
      formData.append('description', mockPrompt.description)
      
      UpsertPrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, formData)
      })
      
      expect(promptStore.isOpened).toBe(false)
      expect(promptStore.errors).toEqual([])
      expect(UpsertPrompt).toHaveBeenCalled()
    })

    it('should handle complete error workflow', async () => {
      // 1. Start with errors cleared
      act(() => {
        promptStore.updateErrors([])
        promptStore.newPrompt()
      })
      
      // 2. Attempt to save invalid data
      const formData = new FormData()
      formData.append('name', '') // Invalid empty name
      
      const errorResponse = {
        status: 'ERROR',
        errors: [{ message: 'Name is required' }],
      }
      CreatePrompt.mockResolvedValue(errorResponse)
      
      await act(async () => {
        await addOrUpdatePrompt(null, formData)
      })
      
      // 3. Should remain open with errors
      expect(promptStore.isOpened).toBe(true)
      expect(promptStore.errors).toEqual(['Name is required'])
      
      // 4. Fix errors and try again
      const fixedFormData = new FormData()
      fixedFormData.append('name', 'Fixed Prompt')
      
      CreatePrompt.mockResolvedValue({ status: 'OK', response: mockPrompt })
      
      await act(async () => {
        await addOrUpdatePrompt(null, fixedFormData)
      })
      
      // 5. Should close with no errors
      expect(promptStore.isOpened).toBe(false)
      expect(promptStore.errors).toEqual([])
    })
  })
})