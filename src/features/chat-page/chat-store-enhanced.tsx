// ABOUTME: Enhanced chat store with performance optimizations and better state management
// ABOUTME: Uses optimized Valtio patterns for better performance with large message arrays and frequent updates

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
import { proxy, useSnapshot, ref } from "valtio";
import { subscribeKey } from "valtio/utils";
import { RevalidateCache } from "../common/navigation-helpers";
import { 
  OptimizedStoreBase, 
  OptimizedCollection,
  createDebouncedUpdater,
  createThrottledUpdater,
  OptimizedStoreState 
} from "../common/valtio-patterns/optimized-store-base";
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

type chatStatus = "idle" | "loading" | "file upload";

interface EnhancedChatState extends OptimizedStoreState {
  // Core chat data - using ref for large arrays to prevent deep proxying
  messages: ChatMessageModel[];
  
  // UI state
  loading: chatStatus;
  input: string;
  lastMessage: string;
  autoScroll: boolean;
  
  // User context
  userName: string;
  chatThreadId: string;
  
  // Internal state
  chatThread?: ChatThreadModel;
  
  // Performance metrics
  messageCount: number;
  streamingMessageId?: string;
  
  // Optimistic updates
  pendingMessages: ChatMessageModel[];
}

class EnhancedChatStore extends OptimizedStoreBase<EnhancedChatState> {
  private messageCollection: OptimizedCollection<ChatMessageModel>;
  private debouncedInputUpdate: (value: string) => void;
  private throttledMessageUpdate: (message: ChatMessageModel) => void;

  constructor() {
    const initialState: EnhancedChatState = {
      messages: ref([]), // Use ref to prevent deep proxying of large arrays
      loading: "idle",
      input: "",
      lastMessage: "",
      autoScroll: false,
      userName: "",
      chatThreadId: "",
      messageCount: 0,
      pendingMessages: ref([]),
      _lastUpdated: Date.now(),
      _isDirty: false
    };

    super(proxy(initialState), {
      maxAge: 10 * 60 * 1000, // 10 minutes
      autoCleanup: true,
      batchInterval: 16, // 60fps
      maxItems: 500 // Limit messages in memory
    });

    // Initialize optimized collection for messages
    this.messageCollection = new OptimizedCollection<ChatMessageModel>(500);
    
    // Create debounced input updater to reduce re-renders during typing
    this.debouncedInputUpdate = createDebouncedUpdater((value: string) => {
      this.updateProperty('input', value);
    }, 100); // 100ms debounce
    
    // Create throttled message updater for streaming
    this.throttledMessageUpdate = createThrottledUpdater((message: ChatMessageModel) => {
      this.updateStreamingMessage(message);
    }, 16); // 60fps throttle
  }

  // Optimized message management
  private addToMessages(message: ChatMessageModel): void {
    const finishOp = this.config.maxAge ? Date.now() : 0;
    
    try {
      const currentMessages = [...this.store.messages];
      const existingIndex = currentMessages.findIndex(el => el.id === message.id);
      
      if (existingIndex !== -1) {
        // Update existing message
        currentMessages[existingIndex] = { ...currentMessages[existingIndex], ...message };
      } else {
        // Add new message
        currentMessages.push(message);
        this.messageCollection.add(message);
      }
      
      // Batch update to prevent excessive re-renders
      this.batchUpdate('messages', () => {
        this.store.messages = ref(currentMessages);
        this.store.messageCount = currentMessages.length;
      });
      
    } finally {
      if (finishOp) {
        console.debug(`Message operation took ${Date.now() - finishOp}ms`);
      }
    }
  }

  private updateStreamingMessage(message: ChatMessageModel): void {
    if (this.store.streamingMessageId === message.id) {
      // Use throttled updates for streaming messages to maintain 60fps
      this.throttledMessageUpdate(message);
    } else {
      this.addToMessages(message);
    }
  }

  private removeMessage(id: string): void {
    const currentMessages = this.store.messages.filter(el => el.id !== id);
    this.batchUpdate('messages', () => {
      this.store.messages = ref(currentMessages);
      this.store.messageCount = currentMessages.length;
    });
    
    // Also remove from collection
    this.messageCollection.remove(msg => msg.id === id);
  }

  // Cleanup old messages to prevent memory leaks
  protected performCleanup(): void {
    super.performCleanup();
    
    const maxMessages = this.config.maxItems || 500;
    if (this.store.messages.length > maxMessages) {
      // Keep the most recent messages
      const keptMessages = this.store.messages.slice(-maxMessages);
      this.store.messages = ref(keptMessages);
      this.store.messageCount = keptMessages.length;
      
      console.debug(`Cleaned up ${this.store.messages.length - maxMessages} old messages`);
    }
  }

  // Public API methods with performance optimizations
  public updateLoading(value: chatStatus): void {
    this.updateProperty('loading', value);
  }

  public initChatSession({
    userName,
    messages,
    chatThread,
  }: {
    chatThread: ChatThreadModel;
    userName: string;
    messages: Array<ChatMessageModel>;
  }): void {
    this.batchUpdate('init_session', () => {
      this.store.chatThread = chatThread;
      this.store.chatThreadId = chatThread.id;
      this.store.messages = ref([...messages]); // Create new ref for messages
      this.store.userName = userName;
      this.store.messageCount = messages.length;
    });

    // Initialize collection with existing messages
    this.messageCollection.clear();
    this.messageCollection.addMany(messages);
  }

  public async AddExtensionToChatThread(extensionId: string): Promise<void> {
    this.updateLoading("loading");

    try {
      const response = await AddExtensionToChatThread({
        extensionId: extensionId,
        chatThreadId: this.store.chatThreadId,
      });
      
      RevalidateCache({
        page: "chat",
        type: "layout",
      });

      if (response.status !== "OK") {
        showError(response.errors[0].message);
      }
    } finally {
      this.updateLoading("idle");
    }
  }

  public async RemoveExtensionFromChatThread(extensionId: string): Promise<void> {
    this.updateLoading("loading");

    try {
      const response = await RemoveExtensionFromChatThread({
        extensionId: extensionId,
        chatThreadId: this.store.chatThreadId,
      });

      RevalidateCache({
        page: "chat",
      });

      if (response.status !== "OK") {
        showError(response.errors[0].message);
      }
    } finally {
      this.updateLoading("idle");
    }
  }

  public updateInput(value: string): void {
    // Use debounced update for input to reduce re-renders during typing
    this.debouncedInputUpdate(value);
  }

  public stopGeneratingMessages(): void {
    abortController.abort();
    this.store.streamingMessageId = undefined;
  }

  public updateAutoScroll(value: boolean): void {
    this.updateProperty('autoScroll', value);
  }

  private reset(): void {
    this.batchUpdate('reset', () => {
      this.store.input = "";
    });
    ResetInputRows();
    InputImageStore.Reset();
  }

  private async chat(formData: FormData): Promise<void> {
    this.updateAutoScroll(true);

    const multimodalImageRaw = formData.get("image-base64");
    const multimodalImage = typeof multimodalImageRaw === "string" ? multimodalImageRaw : "";

    const newUserMessage: ChatMessageModel = {
      id: uniqueId(),
      role: "user",
      content: this.store.input,
      name: this.store.userName,
      multiModalImage: multimodalImage,
      createdAt: new Date(),
      isDeleted: false,
      threadId: this.store.chatThreadId,
      type: "CHAT_MESSAGE",
      userId: "",
    };

    // Add message optimistically
    this.addToMessages(newUserMessage);
    this.reset();

    const controller = new AbortController();
    abortController = controller;

    try {
      if (this.store.chatThreadId === "" || this.store.chatThreadId === undefined) {
        showError("Chat thread ID is empty");
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const responseType = JSON.parse(event.data) as AzureChatCompletion;
          switch (responseType.type) {
            case "functionCall":
              const mappedFunction: ChatMessageModel = {
                id: uniqueId(),
                content: responseType.response.arguments,
                name: responseType.response.name,
                role: "function",
                createdAt: new Date(),
                isDeleted: false,
                threadId: this.store.chatThreadId,
                type: "CHAT_MESSAGE",
                userId: "",
                multiModalImage: "",
              };
              this.addToMessages(mappedFunction);
              break;
            case "functionCallResult":
              const mappedFunctionResult: ChatMessageModel = {
                id: uniqueId(),
                content: responseType.response,
                name: "tool",
                role: "tool",
                createdAt: new Date(),
                isDeleted: false,
                threadId: this.store.chatThreadId,
                type: "CHAT_MESSAGE",
                userId: "",
                multiModalImage: "",
              };
              this.addToMessages(mappedFunctionResult);
              break;
            case "content":
              const mappedContent: ChatMessageModel = {
                id: responseType.response.id,
                content: responseType.response.choices[0].message.content || "",
                name: AI_NAME,
                role: "assistant",
                createdAt: new Date(),
                isDeleted: false,
                threadId: this.store.chatThreadId,
                type: "CHAT_MESSAGE",
                userId: "",
                multiModalImage: "",
              };

              // Mark as streaming message for throttled updates
              this.store.streamingMessageId = mappedContent.id;
              this.throttledMessageUpdate(mappedContent);
              this.updateProperty('lastMessage', mappedContent.content);
              break;
            case "abort":
              this.removeMessage(newUserMessage.id);
              this.updateLoading("idle");
              break;
            case "error":
              showError(responseType.response);
              this.updateLoading("idle");
              break;
            case "finalContent":
              this.store.streamingMessageId = undefined;
              this.updateLoading("idle");
              this.completed(this.store.lastMessage);
              this.updateTitle();
              break;
            default:
              break;
          }
        }
      };

      if (response.body) {
        const parser = createParser(onParse);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          const chunkValue = decoder.decode(value);
          parser.feed(chunkValue);
        }
        this.updateLoading("idle");
      }
    } catch (error) {
      showError("" + error);
      this.updateLoading("idle");
      this.store.streamingMessageId = undefined;
    }
  }

  private async updateTitle(): Promise<void> {
    if (this.store.chatThread && this.store.chatThread.name === NEW_CHAT_NAME) {
      const firstMessage = this.store.messages[0];
      if (firstMessage) {
        await UpdateChatTitle(this.store.chatThreadId, firstMessage.content);
        RevalidateCache({
          page: "chat",
          type: "layout",
        });
      }
    }
  }

  private completed(message: string): void {
    textToSpeechStore.speak(message);
  }

  public async submitChat(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (this.store.input === "" || this.store.loading !== "idle") {
      return;
    }

    // Immediately set loading state to prevent race conditions
    this.updateLoading("loading");

    try {
      // get form data from e
      const formData = new FormData(e.currentTarget);

      const body = JSON.stringify({
        id: this.store.chatThreadId,
        message: this.store.input,
      });
      formData.append("content", body);

      await this.chat(formData);
    } catch (error) {
      // Reset loading state if chat fails
      this.updateLoading("idle");
      throw error;
    }
  }

  // Performance monitoring methods
  public getMessageStats(): { count: number; memoryUsage: number; oldestMessage?: Date } {
    const messages = this.store.messages;
    return {
      count: messages.length,
      memoryUsage: messages.length * 1024, // Rough estimate
      oldestMessage: messages.length > 0 ? messages[0].createdAt : undefined
    };
  }

  public clearOldMessages(olderThan: Date): number {
    const initialCount = this.store.messages.length;
    const filteredMessages = this.store.messages.filter(msg => msg.createdAt >= olderThan);
    
    this.batchUpdate('clear_old', () => {
      this.store.messages = ref(filteredMessages);
      this.store.messageCount = filteredMessages.length;
    });

    return initialCount - filteredMessages.length;
  }
}

// Create enhanced chat store instance
const enhancedChatStore = new EnhancedChatStore();

// Export the store proxy for direct access
export const chatStore = enhancedChatStore.store;

// Export enhanced hook with selective subscriptions
export const useChat = () => {
  return useSnapshot(chatStore, { sync: true });
};

// Selective hooks for better performance
export const useChatMessages = () => {
  return useSnapshot(chatStore, { sync: true }).messages;
};

export const useChatLoading = () => {
  return useSnapshot(chatStore, { sync: true }).loading;
};

export const useChatInput = () => {
  return useSnapshot(chatStore, { sync: true }).input;
};

// Enhanced store API
export const chatStoreAPI = {
  updateLoading: (value: chatStatus) => enhancedChatStore.updateLoading(value),
  updateInput: (value: string) => enhancedChatStore.updateInput(value),
  updateAutoScroll: (value: boolean) => enhancedChatStore.updateAutoScroll(value),
  stopGeneratingMessages: () => enhancedChatStore.stopGeneratingMessages(),
  initChatSession: (params: { chatThread: ChatThreadModel; userName: string; messages: Array<ChatMessageModel> }) => 
    enhancedChatStore.initChatSession(params),
  submitChat: (e: FormEvent<HTMLFormElement>) => enhancedChatStore.submitChat(e),
  AddExtensionToChatThread: (extensionId: string) => enhancedChatStore.AddExtensionToChatThread(extensionId),
  RemoveExtensionFromChatThread: (extensionId: string) => enhancedChatStore.RemoveExtensionFromChatThread(extensionId),
  getMessageStats: () => enhancedChatStore.getMessageStats(),
  clearOldMessages: (olderThan: Date) => enhancedChatStore.clearOldMessages(olderThan),
  getPerformanceMetrics: () => enhancedChatStore.getPerformanceMetrics(),
  dispose: () => enhancedChatStore.dispose()
};

// Auto-cleanup old messages periodically (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const cleared = chatStoreAPI.clearOldMessages(fiveMinutesAgo);
    if (cleared > 0) {
      console.debug(`Auto-cleaned ${cleared} old messages`);
    }
  }, 5 * 60 * 1000);
}