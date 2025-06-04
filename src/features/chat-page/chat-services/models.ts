import { ChatCompletionSnapshot } from "openai/lib/ChatCompletionStream";
import { ChatCompletionMessage } from "openai/resources/chat/completions";

export const CHAT_DOCUMENT_ATTRIBUTE = "CHAT_DOCUMENT";
export const CHAT_THREAD_ATTRIBUTE = "CHAT_THREAD";
export const MESSAGE_ATTRIBUTE = "CHAT_MESSAGE";
export const CHAT_CITATION_ATTRIBUTE = "CHAT_CITATION";

export interface ChatMessageModel {
  id: string;
  createdAt: Date;
  isDeleted: boolean;
  threadId: string;
  userId: string;
  content: string;
  role: ChatRole;
  name: string;
  multiModalImage?: string;
  type: typeof MESSAGE_ATTRIBUTE;
}

export type ChatRole = "system" | "user" | "assistant" | "function" | "tool";

export interface ChatThreadModel {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  userId: string;
  useName: string;
  isDeleted: boolean;
  bookmarked: boolean;
  personaMessage: string;
  personaMessageTitle: string;
  extension: string[];
  type: typeof CHAT_THREAD_ATTRIBUTE;
}

export interface UserPrompt {
  id: string; // thread id
  message: string;
  multimodalImage: string;
}

export interface ChatDocumentModel {
  id: string;
  name: string;
  chatThreadId: string;
  userId: string;
  isDeleted: boolean;
  createdAt: Date;
  type: typeof CHAT_DOCUMENT_ATTRIBUTE;
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: {
      type: string;
    };
  }>;
  required?: string[];
}

export interface ToolsInterface {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export type MenuItemsGroupName = "Bookmarked" | "Past 7 days" | "Previous";

export type MenuItemsGroup = {
  groupName: MenuItemsGroupName;
} & ChatThreadModel;

export interface CitationContent {
  title?: string;
  content: string;
  filepath?: string;
  url?: string;
  metadata?: Record<string, string | number>;
}

export type ChatCitationModel = {
  id: string;
  content: CitationContent;
  userId: string;
  type: typeof CHAT_CITATION_ATTRIBUTE;
};

export type AzureChatCompletionFunctionCall = {
  type: "functionCall";
  response: ChatCompletionMessage.FunctionCall;
};

export type AzureChatCompletionFunctionCallResult = {
  type: "functionCallResult";
  response: string;
};

export type AzureChatCompletionContent = {
  type: "content";
  response: ChatCompletionSnapshot;
};

export type AzureChatCompletionFinalContent = {
  type: "finalContent";
  response: string;
};

export type AzureChatCompletionError = {
  type: "error";
  response: string;
};

export type AzureChatCompletionAbort = {
  type: "abort";
  response: string;
};

export type AzureChatCompletion =
  | AzureChatCompletionError
  | AzureChatCompletionFunctionCall
  | AzureChatCompletionFunctionCallResult
  | AzureChatCompletionContent
  | AzureChatCompletionFinalContent
  | AzureChatCompletionAbort;
