// ABOUTME: Cached wrapper functions for chat services to reduce server calls
// ABOUTME: Implements client-side caching with automatic invalidation strategies

import { cacheManager, cacheKeys } from '@/features/common/cache/cache-manager';
import { ServerActionResponse } from '@/utils/server-action-response';
import { 
  ChatThreadModel, 
  ChatMessageModel, 
  ChatDocumentModel 
} from './models';
import {
  FindAllChatThreadForCurrentUser as originalFindAllChatThreads,
  FindChatThreadForCurrentUser as originalFindChatThread,
} from './chat-thread-service';
import {
  FindAllChatMessagesForCurrentUser as originalFindAllChatMessages,
} from './chat-message-service';
import {
  FindAllChatDocuments as originalFindAllChatDocuments,
} from './chat-document-service';
import { userHashedId } from '@/features/auth-page/helpers';

/**
 * Cached version of FindAllChatThreadForCurrentUser
 * Cache TTL: 5 minutes
 */
export async function FindAllChatThreadForCurrentUserCached(): Promise<
  ServerActionResponse<Array<ChatThreadModel>>
> {
  const userId = await userHashedId();
  const cacheKey = cacheKeys.chatThreads(userId);
  
  // Check cache first
  const cached = cacheManager.get<ServerActionResponse<Array<ChatThreadModel>>>(
    'chatThreads', 
    cacheKey
  );
  
  if (cached) {
    console.log('[Cache] Hit: Chat threads for user');
    return cached;
  }
  
  console.log('[Cache] Miss: Fetching chat threads from server');
  
  // Fetch from server
  const result = await originalFindAllChatThreads();
  
  // Cache successful responses
  if (result.status === 'OK') {
    cacheManager.set('chatThreads', cacheKey, result);
  }
  
  return result;
}

/**
 * Cached version of FindChatThreadForCurrentUser
 * Cache TTL: 5 minutes
 */
export async function FindChatThreadForCurrentUserCached(
  threadId: string
): Promise<ServerActionResponse<ChatThreadModel>> {
  const cacheKey = cacheKeys.chatThread(threadId);
  
  // Check cache first
  const cached = cacheManager.get<ServerActionResponse<ChatThreadModel>>(
    'chatThreads', 
    cacheKey
  );
  
  if (cached) {
    console.log(`[Cache] Hit: Chat thread ${threadId}`);
    return cached;
  }
  
  console.log(`[Cache] Miss: Fetching chat thread ${threadId} from server`);
  
  // Fetch from server
  const result = await originalFindChatThread(threadId);
  
  // Cache successful responses
  if (result.status === 'OK') {
    cacheManager.set('chatThreads', cacheKey, result);
  }
  
  return result;
}

/**
 * Cached version of FindAllChatMessagesForCurrentUser
 * Cache TTL: 10 minutes
 */
export async function FindAllChatMessagesForCurrentUserCached(
  chatThreadId: string
): Promise<ServerActionResponse<Array<ChatMessageModel>>> {
  const cacheKey = cacheKeys.chatMessages(chatThreadId);
  
  // Check cache first
  const cached = cacheManager.get<ServerActionResponse<Array<ChatMessageModel>>>(
    'chatMessages', 
    cacheKey
  );
  
  if (cached) {
    console.log(`[Cache] Hit: Messages for thread ${chatThreadId}`);
    return cached;
  }
  
  console.log(`[Cache] Miss: Fetching messages for thread ${chatThreadId} from server`);
  
  // Fetch from server
  const result = await originalFindAllChatMessages(chatThreadId);
  
  // Cache successful responses
  if (result.status === 'OK') {
    cacheManager.set('chatMessages', cacheKey, result);
  }
  
  return result;
}

/**
 * Cached version of FindAllChatDocuments
 * Cache TTL: 15 minutes
 */
export async function FindAllChatDocumentsCached(
  chatThreadId: string
): Promise<ServerActionResponse<Array<ChatDocumentModel>>> {
  const cacheKey = cacheKeys.chatDocuments(chatThreadId);
  
  // Check cache first
  const cached = cacheManager.get<ServerActionResponse<Array<ChatDocumentModel>>>(
    'documents', 
    cacheKey
  );
  
  if (cached) {
    console.log(`[Cache] Hit: Documents for thread ${chatThreadId}`);
    return cached;
  }
  
  console.log(`[Cache] Miss: Fetching documents for thread ${chatThreadId} from server`);
  
  // Fetch from server
  const result = await originalFindAllChatDocuments(chatThreadId);
  
  // Cache successful responses
  if (result.status === 'OK') {
    cacheManager.set('documents', cacheKey, result);
  }
  
  return result;
}

/**
 * Cache invalidation functions
 */
export const cacheInvalidation = {
  /**
   * Invalidate chat thread cache when a thread is updated
   */
  invalidateThread: (threadId: string) => {
    cacheManager.invalidate('chatThreads', cacheKeys.chatThread(threadId));
    // Also invalidate the list cache as it might be stale
    userHashedId().then(userId => {
      cacheManager.invalidate('chatThreads', cacheKeys.chatThreads(userId));
    });
  },
  
  /**
   * Invalidate messages cache when new messages are added
   */
  invalidateMessages: (threadId: string) => {
    cacheManager.invalidate('chatMessages', cacheKeys.chatMessages(threadId));
  },
  
  /**
   * Invalidate documents cache when documents are added/removed
   */
  invalidateDocuments: (threadId: string) => {
    cacheManager.invalidate('documents', cacheKeys.chatDocuments(threadId));
  },
  
  /**
   * Invalidate all caches for a user (useful on logout)
   */
  invalidateUserCaches: async () => {
    const userId = await userHashedId();
    cacheManager.invalidate('chatThreads', cacheKeys.chatThreads(userId));
    cacheManager.invalidate('personas', cacheKeys.personas(userId));
    cacheManager.invalidate('extensions', cacheKeys.extensions(userId));
    cacheManager.invalidate('userProfile', cacheKeys.userProfile(userId));
  },
  
  /**
   * Clear all caches
   */
  clearAll: () => {
    cacheManager.invalidateAll();
  }
};

/**
 * Preload data into cache for better performance
 */
export const cachePreloader = {
  /**
   * Preload chat threads for current user
   */
  preloadChatThreads: async () => {
    const result = await FindAllChatThreadForCurrentUserCached();
    return result.status === 'OK';
  },
  
  /**
   * Preload messages for a specific thread
   */
  preloadMessages: async (threadId: string) => {
    const result = await FindAllChatMessagesForCurrentUserCached(threadId);
    return result.status === 'OK';
  },
  
  /**
   * Preload messages for multiple threads (useful for recent chats)
   */
  preloadRecentChats: async (threadIds: string[], limit: number = 5) => {
    const promises = threadIds
      .slice(0, limit)
      .map(id => FindAllChatMessagesForCurrentUserCached(id));
    
    await Promise.allSettled(promises);
  }
};