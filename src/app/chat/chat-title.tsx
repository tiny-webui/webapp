"use client";

import React from "react";
import { MoreHorizontal, Pin } from "lucide-react";

export interface ChatTitleProps {
  id?: string;
  active: boolean;
  title: string;
  pinned?: boolean;
  onChatSelected: (id: string | undefined) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMenuClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ChatTitle = React.forwardRef<HTMLDivElement, ChatTitleProps>(
  function ChatTitleInner({ id, active, title, pinned, onChatSelected, onContextMenu, onMenuClick }, ref) {
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
        className={`flex min-w-0 items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
          active
            ? "bg-primary text-primary-foreground"
            : "hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {pinned && <Pin className="mr-2 size-3.5 shrink-0" aria-label="Pinned chat" />}
        <span className="flex-1 truncate">{title}</span>
        {onMenuClick && (
          <button
            type="button"
            aria-label="Chat actions"
            title="Chat actions"
            className="ml-1 flex size-6 shrink-0 items-center justify-center rounded hover:bg-foreground/10"
            onClick={event => {
              event.stopPropagation();
              onMenuClick(event);
            }}
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      </div>
    );
  }
);

ChatTitle.displayName = "ChatTitle";
