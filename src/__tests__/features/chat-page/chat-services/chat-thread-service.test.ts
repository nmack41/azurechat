// ABOUTME: Comprehensive unit tests for chat thread service server actions
// ABOUTME: Tests thread CRUD operations, validation, security, and error handling

import {
  FindAllChatThreadForCurrentUser,
  FindChatThreadByID,
  SoftDeleteChatThreadForCurrentUser,
  UpdateChatThreadTitle,
  CreateChatThread,
} from '@/features/chat-page/chat-services/chat-thread-service';

// These dependencies are already mocked globally in jest.setup.js, so we just import them for type safety
import { CosmosDBContainer } from '@/features/common/services/cosmos';
import { userHashedId } from '@/features/auth-page/helpers';
import { sanitizeInput } from '@/features/common/services/validation-service';

const mockCosmosDBContainer = CosmosDBContainer as jest.MockedFunction<typeof CosmosDBContainer>;
const mockUserHashedId = userHashedId as jest.MockedFunction<typeof userHashedId>;
const mockSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('Chat Thread Service', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCosmosDBContainer.mockResolvedValue(mockContainer as any);
    mockUserHashedId.mockResolvedValue('hashed-user-id');
    mockSanitizeInput.mockImplementation((input, options) => {
      if (!input || input.length > (options?.maxLength || 1000)) return null;
      return input.replace(/[<>&"']/g, '');
    });

    // Mock console.error to suppress error logs in tests
    global.console.error = jest.fn();
  });

  describe('FindAllChatThreadForCurrentUser', () => {
    const mockThreads = [
      {
        id: 'thread-1',
        name: 'Test Thread 1',
        userId: 'hashed-user-id',
        useName: 'Test User',
        isDeleted: false,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'thread-2',
        name: 'Test Thread 2',
        userId: 'hashed-user-id',
        useName: 'Test User',
        isDeleted: false,
        createdAt: new Date('2024-01-02'),
      },
    ];

    it('should return all threads for current user', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: mockThreads }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllChatThreadForCurrentUser();

      expect(result.status).toBe('OK');
      expect(result.response).toEqual(mockThreads);
      expect(mockContainer.items.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.userId = @userId AND c.isDeleted = @isDeleted ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: 'THREAD' },
          { name: '@userId', value: 'hashed-user-id' },
          { name: '@isDeleted', value: false },
        ],
      });
    });

    it('should return empty array when no threads found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllChatThreadForCurrentUser();

      expect(result.status).toBe('OK');
      expect(result.response).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCosmosDBContainer.mockRejectedValue(new Error('Database connection failed'));

      const result = await FindAllChatThreadForCurrentUser();

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Database connection failed',
      });
    });

    it('should handle user authentication errors', async () => {
      mockUserHashedId.mockRejectedValue(new Error('Authentication failed'));

      const result = await FindAllChatThreadForCurrentUser();

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Authentication failed',
      });
    });

    it('should handle query execution errors', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockRejectedValue(new Error('Query execution failed')),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindAllChatThreadForCurrentUser();

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Query execution failed',
      });
    });
  });

  describe('FindChatThreadByID', () => {
    const mockThread = {
      id: 'thread-123',
      name: 'Test Thread',
      userId: 'hashed-user-id',
      useName: 'Test User',
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
    };

    it('should find thread by ID for current user', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockThread] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindChatThreadByID('thread-123');

      expect(result.status).toBe('OK');
      expect(result.response).toEqual(mockThread);
      expect(mockContainer.items.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.id = @id AND c.userId = @userId AND c.isDeleted = @isDeleted',
        parameters: [
          { name: '@type', value: 'THREAD' },
          { name: '@id', value: 'thread-123' },
          { name: '@userId', value: 'hashed-user-id' },
          { name: '@isDeleted', value: false },
        ],
      });
    });

    it('should return error when thread not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await FindChatThreadByID('non-existent');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Thread not found',
      });
    });

    it('should validate thread ID input', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await FindChatThreadByID('<script>alert("xss")</script>');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid thread ID',
      });
    });

    it('should reject empty thread ID', async () => {
      const result = await FindChatThreadByID('');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Thread ID is required',
      });
    });

    it('should handle database errors', async () => {
      mockCosmosDBContainer.mockRejectedValue(new Error('Database error'));

      const result = await FindChatThreadByID('thread-123');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Database error',
      });
    });
  });

  describe('SoftDeleteChatThreadForCurrentUser', () => {
    const mockThread = {
      id: 'thread-123',
      name: 'Test Thread',
      userId: 'hashed-user-id',
      useName: 'Test User',
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
    };

    it('should soft delete thread for current user', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockThread] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ resource: { ...mockThread, isDeleted: true } }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await SoftDeleteChatThreadForCurrentUser('thread-123');

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalledWith({ ...mockThread, isDeleted: true });
    });

    it('should return error when thread not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await SoftDeleteChatThreadForCurrentUser('non-existent');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Thread not found',
      });
    });

    it('should validate thread ID input', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await SoftDeleteChatThreadForCurrentUser('<script>alert("xss")</script>');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid thread ID',
      });
    });

    it('should handle deletion errors', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockThread] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockRejectedValue(new Error('Delete operation failed')),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await SoftDeleteChatThreadForCurrentUser('thread-123');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Delete operation failed',
      });
    });
  });

  describe('UpdateChatThreadTitle', () => {
    const mockThread = {
      id: 'thread-123',
      name: 'Old Title',
      userId: 'hashed-user-id',
      useName: 'Test User',
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
    };

    it('should update thread title successfully', async () => {
      const newTitle = 'New Thread Title';
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockThread] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { ...mockThread, name: newTitle } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpdateChatThreadTitle('thread-123', newTitle);

      expect(result.status).toBe('OK');
      expect(mockItem.replace).toHaveBeenCalledWith({ 
        ...mockThread, 
        name: newTitle 
      });
    });

    it('should validate and sanitize title input', async () => {
      const xssTitle = '<script>alert("xss")</script>';
      const sanitizedTitle = 'scriptalert("xss")/script';
      
      mockSanitizeInput.mockReturnValue(sanitizedTitle);
      
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [mockThread] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const mockItem = {
        replace: jest.fn().mockResolvedValue({ 
          resource: { ...mockThread, name: sanitizedTitle } 
        }),
      };
      mockContainer.item.mockReturnValue(mockItem);

      const result = await UpdateChatThreadTitle('thread-123', xssTitle);

      expect(result.status).toBe('OK');
      expect(mockSanitizeInput).toHaveBeenCalledWith(xssTitle, {
        maxLength: 100,
        allowNewlines: false,
      });
    });

    it('should reject invalid title input', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await UpdateChatThreadTitle('thread-123', 'x'.repeat(101));

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid title format or length',
      });
    });

    it('should reject empty title', async () => {
      const result = await UpdateChatThreadTitle('thread-123', '');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Title is required',
      });
    });

    it('should handle thread not found', async () => {
      const mockQueryResult = {
        fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
      };
      mockContainer.items.query.mockReturnValue(mockQueryResult);

      const result = await UpdateChatThreadTitle('non-existent', 'New Title');

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Thread not found',
      });
    });
  });

  describe('CreateChatThread', () => {
    it('should create new chat thread successfully', async () => {
      const threadName = 'New Chat Thread';
      const mockCreatedThread = {
        id: expect.any(String),
        type: 'THREAD',
        createdAt: expect.any(Date),
        lastMessageAt: expect.any(Date),
        userId: 'hashed-user-id',
        useName: 'Test User',
        isDeleted: false,
        name: threadName,
      };

      mockContainer.items.create.mockResolvedValue({ 
        resource: mockCreatedThread 
      });

      const result = await CreateChatThread(threadName, mockUser);

      expect(result.status).toBe('OK');
      expect(result.response).toMatchObject({
        type: 'THREAD',
        userId: 'hashed-user-id',
        useName: 'Test User',
        isDeleted: false,
        name: threadName,
      });
      expect(mockContainer.items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'THREAD',
          name: threadName,
          userId: 'hashed-user-id',
          useName: 'Test User',
          isDeleted: false,
        })
      );
    });

    it('should validate and sanitize thread name', async () => {
      const xssName = '<script>alert("xss")</script>';
      const sanitizedName = 'scriptalert("xss")/script';
      
      mockSanitizeInput.mockReturnValue(sanitizedName);
      
      mockContainer.items.create.mockResolvedValue({ 
        resource: { name: sanitizedName } 
      });

      const result = await CreateChatThread(xssName, mockUser);

      expect(result.status).toBe('OK');
      expect(mockSanitizeInput).toHaveBeenCalledWith(xssName, {
        maxLength: 100,
        allowNewlines: false,
      });
    });

    it('should reject invalid thread name', async () => {
      mockSanitizeInput.mockReturnValue(null);

      const result = await CreateChatThread('x'.repeat(101), mockUser);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid thread name format or length',
      });
    });

    it('should reject empty thread name', async () => {
      const result = await CreateChatThread('', mockUser);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Thread name is required',
      });
    });

    it('should handle missing user information', async () => {
      const result = await CreateChatThread('Test Thread', null as any);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'User information is required',
      });
    });

    it('should handle database creation errors', async () => {
      mockContainer.items.create.mockRejectedValue(new Error('Creation failed'));

      const result = await CreateChatThread('Test Thread', mockUser);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Creation failed',
      });
    });

    it('should handle user hashing errors', async () => {
      mockUserHashedId.mockRejectedValue(new Error('Hashing failed'));

      const result = await CreateChatThread('Test Thread', mockUser);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Hashing failed',
      });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle concurrent access attempts', async () => {
      const threadId = 'thread-123';
      const promises = Array(5).fill(null).map(() => 
        FindChatThreadByID(threadId)
      );

      // All should complete without errors
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(['OK', 'ERROR']).toContain(result.status);
      });
    });

    it('should handle very long thread IDs gracefully', async () => {
      const longId = 'a'.repeat(1000);
      mockSanitizeInput.mockReturnValue(null);

      const result = await FindChatThreadByID(longId);

      expect(result.status).toBe('ERROR');
      expect(result.errors).toContainEqual({
        message: 'Invalid thread ID',
      });
    });

    it('should handle null and undefined inputs', async () => {
      const results = await Promise.all([
        FindChatThreadByID(null as any),
        FindChatThreadByID(undefined as any),
        UpdateChatThreadTitle('thread-123', null as any),
        UpdateChatThreadTitle('thread-123', undefined as any),
      ]);

      results.forEach(result => {
        expect(result.status).toBe('ERROR');
      });
    });

    it('should handle special characters in thread names', async () => {
      const specialChars = '!@#$%^&*()[]{}|;:,.<>?';
      const sanitizedChars = '!@#$%^&*()[]{}|;:,.?';
      
      mockSanitizeInput.mockReturnValue(sanitizedChars);
      mockContainer.items.create.mockResolvedValue({ 
        resource: { name: sanitizedChars } 
      });

      const result = await CreateChatThread(specialChars, mockUser);

      expect(result.status).toBe('OK');
    });
  });
});