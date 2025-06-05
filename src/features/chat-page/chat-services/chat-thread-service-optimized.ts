// ABOUTME: Optimized chat thread service with pagination and caching
// ABOUTME: Improves performance for large chat histories with efficient queries

"use server";
import "server-only";

import {
  getCurrentUser,
  userHashedId,
  userSession,
} from "@/features/auth-page/helpers";
import { sanitizeInput } from "@/features/common/services/validation-service";
import { RedirectToChatThread } from "@/features/common/navigation-helpers";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { uniqueId } from "@/features/common/util";
import {
  CHAT_DEFAULT_PERSONA,
  NEW_CHAT_NAME,
} from "@/features/theme/theme-config";
import { SqlQuerySpec } from "@azure/cosmos";
import { 
  optimizedCosmosService, 
  PaginatedResponse,
  PaginationOptions 
} from "../../common/services/cosmos-optimized";
import { DeleteDocuments } from "./azure-ai-search/azure-ai-search";
import { FindAllChatDocuments } from "./chat-document-service";
import { FindAllChatMessagesForCurrentUser } from "./chat-message-service";
import {
  CHAT_THREAD_ATTRIBUTE,
  ChatDocumentModel,
  ChatThreadModel,
} from "./models";

/**
 * Find all chat threads for current user with pagination
 */
export const FindAllChatThreadsWithPagination = async (
  options: PaginationOptions = {}
): Promise<ServerActionResponse<PaginatedResponse<ChatThreadModel>>> => {
  try {
    const userId = await userHashedId();
    
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.lastMessageAt DESC",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: userId,
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const response = await optimizedCosmosService.queryWithPagination<ChatThreadModel>(
      optimizedCosmosService.historyContainer(),
      querySpec,
      {
        ...options,
        partitionKey: userId,
      }
    );

    return {
      status: "OK",
      response,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Find recent chat threads (optimized for home page)
 */
export const FindRecentChatThreads = async (
  limit: number = 10
): Promise<ServerActionResponse<ChatThreadModel[]>> => {
  try {
    const userId = await userHashedId();
    
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT TOP @limit * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.lastMessageAt DESC",
      parameters: [
        {
          name: "@limit",
          value: limit,
        },
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: userId,
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const resources = await optimizedCosmosService.query<ChatThreadModel>(
      optimizedCosmosService.historyContainer(),
      querySpec,
      {
        partitionKey: userId,
      }
    );

    return {
      status: "OK",
      response: resources,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Find chat thread by ID (with caching)
 */
export const FindChatThreadByIdOptimized = async (
  id: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const userId = await userHashedId();
    
    // Try to read directly by ID first (faster than query)
    try {
      const { resource } = await optimizedCosmosService
        .historyContainer()
        .item(id, userId)
        .read<ChatThreadModel>();
      
      if (resource && 
          resource.type === CHAT_THREAD_ATTRIBUTE && 
          resource.userId === userId && 
          !resource.isDeleted) {
        return {
          status: "OK",
          response: resource,
        };
      }
    } catch (error: any) {
      // Item not found, fall back to query
      if (error.code !== 404) {
        throw error;
      }
    }

    // Fallback to query if direct read fails
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.id=@id AND r.isDeleted=@isDeleted",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: userId,
        },
        {
          name: "@id",
          value: id,
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const resources = await optimizedCosmosService.query<ChatThreadModel>(
      optimizedCosmosService.historyContainer(),
      querySpec,
      {
        partitionKey: userId,
      }
    );

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [{ message: `Chat thread not found` }],
      };
    }

    return {
      status: "OK",
      response: resources[0],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Batch soft delete for better performance
 */
export const BatchSoftDeleteChatThread = async (
  chatThreadID: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const userId = await userHashedId();
    const chatThreadResponse = await FindChatThreadByIdOptimized(chatThreadID);

    if (chatThreadResponse.status !== "OK") {
      return chatThreadResponse;
    }

    // Get all related items in parallel
    const [messagesResponse, documentsResponse] = await Promise.all([
      FindAllChatMessagesForCurrentUser(chatThreadID),
      FindAllChatDocuments(chatThreadID),
    ]);

    if (messagesResponse.status !== "OK") {
      return messagesResponse;
    }

    // Prepare all updates
    const updates: Array<{ id: string; isDeleted: boolean }> = [];

    // Add messages to updates
    messagesResponse.response.forEach(message => {
      updates.push({ ...message, isDeleted: true });
    });

    // Add documents to updates if any
    if (documentsResponse.status === "OK" && documentsResponse.response.length > 0) {
      documentsResponse.response.forEach(doc => {
        updates.push({ ...doc, isDeleted: true });
      });

      // Delete from search index in background
      DeleteDocuments(chatThreadID).catch(error => {
        console.error("Failed to delete documents from search:", error);
      });
    }

    // Add thread to updates
    updates.push({ ...chatThreadResponse.response, isDeleted: true });

    // Batch update all items
    await optimizedCosmosService.batchUpsert(
      optimizedCosmosService.historyContainer(),
      updates,
      userId
    );

    return {
      status: "OK",
      response: { ...chatThreadResponse.response, isDeleted: true },
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Create new chat thread (optimized)
 */
export const CreateChatThreadOptimized = async (
  name?: string,
  persona?: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const userId = await userHashedId();
    const user = await userSession();
    
    const newChatThread: ChatThreadModel = {
      id: uniqueId(),
      name: sanitizeInput(name || NEW_CHAT_NAME),
      createdAt: new Date(),
      lastMessageAt: new Date(),
      userId: userId,
      useName: user?.name || "",
      isDeleted: false,
      persona: persona || CHAT_DEFAULT_PERSONA,
      extension: [],
      type: CHAT_THREAD_ATTRIBUTE,
    };

    await optimizedCosmosService.upsert(
      optimizedCosmosService.historyContainer(),
      newChatThread,
      userId
    );

    return {
      status: "OK",
      response: newChatThread,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Update chat thread last message time
 */
export const UpdateChatThreadTimestamp = async (
  chatThreadId: string
): Promise<void> => {
  try {
    const userId = await userHashedId();
    const threadResponse = await FindChatThreadByIdOptimized(chatThreadId);
    
    if (threadResponse.status === "OK") {
      await optimizedCosmosService.upsert(
        optimizedCosmosService.historyContainer(),
        {
          ...threadResponse.response,
          lastMessageAt: new Date(),
        },
        userId
      );
    }
  } catch (error) {
    console.error("Failed to update chat thread timestamp:", error);
  }
};

/**
 * Get chat thread statistics
 */
export const GetChatThreadStats = async (): Promise<
  ServerActionResponse<{
    totalThreads: number;
    activeThreads: number;
    totalMessages: number;
  }>
> => {
  try {
    const userId = await userHashedId();
    
    const statsQuery: SqlQuerySpec = {
      query: `
        SELECT 
          COUNT(1) as count,
          r.type
        FROM root r 
        WHERE r.userId=@userId AND r.isDeleted=@isDeleted 
        GROUP BY r.type
      `,
      parameters: [
        { name: "@userId", value: userId },
        { name: "@isDeleted", value: false },
      ],
    };

    const results = await optimizedCosmosService.query<{
      count: number;
      type: string;
    }>(
      optimizedCosmosService.historyContainer(),
      statsQuery,
      { partitionKey: userId }
    );

    const stats = {
      totalThreads: 0,
      activeThreads: 0,
      totalMessages: 0,
    };

    results.forEach(result => {
      if (result.type === CHAT_THREAD_ATTRIBUTE) {
        stats.totalThreads = result.count;
      } else if (result.type === "CHAT_MESSAGE") {
        stats.totalMessages = result.count;
      }
    });

    // Active threads are those with messages in the last 7 days
    const activeQuery: SqlQuerySpec = {
      query: `
        SELECT COUNT(1) as count
        FROM root r 
        WHERE r.type=@type 
          AND r.userId=@userId 
          AND r.isDeleted=@isDeleted 
          AND r.lastMessageAt > @cutoffDate
      `,
      parameters: [
        { name: "@type", value: CHAT_THREAD_ATTRIBUTE },
        { name: "@userId", value: userId },
        { name: "@isDeleted", value: false },
        { 
          name: "@cutoffDate", 
          value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() 
        },
      ],
    };

    const activeResults = await optimizedCosmosService.query<{ count: number }>(
      optimizedCosmosService.historyContainer(),
      activeQuery,
      { partitionKey: userId }
    );

    if (activeResults.length > 0) {
      stats.activeThreads = activeResults[0].count;
    }

    return {
      status: "OK",
      response: stats,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};