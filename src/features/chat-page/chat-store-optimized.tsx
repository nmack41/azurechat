// ABOUTME: Optimized chat store with improved Valtio patterns and performance
// ABOUTME: Reduces unnecessary re-renders and optimizes state updates

"use client";
import { uniqueId } from "@/features/common/util";
import { showError } from "@/features/globals/global-message-store";
import { AI_NAME, NEW_CHAT_NAME } from "@/features/theme/theme-config";
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from "eventsource-parser";
import { FormEvent } from "react";
import { proxy, useSnapshot, subscribe, ref } from "valtio";
import { proxyMap } from "valtio/utils";
import { RevalidateCache } from "../common/navigation-helpers";
import { InputImageStore } from "../ui/chat/chat-input-area/input-image-store";
import { textToSpeechStore } from "./chat-input/speech/use-text-to-speech";
import { ResetInputRows } from "./chat-input/use-chat-input-dynamic-height";
import {
  AddExtensionToChatThread,
  RemoveExtensionFromChatThread,
  UpdateChatTitle,
} from "./chat-services/chat-thread-service";
import {
  AzureChatCompletion,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";

let abortController: AbortController = new AbortController();

type ChatStatus = "idle" | "loading" | "file upload";

/**
 * Optimized chat state with better Valtio patterns
 */
class OptimizedChatState {
  // Use ref() for large objects to prevent deep proxying
  public messagesMap = proxyMap<string, ChatMessageModel>();
  public loading: ChatStatus = "idle";
  public input: string = "";
  public lastMessage: string = "";
  public autoScroll: boolean = false;
  public userName: string = "";
  public chatThreadId: string = "";
  
  // Store thread as ref to prevent deep proxying
  private chatThread = ref<ChatThreadModel | undefined>(undefined);
  
  // Computed property for messages array
  public get messages(): ChatMessageModel[] {
    return Array.from(this.messagesMap.values());
  }

  // Optimized message operations using Map
  private addOrUpdateMessage(message: ChatMessageModel) {
    const existingMessage = this.messagesMap.get(message.id);
    if (existingMessage) {
      // Only update if content actually changed
      if (existingMessage.content !== message.content) {
        this.messagesMap.set(message.id, { ...existingMessage, content: message.content });
      }
    } else {
      this.messagesMap.set(message.id, message);
    }
  }

  private removeMessage(id: string) {
    this.messagesMap.delete(id);
  }

  public initChatSession(props: {
    chatThread: ChatThreadModel;
    messages: ChatMessageModel[];
    userName: string;
  }) {
    // Batch updates to reduce re-renders
    this.chatThread = ref(props.chatThread);
    this.chatThreadId = props.chatThread.id;
    this.userName = props.userName;
    
    // Clear and repopulate messages efficiently
    this.messagesMap.clear();
    props.messages.forEach(msg => {
      this.messagesMap.set(msg.id, msg);
    });
    
    abortController = new AbortController();
  }

  public updateInput(value: string) {
    // Only update if value actually changed
    if (this.input !== value) {
      this.input = value;
    }
  }

  public async submitChat(e: FormEvent<HTMLFormElement>) {
    // Prevent concurrent submissions
    if (this.loading === "loading") {
      return;
    }

    e.preventDefault();

    const model = new FormData(e.currentTarget);
    const inputValue = model.get("input") as string;

    if (!inputValue.trim()) {
      return;
    }

    // Early state updates
    this.loading = "loading";
    this.input = "";
    this.lastMessage = inputValue;
    ResetInputRows();

    // Create user message
    const userMessage: ChatMessageModel = {
      id: uniqueId(),
      createdAt: new Date(),
      type: "CHAT_MESSAGE",
      isDeleted: false,
      content: inputValue,
      name: this.userName,
      role: "user",
      threadId: this.chatThreadId,
      userId: "",
      multiModalImage: await InputImageStore.getImageDataAsBase64(),
    };

    this.addOrUpdateMessage(userMessage);

    try {
      await this.makeApiRequest(model);
    } catch (error) {
      showError("An error occurred. Please try again.");
      console.error("Chat submission error:", error);
    } finally {
      // Always reset loading state
      if (this.loading === "loading") {
        this.loading = "idle";
      }
    }
  }

  // Improved streaming message handling
  private async makeApiRequest(model: FormData) {
    model.append("id", this.chatThreadId);
    model.set("chatType", "simple");

    const response = await fetch("/api/chat", {
      method: "POST",
      body: model,
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error("Failed to get response");
    }

    const responseBody = response.body;
    const reader = responseBody.getReader();

    // Create assistant message once
    const assistantMessage: ChatMessageModel = {
      id: uniqueId(),
      createdAt: new Date(),
      type: "CHAT_MESSAGE",
      isDeleted: false,
      content: "",
      name: AI_NAME,
      role: "assistant",
      threadId: this.chatThreadId,
      userId: "",
    };

    // Add empty message to show loading state
    this.addOrUpdateMessage(assistantMessage);

    // Process stream efficiently
    await this.processStream(reader, assistantMessage);
  }

  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    assistantMessage: ChatMessageModel
  ) {
    const decoder = new TextDecoder();
    let contentBuilder = "";
    let updateCounter = 0;
    const UPDATE_FREQUENCY = 5; // Update UI every 5 chunks

    const processChunk = (text: string) => {
      const jsonResponse = JSON.parse(text) as AzureChatCompletion;
      
      if (jsonResponse.choices?.[0]?.messages?.[0]?.content) {
        contentBuilder += jsonResponse.choices[0].messages[0].content;
        updateCounter++;
        
        // Batch UI updates for better performance
        if (updateCounter % UPDATE_FREQUENCY === 0) {
          this.messagesMap.set(assistantMessage.id, {
            ...assistantMessage,
            content: contentBuilder,
          });
        }
      }
    };

    const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type === "event" && event.data !== "[DONE]") {
        try {
          processChunk(event.data);
        } catch (error) {
          console.error("Error processing chunk:", error);
        }
      }
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        parser.feed(decoder.decode(value, { stream: true }));
      }

      // Final update with complete content
      this.messagesMap.set(assistantMessage.id, {
        ...assistantMessage,
        content: contentBuilder,
      });

      this.loading = "idle";
      this.autoScroll = true;

      // Handle text-to-speech if enabled
      if (textToSpeechStore.isEnabled) {
        textToSpeechStore.playAudioStream(contentBuilder);
      }

      // Update chat title for new chats
      if (this.messages.length === 2) {
        await this.updateChatTitle();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Remove incomplete message on abort
        this.removeMessage(assistantMessage.id);
        return;
      }
      throw error;
    }
  }

  private async updateChatTitle() {
    const chatThread = this.chatThread;
    if (chatThread?.name === NEW_CHAT_NAME) {
      const response = await UpdateChatTitle(this.chatThreadId, this.lastMessage);
      if (response.status === "OK") {
        this.chatThread = ref({ ...chatThread, name: response.response });
        await RevalidateCache({
          page: "chat",
          type: "layout",
        });
      }
    }
  }

  public stopGeneratingMessages() {
    abortController.abort();
    abortController = new AbortController();
    this.loading = "idle";
  }

  // Extension management methods remain the same but with optimizations
  public async addExtension(extensionId: string) {
    if (!this.chatThread) return;

    const previousExtensions = [...this.chatThread.extension];
    this.chatThread = ref({
      ...this.chatThread,
      extension: [...previousExtensions, extensionId],
    });

    const response = await AddExtensionToChatThread(
      this.chatThread.id,
      extensionId
    );

    if (response.status !== "OK") {
      // Rollback on failure
      this.chatThread = ref({
        ...this.chatThread,
        extension: previousExtensions,
      });
      showError("Failed to add extension");
    }
  }

  public async removeExtension(extensionId: string) {
    if (!this.chatThread) return;

    const previousExtensions = [...this.chatThread.extension];
    this.chatThread = ref({
      ...this.chatThread,
      extension: this.chatThread.extension.filter(e => e !== extensionId),
    });

    const response = await RemoveExtensionFromChatThread(
      this.chatThread.id,
      extensionId
    );

    if (response.status !== "OK") {
      // Rollback on failure
      this.chatThread = ref({
        ...this.chatThread,
        extension: previousExtensions,
      });
      showError("Failed to remove extension");
    }
  }

  public hasExtension(extensionId: string): boolean {
    return this.chatThread?.extension.includes(extensionId) ?? false;
  }
}

// Create optimized store instance
export const chatStore = proxy(new OptimizedChatState());

// Optimized hook with selective subscriptions
export const useChat = () => {
  // Use snapshot with specific properties to reduce re-renders
  const { loading, input, chatThreadId, autoScroll } = useSnapshot(chatStore, {
    sync: true,
  });
  
  // Get messages separately to optimize re-renders
  const messages = useSnapshot(chatStore.messages);
  
  return {
    messages,
    loading,
    input,
    chatThreadId,
    autoScroll,
  };
};

// Granular hooks for specific use cases
export const useChatMessages = () => {
  return useSnapshot(chatStore.messages);
};

export const useChatLoading = () => {
  const { loading } = useSnapshot(chatStore);
  return loading;
};

export const useChatInput = () => {
  const { input } = useSnapshot(chatStore);
  return input;
};

// Subscribe to specific changes for side effects
if (typeof window !== 'undefined') {
  subscribe(chatStore, () => {
    // Handle auto-scroll when messages change
    if (chatStore.autoScroll) {
      chatStore.autoScroll = false;
      // Trigger scroll event
      window.dispatchEvent(new CustomEvent('chat-auto-scroll'));
    }
  });
}