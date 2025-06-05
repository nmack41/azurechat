// ABOUTME: Wrapper component that dynamically loads virtualized chat for large conversations
// ABOUTME: Improves performance by loading virtualization only when needed

"use client";

import dynamic from 'next/dynamic';
import { FC } from 'react';
import {
  ChatDocumentModel,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";
import { ExtensionModel } from "../extensions-page/extension-services/models";
import { ChatPage } from './chat-page';

// Dynamically import the virtualized version
const ChatPageVirtualized = dynamic(
  () => import('./chat-page-virtualized').then(mod => ({ default: mod.ChatPageVirtualized })),
  {
    loading: () => <ChatPage messages={[]} chatThread={{} as any} chatDocuments={[]} extensions={[]} />,
    ssr: false
  }
);

interface ChatPageWrapperProps {
  messages: Array<ChatMessageModel>;
  chatThread: ChatThreadModel;
  chatDocuments: Array<ChatDocumentModel>;
  extensions: Array<ExtensionModel>;
}

export const ChatPageWrapper: FC<ChatPageWrapperProps> = (props) => {
  // Use virtualization for conversations with more than 50 messages
  const useVirtualization = props.messages.length > 50;
  
  if (useVirtualization) {
    return <ChatPageVirtualized {...props} />;
  }
  
  return <ChatPage {...props} />;
};