"use client";

import React from "react";

export interface ChatTitleProps {
  id?: string;
  active: boolean;
  title: string;
  onChatSelected: (id: string | undefined) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const ChatTitle = React.forwardRef<HTMLDivElement, ChatTitleProps>(
  function ChatTitleInner({ id, active, title, onChatSelected, onContextMenu }, ref) {
    return (
      <div
        ref={ref}
        onClick={() => onChatSelected(id)}
        onContextMenu={event => {
          if (onContextMenu) {
            event.preventDefault();
            onContextMenu(event);
          }
        }}
        className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
          active
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <span className="flex-1 truncate">{title}</span>
      </div>
    );
  }
);

ChatTitle.displayName = "ChatTitle";
