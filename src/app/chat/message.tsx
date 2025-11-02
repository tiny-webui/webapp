"use client";

import React from "react";
import ImageBlock from "@/components/custom/image-block";
import MarkdownRenderer from "@/components/custom/markdown-renderer";
import * as ServerTypes from "@/sdk/types/IServer";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface MessageProps {
  message: ServerTypes.Message;
  editable?: boolean;
  onEdit?: () => void;
}

export function Message({ message, editable, onEdit }: MessageProps) {
  if (message.role === "developer") {
    throw new Error("Developer messages should not be rendered in the chat UI.");
  }
  const isUser = message.role === "user";
  // Separate image and text/refusal blocks.
  const imageBlocks = message.content.filter(part => part.type === "image_url");
  const textBlocks = message.content.filter(part => part.type === "text" || part.type === "refusal");

  // Concatenate text blocks with new lines.
  const combinedText = textBlocks.map(part => part.data).join("\n");

  // Image preview now handled by ImageBlock component.

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} relative`}>
      <div
        className={`max-w-[90%] rounded-lg px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {/* Thumbnails row(s) */}
        {imageBlocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageBlocks.map((img, idx) => (
              <ImageBlock
                key={idx}
                src={img.data}
                alt={`image ${idx + 1}`}
              />
            ))}
          </div>
        )}
        <MarkdownRenderer content={combinedText} />
      </div>
      {editable && (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Edit message"
          onClick={() => onEdit && onEdit()}
          className={`absolute bottom-0 translate-y-full ${isUser ? 'right-0' : 'left-0'}`}
        >
          <Pencil className="size-4" />
        </Button>
      )}
    </div>
  );
}
