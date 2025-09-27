"use client";

import React, { useCallback, useState } from "react";
import { UserInput } from "@/app/chat/user-input";
import type * as ServerTypes from "@/sdk/types/IServer";
import { Button } from "@/components/ui/button";

/**
 * Interactive demo harness for the UserInput component.
 * Provides a lightweight mock chat area above the input so we can verify
 * multiline entry, Alt+Enter sending, disabled send state, and resizing.
 */
export default function UserInputDemoPage() {
  const [lastMessage, setLastMessage] = useState<ServerTypes.Message | null>(null);
  const [inputEnabled, setInputEnabled] = useState<boolean>(true);

  const onUserMessage = useCallback((message: ServerTypes.Message) => {
    setLastMessage(message);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-border p-3 flex items-center gap-4">
        <h1 className="text-sm font-medium">UserInput 简化演示</h1>
        <Button
          size="sm"
          variant={inputEnabled ? "secondary" : "default"}
          onClick={() => setInputEnabled(e => !e)}
        >
          {inputEnabled ? "禁用发送" : "启用发送"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLastMessage(null)}>清空</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {lastMessage ? (
          <div className="max-w-[900px] mx-auto">
            <div className="flex justify-end">
              <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm whitespace-pre-wrap">
                {lastMessage.content.map((p, i) => <span key={i}>{p.data}</span>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">暂无消息。输入内容并使用 Alt+Enter 发送。</div>
        )}
      </div>
      <UserInput onUserMessage={onUserMessage} inputEnabled={inputEnabled} />
    </div>
  );
}
