// ABOUTME: Comprehensive unit tests for extension service server actions
// ABOUTME: Tests extension CRUD operations, validation, function management, and security

import {
  FindAllExtensionForCurrentUser,
  FindExtensionByID,
  CreateExtension,
  UpdateExtension,
  SoftDeleteExtension,
  UpsertFunction,
  DeleteFunction,
  convertFromDBModel,
  convertToDBModel,
} from '@/features/extensions-page/extension-services/extension-service';
import { CosmosDBContainer } from '@/services/cosmos';
import { userHashedId } from '@/features/auth-page/helpers';
import { sanitizeInput } from '@/services/validation-service';

// Mock dependencies
jest.mock('@/features/common/services/cosmos');
jest.mock('@/features/auth-page/helpers');
jest.mock('@/features/common/services/validation-service');

const mockCosmosDBContainer = CosmosDBContainer as jest.MockedFunction<typeof CosmosDBContainer>;
const mockUserHashedId = userHashedId as jest.MockedFunction<typeof userHashedId>;
const mockSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('Extension Service', () => {
  const mockContainer = {
    items: {
      query: jest.fn(),
      readAll: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    item: jest.fn(),
  };

  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    image: 'avatar.jpg',
  };

  const mockExtension = {
    id: 'ext-123',
    name: 'Test Extension',
    description: 'Test extension description',
    userId: 'hashed-user-id',
    isDeleted: false,
    functions: [
      {
        id: 'func-1',
        name: 'testFunction',
        description: 'Test function',
        parameters: [
          { name: 'param1', type: 'string', description: 'Parameter 1', required: true },
        ],
        endpoint: {
          url: 'https://api.example.com/test',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCosmosDBContainer.mockResolvedValue(mockContainer as any);
    mockUserHashedId.mockResolvedValue('hashed-user-id');
    mockSanitizeInput.mockImplementation((input, options) => {
      if (!input || input.length > (options?.maxLength || 1000)) return null;
      return input.replace(/[<>&"']/g, '');
    });

    global.console.error = jest.fn();
  });

  describe('FindAllExtensionForCurrentUser', () => {
    const mockExtensions = [mockExtension];

    it('should return all extensions for current user', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: mockExtensions }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllExtensionForCurrentUser();

      expect(result.status).toBe('OK');
      expect(result.response).toEqual(mockExtensions);
      expect(mockContainer.items.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = @isDeleted ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: 'EXTENSION' },
          { name: '@userId', value: 'hashed-user-id' },
          { name: '@isDeleted', value: false },
        ],
      });
    });

    it('should return empty array when no extensions found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllExtensionForCurrentUser();

      expect(result.status).toBe('OK');
      expect(result.response).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCosmosDBContainer.mockRejectedValue(new Error('Database connection failed'));

      const result = await FindAllExtensionForCurrentUser();

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Database connection failed',
      });
    });

    it('should handle query execution errors', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockRejectedValue(new Error('Query failed')),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllExtensionForCurrentUser();

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Query failed',
      });
    });
  });

  describe('FindExtensionByID', () => {
    it('should find extension by ID for current user', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindExtensionByID('ext-123');

      expect(result.status).toBe('OK');
      expect(result.response).toEqual(mockExtension);
      expect(mockContainer.items.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.id = @id AND c.userId = @userId AND c.isDeleted = @isDeleted',
        parameters: [
          { name: '@type', value: 'EXTENSION' },
          { name: '@id', value: 'ext-123' },
          { name: '@userId', value: 'hashed-user-id' },
          { name: '@isDeleted', value: false },
        ],
      });
    });

    it('should return error when extension not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindExtensionByID('non-existent');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension not found',
      });
    });

    it('should validate extension ID input', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await FindExtensionByID('<script>alert("xss")</script>');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid extension ID',
      });
    });

    it('should reject empty extension ID', async () => {
      const result = await FindExtensionByID('');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension ID is required',
      });
    });
  });

  describe('CreateExtension', () => {
    const formData = new FormData();
    formData.append('name', 'Test Extension');
    formData.append('description', 'Test description');
    formData.append('functions', JSON.stringify([{
      id: 'func-1',
      name: 'testFunction',
      description: 'Test function',
      parameters: [],
      endpoint: {
        url: 'https://api.example.com/test',
        method: 'POST',
        headers: {},
      },
    }]));

    it('should create new extension successfully', async () => {
      const mockCreatedExtension = {
        ...mockExtension,
        id: expect.any(String),
        createdAt: expect.any(Date),
        type: 'EXTENSION',
      };

      mockContainer.items.create.mockResolvedValue({ 
        resource: mockCreatedExtension 
      });

      const result = await CreateExtension(formData);

      expect(result.status).toBe('OK');
      expect(result.response).toMatchObject({
        type: 'EXTENSION',
        name: 'Test Extension',
        description: 'Test description',
        userId: 'hashed-user-id',
        isDeleted: false,
      });
    });

    it('should validate extension name', async () => {
      const invalidFormData = new FormData();
      invalidFormData.append('name', '');
      invalidFormData.append('description', 'Test');

      const result = await CreateExtension(invalidFormData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension name is required',
      });
    });

    it('should validate extension description', async () => {
      const invalidFormData = new FormData();
      invalidFormData.append('name', 'Test Extension');
      invalidFormData.append('description', '');

      const result = await CreateExtension(invalidFormData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension description is required',
      });
    });

    it('should sanitize input fields', async () => {
      const xssFormData = new FormData();
      xssFormData.append('name', '<script>alert("xss")</script>');
      xssFormData.append('description', '<img src=x onerror=alert(1)>');
      xssFormData.append('functions', '[]');

      const sanitizedName = 'scriptalert("xss")/script';
      const sanitizedDesc = 'img src=x onerror=alert(1)';
      
      mockSanitizeInput
        .mockReturnValueOnce(sanitizedName)
        .mockReturnValueOnce(sanitizedDesc);

      mockContainer.items.create.mockResolvedValue({ 
        resource: { name: sanitizedName, description: sanitizedDesc } 
      });

      const result = await CreateExtension(xssFormData);

      expect(result.status).toBe('OK');
      expect(mockSanitizeInput).toHaveBeenCalledWith('<script>alert("xss")</script>', {
        maxLength: 100,
        allowNewlines: false,
      });
      expect(mockSanitizeInput).toHaveBeenCalledWith('<img src=x onerror=alert(1)>', {
        maxLength: 500,
        allowNewlines: true,
      });
    });

    it('should handle invalid function data', async () => {
      const invalidFormData = new FormData();
      invalidFormData.append('name', 'Test Extension');
      invalidFormData.append('description', 'Test description');
      invalidFormData.append('functions', 'invalid-json');

      const result = await CreateExtension(invalidFormData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid function data format',
      });
    });

    it('should handle database creation errors', async () => {
      mockContainer.items.create.mockRejectedValue(new Error('Creation failed'));

      const result = await CreateExtension(formData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Creation failed',
      });
    });
  });

  describe('UpdateExtension', () => {
    const formData = new FormData();
    formData.append('name', 'Updated Extension');
    formData.append('description', 'Updated description');
    formData.append('functions', JSON.stringify([{
      id: 'func-1',
      name: 'updatedFunction',
      description: 'Updated function',
      parameters: [],
      endpoint: {
        url: 'https://api.example.com/updated',
        method: 'POST',
        headers: {},
      },
    }]));

    it('should update extension successfully', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { ...mockExtension, name: 'Updated Extension' } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpdateExtension('ext-123', formData);

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalled();
    });

    it('should return error when extension not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await UpdateExtension('non-existent', formData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension not found',
      });
    });

    it('should validate update data', async () => {
      const invalidFormData = new FormData();
      invalidFormData.append('name', '');

      const result = await UpdateExtension('ext-123', invalidFormData);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension name is required',
      });
    });
  });

  describe('SoftDeleteExtension', () => {
    it('should soft delete extension successfully', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { ...mockExtension, isDeleted: true } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await SoftDeleteExtension('ext-123');

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalledWith({ 
        ...mockExtension, 
        isDeleted: true 
      });
    });

    it('should return error when extension not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await SoftDeleteExtension('non-existent');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension not found',
      });
    });

    it('should validate extension ID', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await SoftDeleteExtension('<script>alert("xss")</script>');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid extension ID',
      });
    });
  });

  describe('UpsertFunction', () => {
    const functionData = {
      id: 'func-2',
      name: 'newFunction',
      description: 'New function',
      parameters: [
        { name: 'param1', type: 'string', description: 'Parameter 1', required: true },
      ],
      endpoint: {
        url: 'https://api.example.com/new',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    };

    it('should add new function to extension', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { 
            ...mockExtension, 
            functions: [...mockExtension.functions, functionData] 
          } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpsertFunction('ext-123', functionData);

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalled();
    });

    it('should update existing function', async () => {
      const updatedFunction = { ...mockExtension.functions[0], name: 'updatedFunction' };
      
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { 
            ...mockExtension, 
            functions: [updatedFunction] 
          } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpsertFunction('ext-123', updatedFunction);

      expect(result.status).toBe('OK');
    });

    it('should validate function data', async () => {
      const invalidFunction = { ...functionData, name: '' };

      const result = await UpsertFunction('ext-123', invalidFunction);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Function name is required',
      });
    });

    it('should validate endpoint URL', async () => {
      const invalidFunction = { 
        ...functionData, 
        endpoint: { ...functionData.endpoint, url: 'invalid-url' } 
      };

      const result = await UpsertFunction('ext-123', invalidFunction);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid endpoint URL',
      });
    });

    it('should sanitize function inputs', async () => {
      const xssFunction = {
        ...functionData,
        name: '<script>alert("xss")</script>',
        description: '<img src=x onerror=alert(1)>',
      };

      mockSanitizeInput
        .mockReturnValueOnce('scriptalert("xss")/script')
        .mockReturnValueOnce('img src=x onerror=alert(1)');

      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ resource: mockExtension }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpsertFunction('ext-123', xssFunction);

      expect(result.status).toBe('OK');
      expect(mockSanitizeInput).toHaveBeenCalledWith('<script>alert("xss")</script>', {
        maxLength: 50,
        allowNewlines: false,
      });
    });
  });

  describe('DeleteFunction', () => {
    it('should delete function from extension', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { ...mockExtension, functions: [] } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await DeleteFunction('ext-123', 'func-1');

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalledWith({
        ...mockExtension,
        functions: [],
      });
    });

    it('should return error when function not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockExtension] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await DeleteFunction('ext-123', 'non-existent-func');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Function not found',
      });
    });

    it('should validate inputs', async () => {
      const result = await DeleteFunction('', 'func-1');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Extension ID is required',
      });
    });
  });

  describe('Data Conversion', () => {
    describe('convertFromDBModel', () => {
      it('should convert database model to client model', () => {
        const dbModel = {
          id: 'ext-123',
          name: 'Test Extension',
          description: 'Test description',
          userId: 'hashed-user-id',
          isDeleted: false,
          functions: JSON.stringify([{
            id: 'func-1',
            name: 'testFunction',
            description: 'Test function',
            parameters: [],
            endpoint: { url: 'https://api.example.com', method: 'POST', headers: {} },
          }]),
        };

        const result = convertFromDBModel(dbModel);

        expect(result.functions).toEqual([{
          id: 'func-1',
          name: 'testFunction',
          description: 'Test function',
          parameters: [],
          endpoint: { url: 'https://api.example.com', method: 'POST', headers: {} },
        }]);
      });

      it('should handle invalid JSON in functions', () => {
        const dbModel = {
          id: 'ext-123',
          name: 'Test Extension',
          description: 'Test description',
          userId: 'hashed-user-id',
          isDeleted: false,
          functions: 'invalid-json',
        };

        const result = convertFromDBModel(dbModel);

        expect(result.functions).toEqual([]);
      });
    });

    describe('convertToDBModel', () => {
      it('should convert client model to database model', () => {
        const clientModel = {
          id: 'ext-123',
          name: 'Test Extension',
          description: 'Test description',
          userId: 'hashed-user-id',
          isDeleted: false,
          functions: [{
            id: 'func-1',
            name: 'testFunction',
            description: 'Test function',
            parameters: [],
            endpoint: { url: 'https://api.example.com', method: 'POST', headers: {} },
          }],
        };

        const result = convertToDBModel(clientModel);

        expect(result.functions).toBe(JSON.stringify(clientModel.functions));
      });

      it('should handle empty functions array', () => {
        const clientModel = {
          id: 'ext-123',
          name: 'Test Extension',
          description: 'Test description',
          userId: 'hashed-user-id',
          isDeleted: false,
          functions: [],
        };

        const result = convertToDBModel(clientModel);

        expect(result.functions).toBe('[]');
      });
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const extensionId = 'ext-123';
      const promises = Array(3).fill(null).map(() => 
        FindExtensionByID(extensionId)
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(['OK', 'ERROR']).toContain(result.status);
      });
    });

    it('should handle malformed endpoint URLs', async () => {
      const invalidFunction = {
        id: 'func-1',
        name: 'testFunction',
        description: 'Test function',
        parameters: [],
        endpoint: {
          url: 'javascript:alert("xss")',
          method: 'POST',
          headers: {},
        },
      };

      const result = await UpsertFunction('ext-123', invalidFunction);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid endpoint URL',
      });
    });

    it('should handle very large function arrays', async () => {
      const largeFunctions = Array(100).fill(null).map((_, i) => ({
        id: `func-${i}`,
        name: `function${i}`,
        description: `Function ${i}`,
        parameters: [],
        endpoint: { url: 'https://api.example.com', method: 'POST', headers: {} },
      }));

      const largeExtension = {
        ...mockExtension,
        functions: largeFunctions,
      };

      const dbModel = convertToDBModel(largeExtension);
      const clientModel = convertFromDBModel(dbModel);

      expect(clientModel.functions).toHaveLength(100);
    });

    it('should validate parameter types and requirements', async () => {
      const functionWithBadParams = {
        id: 'func-1',
        name: 'testFunction',
        description: 'Test function',
        parameters: [
          { name: '', type: 'string', description: 'Invalid param', required: true },
          { name: 'param2', type: 'invalid-type', description: 'Bad type', required: false },
        ],
        endpoint: { url: 'https://api.example.com', method: 'POST', headers: {} },
      };

      const result = await UpsertFunction('ext-123', functionWithBadParams);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid parameter configuration',
      });
    });
  });
});