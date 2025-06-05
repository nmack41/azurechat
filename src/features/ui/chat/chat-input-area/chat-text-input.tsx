import React from "react";

// Memoized text input to prevent unnecessary re-renders
export const ChatTextInput = React.memo(React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> // Add ChatInputAreaProps to the type definition
>(({ ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className="p-4 w-full focus:outline-none bg-transparent resize-none "
      placeholder="Type your message here..."
      {...props}
    />
  );
}));
ChatTextInput.displayName = "ChatTextInput";
