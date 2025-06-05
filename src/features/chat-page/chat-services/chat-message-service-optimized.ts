// ABOUTME: Optimized chat message service with pagination and batch operations
// ABOUTME: Improves performance for message loading and streaming with efficient queries

"use server";
import "server-only";

import { userHashedId } from "@/features/auth-page/helpers";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { SqlQuerySpec } from "@azure/cosmos";
import { 
  optimizedCosmosService, 
  PaginatedResponse,
  PaginationOptions 
} from "../../common/services/cosmos-optimized";
import {
  CHAT_MESSAGE_ATTRIBUTE,
  ChatMessageModel,
  ChatRole,
  MESSAGE_DELIMITER,
} from "./models";

/**
 * Find all messages for a chat thread with pagination
 */
export const FindAllChatMessagesWithPagination = async (
  chatThreadId: string,
  options: PaginationOptions = {}
): Promise<ServerActionResponse<PaginatedResponse<ChatMessageModel>>> => {
  try {
    const userId = await userHashedId();
    
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.threadId=@threadId AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.createdAt ASC",
      parameters: [
        {
          name: "@type",
          value: CHAT_MESSAGE_ATTRIBUTE,
        },
        {
          name: "@threadId",
          value: chatThreadId,
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

    const response = await optimizedCosmosService.queryWithPagination<ChatMessageModel>(
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
 * Find recent messages for a chat thread (optimized for initial load)
 */
export const FindRecentChatMessages = async (
  chatThreadId: string,
  limit: number = 50
): Promise<ServerActionResponse<ChatMessageModel[]>> => {
  try {
    const userId = await userHashedId();
    
    // First get total count to determine offset
    const countQuery: SqlQuerySpec = {
      query:
        "SELECT VALUE COUNT(1) FROM root r WHERE r.type=@type AND r.threadId=@threadId AND r.userId=@userId AND r.isDeleted=@isDeleted",
      parameters: [
        {
          name: "@type",
          value: CHAT_MESSAGE_ATTRIBUTE,
        },
        {
          name: "@threadId",
          value: chatThreadId,
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

    const countResult = await optimizedCosmosService.query<number>(
      optimizedCosmosService.historyContainer(),
      countQuery,
      { partitionKey: userId }
    );

    const totalCount = countResult[0] || 0;
    const offset = Math.max(0, totalCount - limit);

    // Get recent messages with offset
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.threadId=@threadId AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.createdAt ASC OFFSET @offset LIMIT @limit",
      parameters: [
        {
          name: "@type",
          value: CHAT_MESSAGE_ATTRIBUTE,
        },
        {
          name: "@threadId",
          value: chatThreadId,
        },
        {
          name: "@userId",
          value: userId,
        },
        {
          name: "@isDeleted",
          value: false,
        },
        {
          name: "@offset",
          value: offset,
        },
        {
          name: "@limit",
          value: limit,
        },
      ],
    };

    const resources = await optimizedCosmosService.query<ChatMessageModel>(
      optimizedCosmosService.historyContainer(),
      querySpec,
      { partitionKey: userId }
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
 * Batch create messages for better performance
 */
export const BatchCreateChatMessages = async (
  messages: Omit<ChatMessageModel, "id" | "createdAt" | "type">[]
): Promise<ServerActionResponse<ChatMessageModel[]>> => {
  try {
    const userId = await userHashedId();
    const now = new Date();
    
    const messagesToCreate: ChatMessageModel[] = messages.map((message, index) => ({
      ...message,
      id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(now.getTime() + index), // Ensure order
      type: CHAT_MESSAGE_ATTRIBUTE,
      userId,
      isDeleted: false,
    }));

    const created = await optimizedCosmosService.batchUpsert(
      optimizedCosmosService.historyContainer(),
      messagesToCreate,
      userId
    );

    return {
      status: "OK",
      response: created,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Optimized message creation with minimal database calls
 */
export const CreateChatMessageOptimized = async (
  message: Omit<ChatMessageModel, "id" | "createdAt" | "type" | "userId" | "isDeleted">
): Promise<ServerActionResponse<ChatMessageModel>> => {
  try {
    const userId = await userHashedId();
    
    const messageToCreate: ChatMessageModel = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      type: CHAT_MESSAGE_ATTRIBUTE,
      userId,
      isDeleted: false,
    };

    const created = await optimizedCosmosService.upsert(
      optimizedCosmosService.historyContainer(),
      messageToCreate,
      userId
    );

    // Update thread timestamp in background
    if (message.threadId) {
      import("./chat-thread-service-optimized").then(({ UpdateChatThreadTimestamp }) => {
        UpdateChatThreadTimestamp(message.threadId).catch(console.error);
      });
    }

    return {
      status: "OK",
      response: created,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Get message statistics for a thread
 */
export const GetChatMessageStats = async (
  chatThreadId: string
): Promise<ServerActionResponse<{
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
}>> => {
  try {
    const userId = await userHashedId();
    
    const statsQuery: SqlQuerySpec = {
      query: `
        SELECT 
          COUNT(1) as totalMessages,
          SUM(r.role = "user" ? 1 : 0) as userMessages,
          SUM(r.role = "assistant" ? 1 : 0) as assistantMessages,
          SUM(IS_DEFINED(r.tokens) ? r.tokens : 0) as totalTokens
        FROM root r 
        WHERE r.type=@type 
          AND r.threadId=@threadId 
          AND r.userId=@userId 
          AND r.isDeleted=@isDeleted
      `,
      parameters: [
        { name: "@type", value: CHAT_MESSAGE_ATTRIBUTE },
        { name: "@threadId", value: chatThreadId },
        { name: "@userId", value: userId },
        { name: "@isDeleted", value: false },
      ],
    };

    const results = await optimizedCosmosService.query<{
      totalMessages: number;
      userMessages: number;
      assistantMessages: number;
      totalTokens: number;
    }>(
      optimizedCosmosService.historyContainer(),
      statsQuery,
      { partitionKey: userId }
    );

    if (results.length === 0) {
      return {
        status: "OK",
        response: {
          totalMessages: 0,
          userMessages: 0,
          assistantMessages: 0,
          totalTokens: 0,
        },
      };
    }

    return {
      status: "OK",
      response: results[0],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Delete messages in batch for better performance
 */
export const BatchDeleteChatMessages = async (
  messageIds: string[]
): Promise<ServerActionResponse<number>> => {
  try {
    const userId = await userHashedId();
    
    if (messageIds.length === 0) {
      return {
        status: "OK",
        response: 0,
      };
    }

    // Batch read messages
    const messages = await optimizedCosmosService.batchRead<ChatMessageModel>(
      optimizedCosmosService.historyContainer(),
      messageIds,
      userId
    );

    // Mark as deleted
    const updates = messages.map(message => ({
      ...message,
      isDeleted: true,
    }));

    await optimizedCosmosService.batchUpsert(
      optimizedCosmosService.historyContainer(),
      updates,
      userId
    );

    return {
      status: "OK",
      response: updates.length,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

/**
 * Optimized message concatenation for context building
 */
export const BuildOptimizedMessageContext = (
  messages: ChatMessageModel[],
  maxTokens: number = 4000
): string => {
  // Pre-allocate array for better performance
  const contextParts: string[] = new Array(messages.length * 2);
  let index = 0;
  let estimatedTokens = 0;
  
  // Process messages in reverse to prioritize recent context
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const content = `${message.role}: ${message.content}`;
    const estimatedMessageTokens = Math.ceil(content.length / 4); // Rough token estimate
    
    if (estimatedTokens + estimatedMessageTokens > maxTokens && i !== messages.length - 1) {
      break;
    }
    
    contextParts[index++] = content;
    contextParts[index++] = MESSAGE_DELIMITER;
    estimatedTokens += estimatedMessageTokens;
  }
  
  // Reverse to maintain chronological order and join
  return contextParts
    .slice(0, index)
    .reverse()
    .join("");
};

/**
 * Stream-optimized message updates
 */
export const UpdateMessageContentStreaming = async (
  messageId: string,
  content: string,
  isComplete: boolean = false
): Promise<void> => {
  try {
    const userId = await userHashedId();
    
    // Use partial update for streaming content
    const container = optimizedCosmosService.historyContainer();
    await container
      .item(messageId, userId)
      .patch([
        { op: "replace", path: "/content", value: content },
        { op: "replace", path: "/updatedAt", value: new Date() },
      ]);
  } catch (error) {
    console.error("Failed to update streaming message:", error);
  }
};

/**
 * Get conversation summary for long threads
 */
export const GetConversationSummary = async (
  chatThreadId: string,
  options: { beforeMessageId?: string; maxMessages?: number } = {}
): Promise<ServerActionResponse<string>> => {
  try {
    const { beforeMessageId, maxMessages = 20 } = options;
    const userId = await userHashedId();
    
    let querySpec: SqlQuerySpec;
    
    if (beforeMessageId) {
      // Get message timestamp first
      const { resource: beforeMessage } = await optimizedCosmosService
        .historyContainer()
        .item(beforeMessageId, userId)
        .read<ChatMessageModel>();
      
      if (!beforeMessage) {
        return {
          status: "ERROR",
          errors: [{ message: "Reference message not found" }],
        };
      }
      
      querySpec = {
        query: `
          SELECT TOP @limit * FROM root r 
          WHERE r.type=@type 
            AND r.threadId=@threadId 
            AND r.userId=@userId 
            AND r.isDeleted=@isDeleted 
            AND r.createdAt < @beforeTime
          ORDER BY r.createdAt DESC
        `,
        parameters: [
          { name: "@limit", value: maxMessages },
          { name: "@type", value: CHAT_MESSAGE_ATTRIBUTE },
          { name: "@threadId", value: chatThreadId },
          { name: "@userId", value: userId },
          { name: "@isDeleted", value: false },
          { name: "@beforeTime", value: beforeMessage.createdAt },
        ],
      };
    } else {
      querySpec = {
        query: `
          SELECT TOP @limit * FROM root r 
          WHERE r.type=@type 
            AND r.threadId=@threadId 
            AND r.userId=@userId 
            AND r.isDeleted=@isDeleted
          ORDER BY r.createdAt DESC
        `,
        parameters: [
          { name: "@limit", value: maxMessages },
          { name: "@type", value: CHAT_MESSAGE_ATTRIBUTE },
          { name: "@threadId", value: chatThreadId },
          { name: "@userId", value: userId },
          { name: "@isDeleted", value: false },
        ],
      };
    }
    
    const messages = await optimizedCosmosService.query<ChatMessageModel>(
      optimizedCosmosService.historyContainer(),
      querySpec,
      { partitionKey: userId }
    );
    
    if (messages.length === 0) {
      return {
        status: "OK",
        response: "No previous conversation history.",
      };
    }
    
    // Build summary
    const summary = messages
      .reverse()
      .map(m => `${m.role}: ${m.content.substring(0, 100)}${m.content.length > 100 ? "..." : ""}`)
      .join("\n");
    
    return {
      status: "OK",
      response: summary,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};