// ABOUTME: Virtualized chat message list for performance optimization with large conversations
// ABOUTME: Renders only visible messages to reduce DOM nodes and improve scrolling performance

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessageArea } from './chat-message-area';
import MessageContent from '@/features/chat-page/message-content';
import { ChatMessageModel } from '@/features/chat-page/chat-services/models';

interface VirtualizedChatMessagesProps {
  messages: ChatMessageModel[];
  profilePicture?: string | null;
  onCopy: (content: string) => void;
  itemHeight?: number;
  overscan?: number;
}

export const VirtualizedChatMessages: React.FC<VirtualizedChatMessagesProps> = React.memo(({
  messages,
  profilePicture,
  onCopy,
  itemHeight = 150, // Estimated average height of a message
  overscan = 3, // Number of items to render outside viewport
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Calculate total height for scrollbar
  const totalHeight = messages.length * itemHeight;
  
  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(messages.length, start + visibleCount + overscan * 2);
    
    setVisibleRange({ start, end });
  }, [scrollTop, containerHeight, itemHeight, overscan, messages.length]);
  
  // Handle scroll events
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);
  
  // Update container height on resize
  useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
    
    return () => window.removeEventListener('resize', updateContainerHeight);
  }, []);
  
  // Recalculate visible range when dependencies change
  useEffect(() => {
    calculateVisibleRange();
  }, [calculateVisibleRange]);
  
  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current?.parentElement;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  // Slice messages to only render visible ones
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * itemHeight;
  
  return (
    <div 
      ref={containerRef}
      style={{ height: totalHeight, position: 'relative' }}
    >
      <div 
        style={{ 
          transform: `translateY(${offsetY}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        {visibleMessages.map((message, index) => {
          const actualIndex = visibleRange.start + index;
          const actualMessage = messages[actualIndex];
          
          return (
            <div key={actualMessage.id} style={{ minHeight: itemHeight }}>
              <ChatMessageArea
                profileName={actualMessage.name}
                role={actualMessage.role}
                onCopy={() => onCopy(actualMessage.content)}
                profilePicture={
                  actualMessage.role === "assistant"
                    ? "/ai-icon.png"
                    : profilePicture
                }
              >
                <MessageContent message={actualMessage} />
              </ChatMessageArea>
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualizedChatMessages.displayName = 'VirtualizedChatMessages';