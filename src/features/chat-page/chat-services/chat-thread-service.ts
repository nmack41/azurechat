"use server";
import "server-only";

import {
  getCurrentUser,
  userHashedId,
  userSession,
} from "@/features/auth-page/helpers";
import { sanitizeInput } from "@/services/validation-service";
import { RedirectToChatThread } from "@/utils/navigation-helpers";
import { ServerActionResponse } from "@/utils/server-action-response";
import { uniqueId } from "@/utils/util";
import {
  CHAT_DEFAULT_PERSONA,
  NEW_CHAT_NAME,
} from "@/features/theme/theme-config";
import { SqlQuerySpec } from "@azure/cosmos";
import { HistoryContainer } from "../../common/services/cosmos";
import { DeleteDocuments } from "./azure-ai-search/azure-ai-search";
import { FindAllChatDocuments } from "./chat-document-service";
import { FindAllChatMessagesForCurrentUser } from "./chat-message-service";
import {
  CHAT_THREAD_ATTRIBUTE,
  ChatDocumentModel,
  ChatThreadModel,
} from "./models";

export const FindAllChatThreadForCurrentUser = async (): Promise<
  ServerActionResponse<Array<ChatThreadModel>>
> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: await userHashedId(),
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ChatThreadModel>(querySpec, {
        partitionKey: await userHashedId(),
      })
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

export const FindChatThreadForCurrentUser = async (
  id: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
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
          value: await userHashedId(),
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

    const { resources } = await HistoryContainer()
      .items.query<ChatThreadModel>(querySpec)
      .fetchAll();

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

export const SoftDeleteChatThreadForCurrentUser = async (
  chatThreadID: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const chatThreadResponse = await FindChatThreadForCurrentUser(chatThreadID);

    if (chatThreadResponse.status === "OK") {
      const chatResponse = await FindAllChatMessagesForCurrentUser(
        chatThreadID
      );

      if (chatResponse.status !== "OK") {
        return chatResponse;
      }
      const chats = chatResponse.response;

      await Promise.all(chats.map(async (chat) => {
        const itemToUpdate = {
          ...chat,
        };
        itemToUpdate.isDeleted = true;
        return await HistoryContainer().items.upsert(itemToUpdate);
      }));

      const chatDocumentsResponse = await FindAllChatDocuments(chatThreadID);

      if (chatDocumentsResponse.status !== "OK") {
        return chatDocumentsResponse;
      }

      const chatDocuments = chatDocumentsResponse.response;

      if (chatDocuments.length !== 0) {
        await DeleteDocuments(chatThreadID);
      }

      await Promise.all(chatDocuments.map(async (chatDocument: ChatDocumentModel) => {
        const itemToUpdate = {
          ...chatDocument,
        };
        itemToUpdate.isDeleted = true;
        return await HistoryContainer().items.upsert(itemToUpdate);
      }));

      chatThreadResponse.response.isDeleted = true;
      await HistoryContainer().items.upsert(chatThreadResponse.response);
    }

    return chatThreadResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const EnsureChatThreadOperation = async (
  chatThreadID: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  const response = await FindChatThreadForCurrentUser(chatThreadID);
  const hashedId = await userHashedId();

  if (response.status === "OK") {
    // Only allow access if the user owns the chat thread
    if (response.response.userId === hashedId) {
      return response;
    } else {
      // Log unauthorized access attempts for security monitoring
      const currentUser = await getCurrentUser();
      console.warn(`Unauthorized chat access attempt: User ${currentUser.email} (admin: ${currentUser.isAdmin}) tried to access thread ${chatThreadID} owned by ${response.response.userId}`);
      
      return {
        status: "UNAUTHORIZED",
        errors: [{
          message: "You don't have permission to access this chat thread"
        }]
      };
    }
  }

  return response;
};

export const AddExtensionToChatThread = async (props: {
  chatThreadId: string;
  extensionId: string;
}): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    // Validate inputs
    if (!props.chatThreadId || typeof props.chatThreadId !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Chat thread ID is required" }],
      };
    }

    if (!props.extensionId || typeof props.extensionId !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Extension ID is required" }],
      };
    }

    // Sanitize inputs
    const sanitizedThreadId = sanitizeInput(props.chatThreadId, { maxLength: 100, allowNewlines: false });
    const sanitizedExtensionId = sanitizeInput(props.extensionId, { maxLength: 100, allowNewlines: false });

    if (!sanitizedThreadId || !sanitizedExtensionId) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid thread ID or extension ID" }],
      };
    }

    // Validate ID formats
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId) || !/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedExtensionId)) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid ID format" }],
      };
    }

    const response = await FindChatThreadForCurrentUser(sanitizedThreadId);
    if (response.status === "OK") {
      const chatThread = response.response;

      const existingExtension = chatThread.extension.find(
        (e) => e === sanitizedExtensionId
      );

      if (existingExtension === undefined) {
        chatThread.extension.push(sanitizedExtensionId);
        return await UpsertChatThread(chatThread);
      }

      return {
        status: "OK",
        response: chatThread,
      };
    }

    return response;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const RemoveExtensionFromChatThread = async (props: {
  chatThreadId: string;
  extensionId: string;
}): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    // Validate inputs
    if (!props.chatThreadId || typeof props.chatThreadId !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Chat thread ID is required" }],
      };
    }

    if (!props.extensionId || typeof props.extensionId !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Extension ID is required" }],
      };
    }

    // Sanitize inputs
    const sanitizedThreadId = sanitizeInput(props.chatThreadId, { maxLength: 100, allowNewlines: false });
    const sanitizedExtensionId = sanitizeInput(props.extensionId, { maxLength: 100, allowNewlines: false });

    if (!sanitizedThreadId || !sanitizedExtensionId) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid thread ID or extension ID" }],
      };
    }

    // Validate ID formats
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId) || !/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedExtensionId)) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid ID format" }],
      };
    }

    const response = await FindChatThreadForCurrentUser(sanitizedThreadId);
    if (response.status === "OK") {
      const chatThread = response.response;
      chatThread.extension = chatThread.extension.filter(
        (e) => e !== sanitizedExtensionId
      );

      return await UpsertChatThread(chatThread);
    }

    return response;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const UpsertChatThread = async (
  chatThread: ChatThreadModel
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    if (chatThread.id) {
      const response = await EnsureChatThreadOperation(chatThread.id);
      if (response.status !== "OK") {
        return response;
      }
    }

    chatThread.lastMessageAt = new Date();
    const { resource } = await HistoryContainer().items.upsert<ChatThreadModel>(
      chatThread
    );

    if (resource) {
      return {
        status: "OK",
        response: resource,
      };
    }

    return {
      status: "ERROR",
      errors: [{ message: `Chat thread not found` }],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const CreateChatThread = async (): Promise<
  ServerActionResponse<ChatThreadModel>
> => {
  try {
    const modelToSave: ChatThreadModel = {
      name: NEW_CHAT_NAME,
      useName: (await userSession())!.name,
      userId: await userHashedId(),
      id: uniqueId(),
      createdAt: new Date(),
      lastMessageAt: new Date(),
      bookmarked: false,
      isDeleted: false,
      type: CHAT_THREAD_ATTRIBUTE,
      personaMessage: "",
      personaMessageTitle: CHAT_DEFAULT_PERSONA,
      extension: [],
    };

    const { resource } = await HistoryContainer().items.create<ChatThreadModel>(
      modelToSave
    );
    if (resource) {
      return {
        status: "OK",
        response: resource,
      };
    }

    return {
      status: "ERROR",
      errors: [{ message: `Chat thread not found` }],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const UpdateChatTitle = async (
  chatThreadId: string,
  title: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    // Validate inputs
    if (!chatThreadId || typeof chatThreadId !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Chat thread ID is required" }],
      };
    }

    if (!title || typeof title !== 'string') {
      return {
        status: "ERROR",
        errors: [{ message: "Title is required" }],
      };
    }

    // Sanitize inputs
    const sanitizedThreadId = sanitizeInput(chatThreadId, { maxLength: 100, allowNewlines: false });
    const sanitizedTitle = sanitizeInput(title, { maxLength: 100, allowNewlines: false });

    if (!sanitizedThreadId || !sanitizedTitle) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid thread ID or title" }],
      };
    }

    // Validate thread ID format
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId)) {
      return {
        status: "ERROR",
        errors: [{ message: "Invalid thread ID format" }],
      };
    }

    const response = await FindChatThreadForCurrentUser(sanitizedThreadId);
    if (response.status === "OK") {
      const chatThread = response.response;
      // Use sanitized title, limited to 30 characters for UI consistency
      chatThread.name = sanitizedTitle.substring(0, 30);
      return await UpsertChatThread(chatThread);
    }
    return response;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const CreateChatAndRedirect = async () => {
  const response = await CreateChatThread();
  if (response.status === "OK") {
    RedirectToChatThread(response.response.id);
  }
};
