"use client";

import React from "react";
import NextImage from "next/image";
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
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[90%] rounded-lg px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        <div>
          {message.content.map((contentPart, index) => {
            if (contentPart.type === "text" || contentPart.type === "refusal") {
              return (
                <p key={index} className="text-sm whitespace-pre-wrap break-words break-all">
                  {contentPart.data}
                </p>
              );
            } else if (contentPart.type === "image_url") {
              return (
                <NextImage
                  key={index}
                  src={contentPart.data}
                  alt="image"
                  width={300}
                  height={300}
                  className="max-w-full h-auto"
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
