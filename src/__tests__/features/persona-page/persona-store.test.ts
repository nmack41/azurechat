import {
  personaStore,
  usePersonaState,
  addOrUpdatePersona,
  FormDataToPersonaModel,
} from '@/features/persona-page/persona-store'
import { PersonaModel } from '@/features/persona-page/persona-services/models'
import { renderHook, act } from '@testing-library/react'

// Mock dependencies
jest.mock('@/features/common/navigation-helpers', () => ({
  RevalidateCache: jest.fn(),
}))
jest.mock('@/features/persona-page/persona-services/persona-service', () => ({
  CreatePersona: jest.fn(),
  UpsertPersona: jest.fn(),
}))

describe('Persona Store', () => {
  const { CreatePersona, UpsertPersona } = require('@/features/persona-page/persona-services/persona-service')
  const { RevalidateCache } = require('@/features/common/navigation-helpers')

  const mockPersona: PersonaModel = {
    id: 'persona-123',
    name: 'Test Persona',
    description: 'Test Description',
    personaMessage: 'You are a helpful assistant',
    createdAt: new Date(),
    isPublished: true,
    type: 'PERSONA',
    userId: 'user-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset persona store state
    personaStore.isOpened = false
    personaStore.errors = []
    personaStore.persona = {
      id: '',
      name: '',
      description: '',
      personaMessage: '',
      createdAt: new Date(),
      isPublished: false,
      type: 'PERSONA',
      userId: '',
    }
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(personaStore.isOpened).toBe(false)
      expect(personaStore.errors).toEqual([])
      expect(personaStore.persona.id).toBe('')
      expect(personaStore.persona.name).toBe('')
      expect(personaStore.persona.description).toBe('')
      expect(personaStore.persona.personaMessage).toBe('')
      expect(personaStore.persona.type).toBe('PERSONA')
      expect(personaStore.persona.isPublished).toBe(false)
    })
  })

  describe('usePersonaState Hook', () => {
    it('should return snapshot of persona state', () => {
      const { result } = renderHook(() => usePersonaState())
      
      expect(result.current.isOpened).toBe(false)
      expect(result.current.errors).toEqual([])
      expect(result.current.persona.name).toBe('')
    })

    it('should reflect state changes', () => {
      const { result } = renderHook(() => usePersonaState())
      
      act(() => {
        personaStore.updateOpened(true)
      })
      
      expect(result.current.isOpened).toBe(true)
    })
  })

  describe('State Management', () => {
    it('should update opened state', () => {
      act(() => {
        personaStore.updateOpened(true)
      })
      
      expect(personaStore.isOpened).toBe(true)
      
      act(() => {
        personaStore.updateOpened(false)
      })
      
      expect(personaStore.isOpened).toBe(false)
    })

    it('should update errors', () => {
      const errors = ['Error 1', 'Error 2']
      
      act(() => {
        personaStore.updateErrors(errors)
      })
      
      expect(personaStore.errors).toEqual(errors)
    })

    it('should update persona and open modal', () => {
      act(() => {
        personaStore.updatePersona(mockPersona)
      })
      
      expect(personaStore.persona).toEqual(mockPersona)
      expect(personaStore.isOpened).toBe(true)
    })
  })

  describe('Persona Creation', () => {
    it('should create new persona with defaults', () => {
      // Set some existing state first
      personaStore.persona = mockPersona
      personaStore.isOpened = false
      
      act(() => {
        personaStore.newPersona()
      })
      
      expect(personaStore.persona.id).toBe('')
      expect(personaStore.persona.name).toBe('')
      expect(personaStore.persona.description).toBe('')
      expect(personaStore.persona.personaMessage).toBe('')
      expect(personaStore.persona.type).toBe('PERSONA')
      expect(personaStore.persona.isPublished).toBe(false)
      expect(personaStore.isOpened).toBe(true)
    })

    it('should create new persona with provided values', () => {
      const personaData = {
        name: 'Custom Persona',
        description: 'Custom Description',
        personaMessage: 'Custom message',
      }
      
      act(() => {
        personaStore.newPersonaAndOpen(personaData)
      })
      
      expect(personaStore.persona.name).toBe('Custom Persona')
      expect(personaStore.persona.description).toBe('Custom Description')
      expect(personaStore.persona.personaMessage).toBe('Custom message')
      expect(personaStore.persona.id).toBe('') // Should be empty for new persona
      expect(personaStore.persona.type).toBe('PERSONA')
      expect(personaStore.isOpened).toBe(true)
    })
  })

  describe('Form Data Conversion', () => {
    it('should convert FormData to PersonaModel correctly', () => {
      const formData = new FormData()
      formData.append('id', 'persona-123')
      formData.append('name', 'Test Persona')
      formData.append('description', 'Test Description')
      formData.append('personaMessage', 'You are a helpful assistant')
      formData.append('isPublished', 'on')
      
      const result = FormDataToPersonaModel(formData)
      
      expect(result.id).toBe('persona-123')
      expect(result.name).toBe('Test Persona')
      expect(result.description).toBe('Test Description')
      expect(result.personaMessage).toBe('You are a helpful assistant')
      expect(result.isPublished).toBe(true)
      expect(result.type).toBe('PERSONA')
      expect(result.userId).toBe('') // Set on server
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should handle unchecked isPublished checkbox', () => {
      const formData = new FormData()
      formData.append('id', 'persona-123')
      formData.append('name', 'Test Persona')
      formData.append('description', 'Test Description')
      formData.append('personaMessage', 'Test message')
      // isPublished not set (checkbox unchecked)
      
      const result = FormDataToPersonaModel(formData)
      
      expect(result.isPublished).toBe(false)
    })

    it('should handle empty form data', () => {
      const formData = new FormData()
      // No data appended
      
      const result = FormDataToPersonaModel(formData)
      
      expect(result.id).toBe('')
      expect(result.name).toBe('')
      expect(result.description).toBe('')
      expect(result.personaMessage).toBe('')
      expect(result.isPublished).toBe(false)
      expect(result.type).toBe('PERSONA')
    })
  })

  describe('addOrUpdatePersona Function', () => {
    it('should create new persona successfully', async () => {
      const formData = new FormData()
      formData.append('name', 'New Persona')
      formData.append('description', 'New Description')
      formData.append('personaMessage', 'New message')
      
      const successResponse = { status: 'OK' }
      CreatePersona.mockResolvedValue(successResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePersona(null, formData)
      })
      
      expect(CreatePersona).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Persona',
          description: 'New Description',
          personaMessage: 'New message',
        })
      )
      expect(personaStore.isOpened).toBe(false)
      expect(personaStore.errors).toEqual([])
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'persona',
      })
      expect(result).toEqual(successResponse)
    })

    it('should update existing persona successfully', async () => {
      const formData = new FormData()
      formData.append('id', 'persona-123')
      formData.append('name', 'Updated Persona')
      formData.append('description', 'Updated Description')
      formData.append('personaMessage', 'Updated message')
      
      const successResponse = { status: 'OK' }
      UpsertPersona.mockResolvedValue(successResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePersona(null, formData)
      })
      
      expect(UpsertPersona).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'persona-123',
          name: 'Updated Persona',
          description: 'Updated Description',
          personaMessage: 'Updated message',
        })
      )
      expect(personaStore.isOpened).toBe(false)
      expect(personaStore.errors).toEqual([])
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'persona',
      })
      expect(result).toEqual(successResponse)
    })

    it('should handle creation errors', async () => {
      const formData = new FormData()
      formData.append('name', 'Invalid Persona')
      
      const errorResponse = {
        status: 'ERROR',
        errors: [
          { message: 'Name is required' },
          { message: 'Description is required' },
        ],
      }
      CreatePersona.mockResolvedValue(errorResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePersona(null, formData)
      })
      
      expect(personaStore.isOpened).toBe(true) // Should remain open on error
      expect(personaStore.errors).toEqual(['Name is required', 'Description is required'])
      expect(RevalidateCache).not.toHaveBeenCalled()
      expect(result).toEqual(errorResponse)
    })

    it('should handle update errors', async () => {
      const formData = new FormData()
      formData.append('id', 'persona-123')
      formData.append('name', 'Invalid Update')
      
      const errorResponse = {
        status: 'ERROR',
        errors: [{ message: 'Persona not found' }],
      }
      UpsertPersona.mockResolvedValue(errorResponse)
      
      const result = await act(async () => {
        return await addOrUpdatePersona(null, formData)
      })
      
      expect(personaStore.isOpened).toBe(true)
      expect(personaStore.errors).toEqual(['Persona not found'])
      expect(RevalidateCache).not.toHaveBeenCalled()
      expect(result).toEqual(errorResponse)
    })

    it('should clear errors before processing', async () => {
      // Set initial errors
      personaStore.updateErrors(['Old error'])
      
      const formData = new FormData()
      formData.append('name', 'Test Persona')
      
      CreatePersona.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await addOrUpdatePersona(null, formData)
      })
      
      // Errors should be cleared even on success
      expect(personaStore.errors).toEqual([])
    })

    it('should determine create vs update based on id presence', async () => {
      // Test create (no id)
      const createFormData = new FormData()
      createFormData.append('name', 'New Persona')
      
      CreatePersona.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await addOrUpdatePersona(null, createFormData)
      })
      
      expect(CreatePersona).toHaveBeenCalled()
      expect(UpsertPersona).not.toHaveBeenCalled()
      
      jest.clearAllMocks()
      
      // Test update (with id)
      const updateFormData = new FormData()
      updateFormData.append('id', 'persona-123')
      updateFormData.append('name', 'Updated Persona')
      
      UpsertPersona.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await addOrUpdatePersona(null, updateFormData)
      })
      
      expect(UpsertPersona).toHaveBeenCalled()
      expect(CreatePersona).not.toHaveBeenCalled()
    })

    it('should handle empty id as create operation', async () => {
      const formData = new FormData()
      formData.append('id', '') // Empty string
      formData.append('name', 'New Persona')
      
      CreatePersona.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await addOrUpdatePersona(null, formData)
      })
      
      expect(CreatePersona).toHaveBeenCalled()
      expect(UpsertPersona).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should maintain state consistency on errors', async () => {
      const formData = new FormData()
      formData.append('name', 'Test Persona')
      
      // Simulate service throwing an exception
      CreatePersona.mockRejectedValue(new Error('Network error'))
      
      await act(async () => {
        try {
          await addOrUpdatePersona(null, formData)
        } catch (error) {
          // Error should be thrown
          expect(error.message).toBe('Network error')
        }
      })
      
      // Store state should remain consistent
      expect(typeof personaStore.isOpened).toBe('boolean')
      expect(Array.isArray(personaStore.errors)).toBe(true)
    })
  })

  describe('State Immutability', () => {
    it('should create new persona object when updating', () => {
      const originalPersona = personaStore.persona
      
      act(() => {
        personaStore.updatePersona(mockPersona)
      })
      
      // Should be a new object reference
      expect(personaStore.persona).not.toBe(originalPersona)
      expect(personaStore.persona).toEqual(mockPersona)
    })

    it('should create new persona object when creating new', () => {
      personaStore.persona = mockPersona
      const currentPersona = personaStore.persona
      
      act(() => {
        personaStore.newPersona()
      })
      
      // Should be a new object reference
      expect(personaStore.persona).not.toBe(currentPersona)
      expect(personaStore.persona.id).toBe('')
    })
  })
})