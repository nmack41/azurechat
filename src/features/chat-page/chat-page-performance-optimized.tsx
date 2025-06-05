// ABOUTME: Performance-optimized chat page with advanced caching and lazy loading
// ABOUTME: Uses optimized services, virtualization, and smart prefetching for better UX

"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSnapshot } from "valtio";
import { ChatMessageArea } from "@/ui/chat/chat-message-area/chat-message-area";
import { ChatInputArea } from "@/ui/chat/chat-input-area/chat-input-area";
import { ChatHeader } from "./chat-header/chat-header";
import { useVirtualList, useDebounce, useIntersectionObserver } from "@/utils/performance-utils";
import { chatStore } from "./chat-store-optimized";
import { 
  chatIntegration, 
  preloadChatData,
  useChatIntegrationMetrics 
} from "./chat-services/chat-integration-optimized";
import { ChatMessageModel, ChatThreadModel } from "./chat-services/models";

interface OptimizedChatPageProps {
  chatThread: ChatThreadModel;
  messages: ChatMessageModel[];
  userName: string;
}

/**
 * Performance-optimized chat page component
 */
export function ChatPagePerformanceOptimized({ 
  chatThread, 
  messages: initialMessages, 
  userName 
}: OptimizedChatPageProps) {
  // State for pagination and loading
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [allMessages, setAllMessages] = useState<ChatMessageModel[]>(initialMessages);
  const [virtualizationEnabled, setVirtualizationEnabled] = useState(false);
  
  // Refs for performance optimization
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(initialMessages.length);
  
  // Chat store state
  const { loading, input, autoScroll } = useSnapshot(chatStore);
  
  // Performance metrics
  const metrics = useChatIntegrationMetrics();
  
  // Intersection observer for infinite scroll
  const [loadMoreRef, loadMoreEntry] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "50px",
  });

  // Virtual list for large message sets (enabled when > 100 messages)
  const containerHeight = 600; // Adjust based on your design
  const messageHeight = 80; // Average message height
  
  const virtualList = useVirtualList(
    allMessages,
    containerHeight,
    {
      itemHeight: messageHeight,
      overscan: 5,
    }
  );

  // Debounced scroll handler to reduce unnecessary updates
  const [debouncedScrollHandler] = useDebounce((e: React.UIEvent) => {
    if (virtualizationEnabled) {
      virtualList.handleScroll(e);
    }
  }, 16); // ~60fps

  // Initialize chat session with optimizations
  useEffect(() => {
    chatStore.initChatSession({
      chatThread,
      messages: allMessages,
      userName,
    });

    // Enable virtualization for large message sets
    if (allMessages.length > 100) {
      setVirtualizationEnabled(true);
    }

    // Preload next batch of messages if available
    if (allMessages.length >= 20) {
      preloadNextBatch();
    }
  }, [chatThread.id]);

  // Monitor for new messages and update state
  useEffect(() => {
    const currentMessageCount = chatStore.messages.length;
    if (currentMessageCount > lastMessageCountRef.current) {
      // New messages were added, update our local state
      setAllMessages(chatStore.messages);
      lastMessageCountRef.current = currentMessageCount;
      
      // Enable virtualization if threshold reached
      if (currentMessageCount > 100 && !virtualizationEnabled) {
        setVirtualizationEnabled(true);
      }
    }
  }, [chatStore.messages.length, virtualizationEnabled]);

  // Load more messages when intersection observer triggers
  useEffect(() => {
    if (loadMoreEntry?.isIntersecting && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [loadMoreEntry?.isIntersecting, hasMoreMessages, isLoadingMore]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (autoScroll && messageContainerRef.current) {
      const container = messageContainerRef.current;
      container.scrollTop = container.scrollHeight;
      chatStore.autoScroll = false;
    }
  }, [autoScroll, allMessages.length]);

  // Preload next batch of messages
  const preloadNextBatch = useCallback(async () => {
    try {
      await chatIntegration.getPaginatedMessages(chatThread.id, {
        pageSize: 20,
        useCache: true,
      });
    } catch (error) {
      console.warn("Failed to preload messages:", error);
    }
  }, [chatThread.id]);

  // Load more messages for infinite scroll
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    try {
      const response = await chatIntegration.getPaginatedMessages(chatThread.id, {
        pageSize: 20,
        useCache: true,
      });

      if (response.status === "OK") {
        const newMessages = response.response.items;
        if (newMessages.length > 0) {
          // Prepend older messages to the beginning
          setAllMessages(prev => [...newMessages, ...prev]);
        }
        setHasMoreMessages(response.response.hasMore);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatThread.id, isLoadingMore, hasMoreMessages]);

  // Memoized message rendering for virtualization
  const renderMessage = useCallback((message: ChatMessageModel, index: number) => {
    return (
      <div
        key={message.id}
        style={{
          height: virtualizationEnabled ? messageHeight : 'auto',
          minHeight: virtualizationEnabled ? messageHeight : 'auto',
        }}
        className="message-item"
      >
        <ChatMessageArea message={message} />
      </div>
    );
  }, [virtualizationEnabled, messageHeight]);

  // Render virtual or regular messages
  const renderMessages = useMemo(() => {
    if (virtualizationEnabled) {
      const [startIndex, endIndex] = virtualList.visibleRange;
      const visibleMessages = allMessages.slice(startIndex, endIndex + 1);
      
      return (
        <div
          style={{
            height: virtualList.totalHeight,
            position: 'relative',
          }}
        >
          <div
            style={{
              transform: `translateY(${virtualList.startOffset}px)`,
            }}
          >
            {visibleMessages.map((message, index) => 
              renderMessage(message, startIndex + index)
            )}
          </div>
        </div>
      );
    }

    return allMessages.map((message, index) => renderMessage(message, index));
  }, [
    virtualizationEnabled,
    allMessages,
    virtualList.visibleRange,
    virtualList.totalHeight,
    virtualList.startOffset,
    renderMessage,
  ]);

  // Performance monitoring (development only)
  const showPerformanceMetrics = process.env.NODE_ENV === 'development';

  return (
    <div className="flex h-full flex-col">
      <ChatHeader />
      
      {/* Performance metrics (dev only) */}
      {showPerformanceMetrics && (
        <div className="bg-gray-100 p-2 text-xs">
          <span>Cache Hit Rate: {(metrics.summary.cacheHitRate * 100).toFixed(1)}%</span>
          <span className="ml-4">Avg Duration: {metrics.summary.averageDuration.toFixed(1)}ms</span>
          <span className="ml-4">Total Ops: {metrics.summary.totalOperations}</span>
          <span className="ml-4">Virtualized: {virtualizationEnabled ? 'Yes' : 'No'}</span>
        </div>
      )}

      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={virtualizationEnabled ? debouncedScrollHandler : undefined}
        style={{
          height: virtualizationEnabled ? containerHeight : 'auto',
        }}
      >
        {/* Load more trigger for infinite scroll */}
        {hasMoreMessages && (
          <div
            ref={loadMoreRef}
            className="h-10 flex items-center justify-center"
          >
            {isLoadingMore ? (
              <div className="text-sm text-gray-500">Loading more messages...</div>
            ) : (
              <div className="text-sm text-gray-400">Scroll up to load more</div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="px-4 pb-4">
          {renderMessages}
        </div>
      </div>

      <ChatInputArea />
    </div>
  );
}

// HOC for performance optimization
export function withChatPerformanceOptimization<T extends OptimizedChatPageProps>(
  Component: React.ComponentType<T>
) {
  return function PerformanceOptimizedWrapper(props: T) {
    const [isPreloaded, setIsPreloaded] = useState(false);
    
    useEffect(() => {
      // Preload chat data for the next likely navigation
      preloadChatData(props.chatThread.id).then(() => {
        setIsPreloaded(true);
      });
    }, [props.chatThread.id]);

    // Show loading state while preloading (optional)
    if (!isPreloaded && props.messages.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-gray-500">Loading chat...</div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Export the optimized chat page with HOC
export const ChatPageOptimized = withChatPerformanceOptimization(ChatPagePerformanceOptimized);