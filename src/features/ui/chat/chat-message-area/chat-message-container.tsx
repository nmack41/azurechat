import React, { ForwardRefRenderFunction } from "react";
import { ScrollArea } from "../../scroll-area";

interface ChatMessageContainerProps {
  children?: React.ReactNode;
}

const ChatMessageContainer: ForwardRefRenderFunction<
  HTMLDivElement,
  ChatMessageContainerProps
> = (props, ref) => {
  return (
    <ScrollArea ref={ref} className="flex-1  h-full" type="always">
      {props.children}
    </ScrollArea>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(React.forwardRef(ChatMessageContainer));
