"use client";

import React from "react";
import ImageBlock from "@/components/custom/image-block";
import * as ServerTypes from "@/sdk/types/IServer";

interface MessageProps {
  message: ServerTypes.Message;
  id?: string;
}

export function Message({ message }: MessageProps) {
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
    <>
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
          {/* Combined text block */}
            <p className="text-sm whitespace-pre-wrap break-words break-all">
              {combinedText}
            </p>
        </div>
      </div>
      {/* Individual image previews handled within ImageBlock via portal */}
    </>
  );
}
