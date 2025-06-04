import { getCurrentUser } from "@/features/auth-page/helpers";
import { sanitizeInput } from "@/features/common/services/validation-service";
import {
  CHAT_THREAD_ATTRIBUTE,
  ChatMessageModel,
  ChatThreadModel,
  MESSAGE_ATTRIBUTE,
} from "@/features/chat-page/chat-services/models";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { HistoryContainer } from "@/features/common/services/cosmos";
import { SqlQuerySpec } from "@azure/cosmos";

export const FindAllChatThreadsForAdmin = async (
  limit: number,
  offset: number
): Promise<ServerActionResponse<Array<ChatThreadModel>>> => {
  const user = await getCurrentUser();

  if (!user.isAdmin) {
    return {
      status: "ERROR",
      errors: [{ message: "You are not authorized to perform this action" }],
    };
  }

  // Validate input parameters
  if (typeof limit !== 'number' || typeof offset !== 'number') {
    return {
      status: "ERROR",
      errors: [{ message: "Limit and offset must be numbers" }],
    };
  }

  // Validate limit bounds (1 to 1000)
  if (limit < 1 || limit > 1000) {
    return {
      status: "ERROR",
      errors: [{ message: "Limit must be between 1 and 1000" }],
    };
  }

  // Validate offset bounds (non-negative, max 100,000 for performance)
  if (offset < 0 || offset > 100000) {
    return {
      status: "ERROR",
      errors: [{ message: "Offset must be between 0 and 100,000" }],
    };
  }

  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type ORDER BY r.createdAt DESC OFFSET @offset LIMIT @limit",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
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

    const { resources } = await HistoryContainer()
      .items.query<ChatThreadModel>(querySpec)
      .fetchAll();
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

export const FindAllChatMessagesForAdmin = async (
  chatThreadID: string
): Promise<ServerActionResponse<Array<ChatMessageModel>>> => {
  const user = await getCurrentUser();

  if (!user.isAdmin) {
    return {
      status: "ERROR",
      errors: [{ message: "You are not authorized to perform this action" }],
    };
  }

  // Validate input parameters
  if (!chatThreadID || typeof chatThreadID !== 'string') {
    return {
      status: "ERROR",
      errors: [{ message: "Chat thread ID is required and must be a string" }],
    };
  }

  // Sanitize thread ID
  const sanitizedThreadId = sanitizeInput(chatThreadID, { maxLength: 100, allowNewlines: false });

  if (!sanitizedThreadId) {
    return {
      status: "ERROR",
      errors: [{ message: "Invalid chat thread ID" }],
    };
  }

  // Validate thread ID format
  if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId)) {
    return {
      status: "ERROR",
      errors: [{ message: "Invalid chat thread ID format" }],
    };
  }

  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.threadId = @threadId ORDER BY r.createdAt ASC",
      parameters: [
        {
          name: "@type",
          value: MESSAGE_ATTRIBUTE,
        },
        {
          name: "@threadId",
          value: sanitizedThreadId,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ChatMessageModel>(querySpec)
      .fetchAll();

    return {
      status: "OK",
      response: resources,
    };
  } catch (e) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `${e}`,
        },
      ],
    };
  }
};
