// ABOUTME: Optimized chat page component with memoization and performance improvements
// ABOUTME: Reduces re-renders and improves rendering performance for large chat histories

"use client";
import { memo, useCallback, useMemo, useRef, useEffect, FC } from "react";
import { useSession } from "next-auth/react";
import { ChatInput } from "@/features/chat-page/chat-input/chat-input";
import { chatStore, useChat } from "@/features/chat-page/chat-store";
import { ChatLoading } from "@/features/ui/chat/chat-message-area/chat-loading";
import { ChatMessageArea } from "@/features/ui/chat/chat-message-area/chat-message-area";
import ChatMessageContainer from "@/features/ui/chat/chat-message-area/chat-message-container";
import ChatMessageContentArea from "@/features/ui/chat/chat-message-area/chat-message-content";
import { useChatScrollAnchor } from "@/features/ui/chat/chat-message-area/use-chat-scroll-anchor";
import { ExtensionModel } from "../extensions-page/extension-services/models";
import { ChatHeader } from "./chat-header/chat-header";
import {
  ChatDocumentModel,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";
import MessageContent from "./message-content";

interface ChatPageProps {
  messages: Array<ChatMessageModel>;
  chatThread: ChatThreadModel;
  chatDocuments: Array<ChatDocumentModel>;
  extensions: Array<ExtensionModel>;
}

/**
 * Memoized chat message component to prevent unnecessary re-renders
 */
const MemoizedChatMessage = memo<{
  message: ChatMessageModel;
  profileName: string;
  profilePicture?: string;
  onCopy: (content: string) => void;
}>(({ message, profileName, profilePicture, onCopy }) => {
  const handleCopy = useCallback(() => {
    onCopy(message.content);
  }, [message.content, onCopy]);

  return (
    <ChatMessageArea
      profileName={profileName}
      role={message.role}
      onCopy={handleCopy}
      profilePicture={profilePicture}
    >
      <MessageContent message={message} />
    </ChatMessageArea>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.profileName === nextProps.profileName &&
    prevProps.profilePicture === nextProps.profilePicture
  );
});

MemoizedChatMessage.displayName = 'MemoizedChatMessage';

/**
 * Memoized chat header to prevent unnecessary re-renders
 */
const MemoizedChatHeader = memo(ChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatThread.id === nextProps.chatThread.id &&
    prevProps.chatThread.name === nextProps.chatThread.name &&
    prevProps.chatDocuments.length === nextProps.chatDocuments.length &&
    prevProps.extensions.length === nextProps.extensions.length
  );
});

MemoizedChatHeader.displayName = 'MemoizedChatHeader';

/**
 * Optimized chat page component
 */
export const ChatPageOptimized: FC<ChatPageProps> = (props) => {
  const { data: session } = useSession();
  const { messages, loading } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use stable reference for scroll anchor
  useChatScrollAnchor({ ref: scrollRef });

  // Memoize profile pictures to prevent object recreation
  const profilePictures = useMemo(() => ({
    assistant: "/ai-icon.png",
    user: session?.user?.image || "/user-icon.png",
  }), [session?.user?.image]);

  // Stable copy handler
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(err => {
      console.error('Failed to copy text:', err);
    });
  }, []);

  // Initialize chat session only when dependencies actually change
  useEffect(() => {
    if (!props.chatThread || !session?.user?.name) return;
    
    // Only initialize if the thread ID changes
    if (chatStore.chatThreadId !== props.chatThread.id) {
      chatStore.initChatSession({
        chatThread: props.chatThread,
        messages: props.messages,
        userName: session.user.name,
      });
    }
  }, [props.chatThread?.id, session?.user?.name, props.messages]);

  // Memoize message list to prevent recreation on every render
  const messageElements = useMemo(() => (
    messages.map((message) => (
      <MemoizedChatMessage
        key={message.id}
        message={message}
        profileName={message.name}
        profilePicture={
          message.role === "assistant" 
            ? profilePictures.assistant 
            : profilePictures.user
        }
        onCopy={handleCopy}
      />
    ))
  ), [messages, profilePictures, handleCopy]);

  return (
    <main className="flex flex-1 relative flex-col">
      <MemoizedChatHeader
        chatThread={props.chatThread}
        chatDocuments={props.chatDocuments}
        extensions={props.extensions}
      />
      <ChatMessageContainer ref={scrollRef}>
        <ChatMessageContentArea>
          {messageElements}
          {loading === "loading" && <ChatLoading />}
        </ChatMessageContentArea>
      </ChatMessageContainer>
      <ChatInput />
    </main>
  );
};

// Export as default for drop-in replacement
export default ChatPageOptimized;