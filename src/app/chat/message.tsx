"use client";

import React from "react";
import ImageBlock from "@/components/custom/image-block";
import MarkdownRenderer from "@/components/custom/markdown-renderer";
import * as ServerTypes from "@/sdk/types/IServer";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowLeft, ArrowRight } from "lucide-react";

interface MessageProps {
  message: ServerTypes.Message;
  showButtons?: boolean;
  editable?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onEdit?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function Message({
  message,
  showButtons,
  editable,
  hasPrevious,
  hasNext,
  onEdit,
  onPrevious,
  onNext,
}: MessageProps) {
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
        className={`rounded-lg px-4 py-2 z-0 ${
          isUser ? "bg-secondary max-w-[90%]" : "bg-background max-w-[100%]"
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
      {showButtons && (
        <div
          className={`absolute bottom-0 translate-y-full flex gap-0 z-10 ${isUser ? 'right-0' : 'left-0'}`}
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous message"
            disabled={!hasPrevious}
            onClick={() => hasPrevious && onPrevious && onPrevious()}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next message"
            disabled={!hasNext}
            onClick={() => hasNext && onNext && onNext()}
          >
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Edit message"
            disabled={!editable}
            onClick={() => editable && onEdit && onEdit()}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
