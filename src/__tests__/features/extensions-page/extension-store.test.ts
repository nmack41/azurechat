import {
  extensionStore,
  useExtensionState,
  AddOrUpdateExtension,
  FormToExtensionModel,
  exampleFunction,
} from '@/features/extensions-page/extension-store'
import { ExtensionFunctionModel, ExtensionModel } from '@/features/extensions-page/extension-services/models'
import { uniqueId } from '@/features/common/util'
import { renderHook, act } from '@testing-library/react'

// Mock dependencies
jest.mock('@/features/common/navigation-helpers', () => ({
  RevalidateCache: jest.fn(),
}))
jest.mock('@/features/extensions-page/extension-services/extension-service', () => ({
  CreateExtension: jest.fn(),
  UpdateExtension: jest.fn(),
}))

describe('Extension Store', () => {
  const mockUniqueId = uniqueId as jest.Mock
  const { CreateExtension, UpdateExtension } = require('@/features/extensions-page/extension-services/extension-service')
  const { RevalidateCache } = require('@/features/common/navigation-helpers')

  beforeEach(() => {
    jest.clearAllMocks()
    mockUniqueId.mockReturnValue('unique-id-123')
    
    // Reset extension store state
    extensionStore.formState = {
      success: false,
      errors: [],
    }
    extensionStore.isLoading = false
    extensionStore.isOpened = false
    extensionStore.extension = { ...extensionStore.defaultModel }
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(extensionStore.formState.success).toBe(false)
      expect(extensionStore.formState.errors).toEqual([])
      expect(extensionStore.isLoading).toBe(false)
      expect(extensionStore.isOpened).toBe(false)
      expect(extensionStore.extension.name).toBe('')
      expect(extensionStore.extension.description).toBe('')
      expect(extensionStore.extension.functions).toEqual([])
      expect(extensionStore.extension.headers).toHaveLength(1)
      expect(extensionStore.extension.headers[0].key).toBe('Content-Type')
      expect(extensionStore.extension.headers[0].value).toBe('application/json')
    })

    it('should have default model with correct structure', () => {
      const defaultModel = extensionStore.defaultModel
      
      expect(defaultModel.id).toBe('')
      expect(defaultModel.name).toBe('')
      expect(defaultModel.type).toBe('EXTENSION')
      expect(defaultModel.isPublished).toBe(false)
      expect(defaultModel.functions).toEqual([])
      expect(defaultModel.headers).toHaveLength(1)
    })
  })

  describe('useExtensionState Hook', () => {
    it('should return snapshot of extension state', () => {
      const { result } = renderHook(() => useExtensionState())
      
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isOpened).toBe(false)
      expect(result.current.extension.name).toBe('')
    })

    it('should reflect state changes', () => {
      const { result } = renderHook(() => useExtensionState())
      
      act(() => {
        extensionStore.updateOpened(true)
      })
      
      expect(result.current.isOpened).toBe(true)
    })
  })

  describe('Form Submission', () => {
    const mockExtension: ExtensionModel = {
      id: '',
      name: 'Test Extension',
      description: 'Test Description',
      executionSteps: 'Test Steps',
      createdAt: new Date(),
      isPublished: false,
      type: 'EXTENSION',
      functions: [],
      headers: [],
      userId: 'user-123',
    }

    it('should create new extension successfully', async () => {
      CreateExtension.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await extensionStore.submitForm(mockExtension)
      })
      
      expect(CreateExtension).toHaveBeenCalledWith(mockExtension)
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'extensions',
      })
      expect(extensionStore.formState.success).toBe(true)
      expect(extensionStore.isLoading).toBe(false)
      expect(extensionStore.isOpened).toBe(false)
    })

    it('should update existing extension successfully', async () => {
      const existingExtension = { ...mockExtension, id: 'ext-123' }
      UpdateExtension.mockResolvedValue({ status: 'OK' })
      
      await act(async () => {
        await extensionStore.submitForm(existingExtension)
      })
      
      expect(UpdateExtension).toHaveBeenCalledWith(existingExtension)
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'extensions',
      })
      expect(extensionStore.formState.success).toBe(true)
      expect(extensionStore.isLoading).toBe(false)
      expect(extensionStore.isOpened).toBe(false)
    })

    it('should handle form submission errors', async () => {
      const errorResponse = {
        status: 'ERROR',
        errors: [{ message: 'Validation failed' }],
      }
      CreateExtension.mockResolvedValue(errorResponse)
      
      await act(async () => {
        await extensionStore.submitForm(mockExtension)
      })
      
      expect(extensionStore.formState.success).toBe(false)
      expect(extensionStore.formState.errors).toEqual([{ message: 'Validation failed' }])
      expect(extensionStore.isLoading).toBe(false)
      expect(extensionStore.isOpened).toBe(true)
    })

    it('should set loading state during submission', async () => {
      CreateExtension.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ status: 'OK' }), 100)))
      
      const submitPromise = act(async () => {
        await extensionStore.submitForm(mockExtension)
      })
      
      // Check loading state is set
      expect(extensionStore.isLoading).toBe(true)
      
      await submitPromise
      
      expect(extensionStore.isLoading).toBe(false)
    })
  })

  describe('Modal State Management', () => {
    it('should update opened state', () => {
      act(() => {
        extensionStore.updateOpened(true)
      })
      
      expect(extensionStore.isOpened).toBe(true)
    })

    it('should revalidate cache when closing modal', () => {
      act(() => {
        extensionStore.updateOpened(false)
      })
      
      expect(RevalidateCache).toHaveBeenCalledWith({
        page: 'extensions',
      })
    })

    it('should open slider and reset form state', () => {
      // Set some initial state
      extensionStore.formState = {
        success: true,
        errors: [{ message: 'Old error' }],
      }
      
      act(() => {
        extensionStore.resetAndOpenSlider()
      })
      
      expect(extensionStore.isOpened).toBe(true)
      expect(extensionStore.formState.success).toBe(false)
      expect(extensionStore.formState.errors).toEqual([])
    })
  })

  describe('Function Management', () => {
    beforeEach(() => {
      act(() => {
        extensionStore.newAndOpenSlider()
      })
    })

    it('should add new function', () => {
      const initialFunctionCount = extensionStore.extension.functions.length
      
      act(() => {
        extensionStore.addFunction()
      })
      
      expect(extensionStore.extension.functions).toHaveLength(initialFunctionCount + 1)
      const newFunction = extensionStore.extension.functions[0]
      expect(newFunction.id).toBe('unique-id-123')
      expect(newFunction.code).toBe(exampleFunction)
      expect(newFunction.endpointType).toBe('GET')
      expect(newFunction.isOpen).toBe(false)
    })

    it('should clone existing function', () => {
      const mockFunction: ExtensionFunctionModel = {
        id: 'original-id',
        code: 'original code',
        endpoint: '/test',
        endpointType: 'POST',
        isOpen: true,
      }
      
      act(() => {
        extensionStore.cloneFunction(mockFunction)
      })
      
      expect(extensionStore.extension.functions).toHaveLength(1)
      const clonedFunction = extensionStore.extension.functions[0]
      expect(clonedFunction.id).toBe('unique-id-123') // New ID
      expect(clonedFunction.code).toBe('original code')
      expect(clonedFunction.endpoint).toBe('/test')
      expect(clonedFunction.endpointType).toBe('POST')
      expect(clonedFunction.isOpen).toBe(true)
    })

    it('should update function code', () => {
      act(() => {
        extensionStore.addFunction()
        extensionStore.updateFunctionCode('unique-id-123', 'new code')
      })
      
      const updatedFunction = extensionStore.extension.functions[0]
      expect(updatedFunction.code).toBe('new code')
    })

    it('should not update code for non-existent function', () => {
      act(() => {
        extensionStore.addFunction()
        extensionStore.updateFunctionCode('non-existent-id', 'new code')
      })
      
      const originalFunction = extensionStore.extension.functions[0]
      expect(originalFunction.code).toBe(exampleFunction) // Unchanged
    })

    it('should remove function by id', () => {
      act(() => {
        extensionStore.addFunction()
        extensionStore.removeFunction('unique-id-123')
      })
      
      expect(extensionStore.extension.functions).toHaveLength(0)
    })

    it('should toggle function open state', () => {
      act(() => {
        extensionStore.addFunction()
        extensionStore.toggleFunction('unique-id-123')
      })
      
      const toggledFunction = extensionStore.extension.functions[0]
      expect(toggledFunction.isOpen).toBe(true)
      
      act(() => {
        extensionStore.toggleFunction('unique-id-123')
      })
      
      expect(toggledFunction.isOpen).toBe(false)
    })

    it('should not toggle non-existent function', () => {
      act(() => {
        extensionStore.addFunction()
        extensionStore.toggleFunction('non-existent-id')
      })
      
      const originalFunction = extensionStore.extension.functions[0]
      expect(originalFunction.isOpen).toBe(false) // Unchanged
    })
  })

  describe('Header Management', () => {
    it('should add endpoint header', () => {
      const initialHeaderCount = extensionStore.extension.headers.length
      
      act(() => {
        extensionStore.addEndpointHeader({
          key: 'Authorization',
          value: 'Bearer token',
        })
      })
      
      expect(extensionStore.extension.headers).toHaveLength(initialHeaderCount + 1)
      const newHeader = extensionStore.extension.headers[initialHeaderCount]
      expect(newHeader.id).toBe('unique-id-123')
      expect(newHeader.key).toBe('Authorization')
      expect(newHeader.value).toBe('Bearer token')
    })

    it('should remove header by id', () => {
      // First add a header to have a predictable ID
      act(() => {
        extensionStore.addEndpointHeader({
          key: 'Authorization',
          value: 'Bearer token',
        })
      })
      
      const headerId = extensionStore.extension.headers[1].id // Get the newly added header
      
      act(() => {
        extensionStore.removeHeader({ headerId })
      })
      
      expect(extensionStore.extension.headers).toHaveLength(1) // Should still have the default Content-Type header
      expect(extensionStore.extension.headers[0].key).toBe('Content-Type')
    })
  })

  describe('Extension Operations', () => {
    const mockExtension: ExtensionModel = {
      id: 'ext-123',
      name: 'Existing Extension',
      description: 'Existing Description',
      executionSteps: 'Existing Steps',
      createdAt: new Date(),
      isPublished: true,
      type: 'EXTENSION',
      functions: [
        {
          id: 'func-1',
          code: 'function code',
          endpoint: '/api/test',
          endpointType: 'POST',
          isOpen: true,
        },
      ],
      headers: [],
      userId: 'user-123',
    }

    it('should open and update with existing extension', () => {
      act(() => {
        extensionStore.openAndUpdate(mockExtension)
      })
      
      expect(extensionStore.extension).toEqual({
        ...mockExtension,
        functions: [
          {
            ...mockExtension.functions[0],
            isOpen: false, // Should be reset to false
          },
        ],
      })
      expect(extensionStore.isOpened).toBe(true)
      expect(extensionStore.formState.success).toBe(false)
      expect(extensionStore.formState.errors).toEqual([])
    })

    it('should create new extension and open slider', () => {
      // Set some existing state first
      extensionStore.extension = mockExtension
      
      act(() => {
        extensionStore.newAndOpenSlider()
      })
      
      expect(extensionStore.extension.id).toBe('')
      expect(extensionStore.extension.name).toBe('')
      expect(extensionStore.extension.functions).toEqual([])
      expect(extensionStore.isOpened).toBe(true)
    })
  })

  describe('Form Data Conversion', () => {
    it('should convert FormData to ExtensionModel correctly', () => {
      const formData = new FormData()
      formData.append('id', 'ext-123')
      formData.append('name', 'Test Extension')
      formData.append('description', 'Test Description')
      formData.append('executionSteps', 'Test Steps')
      formData.append('isPublished', 'on')
      
      // Headers
      formData.append('header-key[]', 'Content-Type')
      formData.append('header-value[]', 'application/json')
      formData.append('header-id[]', 'header-1')
      
      // Functions
      formData.append('endpoint-type[]', 'POST')
      formData.append('endpoint[]', '/api/test')
      formData.append('code[]', '{"name": "test"}')
      
      const result = FormToExtensionModel(formData)
      
      expect(result.id).toBe('ext-123')
      expect(result.name).toBe('Test Extension')
      expect(result.description).toBe('Test Description')
      expect(result.executionSteps).toBe('Test Steps')
      expect(result.isPublished).toBe(true)
      expect(result.type).toBe('EXTENSION')
      expect(result.userId).toBe('')
      
      expect(result.headers).toHaveLength(1)
      expect(result.headers[0].key).toBe('Content-Type')
      expect(result.headers[0].value).toBe('application/json')
      expect(result.headers[0].id).toBe('header-1')
      
      expect(result.functions).toHaveLength(1)
      expect(result.functions[0].endpointType).toBe('POST')
      expect(result.functions[0].endpoint).toBe('/api/test')
      expect(result.functions[0].code).toBe('{"name": "test"}')
      expect(result.functions[0].isOpen).toBe(false)
    })

    it('should handle isPublished checkbox correctly', () => {
      const formData = new FormData()
      formData.append('id', 'ext-123')
      formData.append('name', 'Test Extension')
      // isPublished not set (checkbox unchecked)
      
      const result = FormToExtensionModel(formData)
      
      expect(result.isPublished).toBe(false)
    })
  })

  describe('AddOrUpdateExtension Integration', () => {
    it('should call submitForm with converted model', async () => {
      const formData = new FormData()
      formData.append('name', 'Integration Test')
      formData.append('description', 'Test Description')
      formData.append('executionSteps', 'Test Steps')
      formData.append('id', '')
      
      CreateExtension.mockResolvedValue({ status: 'OK' })
      
      // Spy on submitForm to verify it was called
      const submitFormSpy = jest.spyOn(extensionStore, 'submitForm')
      
      await act(async () => {
        await AddOrUpdateExtension(null, formData)
      })
      
      expect(submitFormSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Integration Test',
          description: 'Test Description',
          executionSteps: 'Test Steps',
        })
      )
      
      submitFormSpy.mockRestore()
    })
  })

  describe('Example Function', () => {
    it('should provide valid example function JSON', () => {
      expect(() => JSON.parse(exampleFunction)).not.toThrow()
      
      const parsed = JSON.parse(exampleFunction)
      expect(parsed.name).toBe('UpdateGitHubIssue')
      expect(parsed.parameters).toBeDefined()
      expect(parsed.description).toBeDefined()
    })
  })
})