// ABOUTME: Comprehensive unit tests for the images API route handler with proper URL validation
// ABOUTME: Tests actual ImageAPIEntry implementation with threadId/imgName parameters and security measures

import { GET } from '@/app/(authenticated)/api/images/route';
import { GetImageFromStore, GetThreadAndImageFromUrl } from '@/features/chat-page/chat-services/chat-image-service';

// Mock the image service functions
jest.mock('@/features/chat-page/chat-services/chat-image-service', () => ({
  GetImageFromStore: jest.fn(),
  GetThreadAndImageFromUrl: jest.fn(),
}));

// Mock the validation service
jest.mock('@/features/common/services/validation-service', () => ({
  sanitizeInput: jest.fn((input, options) => {
    if (!input || input.length > (options?.maxLength || 1000)) return null;
    return input.replace(/[<>&"']/g, ''); // Basic sanitization
  }),
}));

const mockGetImageFromStore = GetImageFromStore as jest.MockedFunction<typeof GetImageFromStore>;
const mockGetThreadAndImageFromUrl = GetThreadAndImageFromUrl as jest.MockedFunction<typeof GetThreadAndImageFromUrl>;

describe('/api/images - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variable
    process.env.NEXTAUTH_URL = 'https://example.com';
  });

  const createRequest = (url: string): Request => {
    return new Request(url, { method: 'GET' });
  };

  const createMockImageData = (format: string = 'png'): Uint8Array => {
    // Create mock image data
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
  };

  describe('Success Cases', () => {
    it('should return PNG image with correct headers', async () => {
      const testUrl = 'https://example.com/api/images?t=thread123&img=test.png';
      const mockImageData = createMockImageData('png');
      
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread123', imgName: 'test.png' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'OK',
        response: new ReadableStream({
          start(controller) {
            controller.enqueue(mockImageData);
            controller.close();
          }
        })
      });

      const request = createRequest(testUrl);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
      expect(mockGetThreadAndImageFromUrl).toHaveBeenCalledWith(testUrl);
      expect(mockGetImageFromStore).toHaveBeenCalledWith('thread123', 'test.png');
    });

    it('should handle JPEG images with correct content type', async () => {
      const testUrl = 'https://example.com/api/images?t=thread456&img=photo.jpg';
      
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread456', imgName: 'photo.jpg' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'OK',
        response: new ReadableStream()
      });

      const request = createRequest(testUrl);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
    });

    it('should handle different image formats correctly', async () => {
      const testCases = [
        { url: 'https://example.com/api/images?t=t1&img=test.jpeg', expected: 'image/jpeg' },
        { url: 'https://example.com/api/images?t=t1&img=test.gif', expected: 'image/gif' },
        { url: 'https://example.com/api/images?t=t1&img=test.webp', expected: 'image/webp' },
        { url: 'https://example.com/api/images?t=t1&img=test.PNG', expected: 'image/png' },
      ];

      for (const testCase of testCases) {
        mockGetThreadAndImageFromUrl.mockReturnValue({
          status: 'OK',
          response: { threadId: 't1', imgName: testCase.url.split('img=')[1] }
        });

        mockGetImageFromStore.mockResolvedValue({
          status: 'OK',
          response: new ReadableStream()
        });

        const request = createRequest(testCase.url);
        const response = await GET(request);

        expect(response.headers.get('content-type')).toBe(testCase.expected);
      }
    });

    it('should handle complex valid thread IDs and image names', async () => {
      const testUrl = 'https://example.com/api/images?t=thread-123_ABC&img=my-image_file.png';
      
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread-123_ABC', imgName: 'my-image_file.png' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'OK',
        response: new ReadableStream()
      });

      const request = createRequest(testUrl);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetImageFromStore).toHaveBeenCalledWith('thread-123_ABC', 'my-image_file.png');
    });
  });

  describe('URL Validation', () => {
    it('should reject invalid URL format', async () => {
      // Create request with undefined URL - this simulates invalid URL format
      const request = { url: undefined } as unknown as Request;
      
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid URL');
    });

    it('should reject non-string URLs', async () => {
      const request = { url: 123 } as unknown as Request;
      
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid URL');
    });

    it('should reject URLs that are too long', async () => {
      const longUrl = 'https://example.com/api/images?t=thread&img=test.png' + 'x'.repeat(2000);
      const request = createRequest(longUrl);
      
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('URL too long');
    });

    it('should handle URL parsing errors', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid URL format' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid URL format');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject missing thread ID', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Missing required parameters: threadId (t) and/or imgName (img).' }]
      });

      const request = createRequest('https://example.com/api/images?img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing required parameters: threadId (t) and/or imgName (img).');
    });

    it('should reject missing image name', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Missing required parameters: threadId (t) and/or imgName (img).' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing required parameters: threadId (t) and/or imgName (img).');
    });

    it('should reject invalid thread ID format', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid threadId format. Only alphanumeric characters, hyphens, and underscores allowed.' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread@123&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid threadId format. Only alphanumeric characters, hyphens, and underscores allowed.');
    });

    it('should reject invalid image name format', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid image name format. Must be a valid image file with extension.' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=test.txt');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid image name format. Must be a valid image file with extension.');
    });
  });

  describe('Security Validation', () => {
    it('should handle XSS attempts in thread ID', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid threadId after sanitization.' }]
      });

      const request = createRequest('https://example.com/api/images?t=<script>alert("xss")</script>&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should handle XSS attempts in image name', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid image name format. Must be a valid image file with extension.' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=<img src=x onerror=alert(1)>.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject path traversal attempts', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid image name format. Must be a valid image file with extension.' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=../../../etc/passwd.png');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject oversized parameters', async () => {
      const longThreadId = 'a'.repeat(101);
      
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid threadId or imgName after sanitization.' }]
      });

      const request = createRequest(`https://example.com/api/images?t=${longThreadId}&img=test.png`);
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Image Retrieval', () => {
    it('should handle image not found', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread123', imgName: 'notfound.png' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'ERROR',
        errors: [{ message: 'Image not found' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=notfound.png');
      const response = await GET(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Image not found');
    });

    it('should handle storage service errors', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread123', imgName: 'test.png' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'ERROR',
        errors: [{ message: 'Storage service unavailable' }]
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Storage service unavailable');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockGetThreadAndImageFromUrl.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = createRequest('https://example.com/api/images?t=thread123&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal server error');
    });

    it('should handle async errors in image retrieval', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread123', imgName: 'test.png' }
      });

      mockGetImageFromStore.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest('https://example.com/api/images?t=thread123&img=test.png');
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal server error');
    });

    it('should handle malformed URL objects', async () => {
      // Mock URL constructor to throw
      const originalURL = global.URL;
      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Invalid URL format: Error: Invalid URL' }]
      });

      const request = createRequest('invalid-url');
      const response = await GET(request);

      expect(response.status).toBe(400);

      // Restore original URL constructor
      global.URL = originalURL;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query parameters', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'ERROR',
        errors: [{ message: 'Missing required parameters: threadId (t) and/or imgName (img).' }]
      });

      const request = createRequest('https://example.com/api/images?t=&img=');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should handle special characters in valid ranges', async () => {
      mockGetThreadAndImageFromUrl.mockReturnValue({
        status: 'OK',
        response: { threadId: 'thread-123_ABC', imgName: 'my_image-123.png' }
      });

      mockGetImageFromStore.mockResolvedValue({
        status: 'OK',
        response: new ReadableStream()
      });

      const request = createRequest('https://example.com/api/images?t=thread-123_ABC&img=my_image-123.png');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle case-insensitive file extensions', async () => {
      const testCases = ['test.PNG', 'test.JPG', 'test.JPEG', 'test.GIF', 'test.WEBP'];

      for (const imgName of testCases) {
        mockGetThreadAndImageFromUrl.mockReturnValue({
          status: 'OK',
          response: { threadId: 'thread123', imgName }
        });

        mockGetImageFromStore.mockResolvedValue({
          status: 'OK',
          response: new ReadableStream()
        });

        const request = createRequest(`https://example.com/api/images?t=thread123&img=${imgName}`);
        const response = await GET(request);

        expect(response.status).toBe(200);
      }
    });
  });
});