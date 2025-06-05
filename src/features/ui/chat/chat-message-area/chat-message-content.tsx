import React, { ForwardRefRenderFunction } from "react";

interface ChatMessageContentAreaProps {
  children?: React.ReactNode;
}

const ChatMessageContentArea: ForwardRefRenderFunction<
  HTMLDivElement,
  ChatMessageContentAreaProps
> = (props, ref) => {
  return (
    <div
      ref={ref}
      className="container max-w-3xl  relative min-h-screen pb-[240px] pt-16  flex flex-col gap-16"
    >
      {props.children}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(React.forwardRef(ChatMessageContentArea));
