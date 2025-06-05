// ABOUTME: Optimized chat input component with debouncing and memoization
// ABOUTME: Reduces unnecessary updates and improves input responsiveness

"use client";

import React, { useRef, useCallback, useMemo, memo } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  ResetInputRows,
  onKeyDown,
  onKeyUp,
  useChatInputDynamicHeight,
} from "@/features/chat-page/chat-input/use-chat-input-dynamic-height";

import { AttachFile } from "@/features/ui/chat/chat-input-area/attach-file";
import {
  ChatInputActionArea,
  ChatInputForm,
  ChatInputPrimaryActionArea,
  ChatInputSecondaryActionArea,
} from "@/features/ui/chat/chat-input-area/chat-input-area";
import { ChatTextInput } from "@/features/ui/chat/chat-input-area/chat-text-input";
import { ImageInput } from "@/features/ui/chat/chat-input-area/image-input";
import { Microphone } from "@/features/ui/chat/chat-input-area/microphone";
import { StopChat } from "@/features/ui/chat/chat-input-area/stop-chat";
import { SubmitChat } from "@/features/ui/chat/chat-input-area/submit-chat";
import { chatStore, useChat } from "../chat-store";
import { fileStore, useFileStore } from "./file/file-store";
import { PromptSlider } from "./prompt/prompt-slider";
import {
  speechToTextStore,
  useSpeechToText,
} from "./speech/use-speech-to-text";
import {
  textToSpeechStore,
  useTextToSpeech,
} from "./speech/use-text-to-speech";

/**
 * Memoized secondary action area to prevent re-renders
 */
const MemoizedSecondaryActions = memo<{
  chatThreadId: string;
}>(({ chatThreadId }) => {
  const handleFileChange = useCallback((formData: FormData) => {
    fileStore.onFileChange({ formData, chatThreadId });
  }, [chatThreadId]);

  return (
    <ChatInputSecondaryActionArea>
      <AttachFile onClick={handleFileChange} />
      <PromptSlider />
    </ChatInputSecondaryActionArea>
  );
});

MemoizedSecondaryActions.displayName = 'MemoizedSecondaryActions';

/**
 * Memoized primary action area to reduce re-renders
 */
const MemoizedPrimaryActions = memo<{
  loading: string;
  isPlaying: boolean;
  isMicrophoneReady: boolean;
  submitButtonRef: React.RefObject<HTMLButtonElement>;
}>(({ loading, isPlaying, isMicrophoneReady, submitButtonRef }) => {
  const startRecognition = useCallback(() => {
    speechToTextStore.startRecognition();
  }, []);

  const stopRecognition = useCallback(() => {
    speechToTextStore.stopRecognition();
  }, []);

  const stopPlaying = useCallback(() => {
    textToSpeechStore.stopPlaying();
  }, []);

  const stopGenerating = useCallback(() => {
    chatStore.stopGeneratingMessages();
  }, []);

  return (
    <ChatInputPrimaryActionArea>
      <ImageInput />
      <Microphone
        startRecognition={startRecognition}
        stopRecognition={stopRecognition}
        isPlaying={isPlaying}
        stopPlaying={stopPlaying}
        isMicrophoneReady={isMicrophoneReady}
      />
      {loading === "loading" ? (
        <StopChat stop={stopGenerating} />
      ) : (
        <SubmitChat ref={submitButtonRef} />
      )}
    </ChatInputPrimaryActionArea>
  );
});

MemoizedPrimaryActions.displayName = 'MemoizedPrimaryActions';

/**
 * Optimized chat input component
 */
export const ChatInputOptimized = () => {
  const { loading, input, chatThreadId } = useChat();
  const { uploadButtonLabel } = useFileStore();
  const { isPlaying } = useTextToSpeech();
  const { isMicrophoneReady } = useSpeechToText();
  const { rows } = useChatInputDynamicHeight();

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Stable submit handler
  const submit = useCallback(() => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  }, []);

  // Stable form submit handler
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    chatStore.submitChat(e);
  }, []);

  // Debounced input update to reduce store updates
  const debouncedUpdateInput = useDebouncedCallback(
    (value: string) => {
      chatStore.updateInput(value);
    },
    100, // 100ms debounce
    { maxWait: 500 } // Maximum 500ms wait
  );

  // Local state for immediate UI feedback
  const [localInput, setLocalInput] = React.useState(input);

  // Sync local state with store state
  React.useEffect(() => {
    setLocalInput(input);
  }, [input]);

  // Handle input change with local state and debounced store update
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.currentTarget.value;
    setLocalInput(value); // Immediate UI update
    debouncedUpdateInput(value); // Debounced store update
  }, [debouncedUpdateInput]);

  // Stable blur handler
  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.currentTarget.value.replace(/\s/g, "").length === 0) {
      ResetInputRows();
    }
  }, []);

  // Stable keydown handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(e, submit);
  }, [submit]);

  // Stable keyup handler
  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyUp(e);
  }, []);

  return (
    <ChatInputForm
      ref={formRef}
      onSubmit={handleSubmit}
      status={uploadButtonLabel}
    >
      <ChatTextInput
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        value={localInput}
        rows={rows}
        onChange={handleInputChange}
      />
      <ChatInputActionArea>
        <MemoizedSecondaryActions chatThreadId={chatThreadId} />
        <MemoizedPrimaryActions
          loading={loading}
          isPlaying={isPlaying}
          isMicrophoneReady={isMicrophoneReady}
          submitButtonRef={submitButtonRef}
        />
      </ChatInputActionArea>
    </ChatInputForm>
  );
};

// Export as default for drop-in replacement
export default ChatInputOptimized;