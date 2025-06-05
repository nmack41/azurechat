// ABOUTME: Optimized chat page with virtualized message list for better performance
// ABOUTME: Handles large chat histories efficiently by rendering only visible messages

"use client";
import { ChatInput } from "@/features/chat-page/chat-input/chat-input";
import { chatStore, useChat } from "@/features/chat-page/chat-store";
import { ChatLoading } from "@/ui/chat/chat-message-area/chat-loading";
import ChatMessageContainer from "@/ui/chat/chat-message-area/chat-message-container";
import ChatMessageContentArea from "@/ui/chat/chat-message-area/chat-message-content";
import { VirtualizedChatMessages } from "@/ui/chat/chat-message-area/virtualized-chat-messages";
import { useChatScrollAnchor } from "@/ui/chat/chat-message-area/use-chat-scroll-anchor";
import { useSession } from "next-auth/react";
import { FC, useCallback, useEffect, useRef } from "react";
import { ExtensionModel } from "../extensions-page/extension-services/models";
import { ChatHeader } from "./chat-header/chat-header";
import {
  ChatDocumentModel,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";

interface ChatPageProps {
  messages: Array<ChatMessageModel>;
  chatThread: ChatThreadModel;
  chatDocuments: Array<ChatDocumentModel>;
  extensions: Array<ExtensionModel>;
}

export const ChatPageVirtualized: FC<ChatPageProps> = (props) => {
  const { data: session } = useSession();

  useEffect(() => {
    chatStore.initChatSession({
      chatThread: props.chatThread,
      messages: props.messages,
      userName: session?.user?.name!,
    });
  }, [props.messages, session?.user?.name, props.chatThread]);

  const { messages, loading } = useChat();
  const current = useRef<HTMLDivElement>(null);

  useChatScrollAnchor({ ref: current });

  // Memoized copy handler
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Check if we should use virtualization (more than 50 messages)
  const shouldVirtualize = messages.length > 50;

  return (
    <main className="flex flex-1 relative flex-col">
      <ChatHeader
        chatThread={props.chatThread}
        chatDocuments={props.chatDocuments}
        extensions={props.extensions}
      />
      <ChatMessageContainer ref={current}>
        <ChatMessageContentArea>
          {shouldVirtualize ? (
            <VirtualizedChatMessages
              messages={messages}
              profilePicture={session?.user?.image}
              onCopy={handleCopy}
            />
          ) : (
            // For smaller conversations, use regular rendering
            messages.map((message) => (
              <ChatMessageArea
                key={message.id}
                profileName={message.name}
                role={message.role}
                onCopy={() => handleCopy(message.content)}
                profilePicture={
                  message.role === "assistant"
                    ? "/ai-icon.png"
                    : session?.user?.image
                }
              >
                <MessageContent message={message} />
              </ChatMessageArea>
            ))
          )}
          {loading === "loading" && <ChatLoading />}
        </ChatMessageContentArea>
      </ChatMessageContainer>
      <ChatInput />
    </main>
  );
};

// Import ChatMessageArea to avoid import errors
import { ChatMessageArea } from "@/ui/chat/chat-message-area/chat-message-area";
import MessageContent from "./message-content";