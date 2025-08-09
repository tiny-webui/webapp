"use client";

import { useState } from "react";
import { Chat } from "./chat";
import { Side } from "./side";

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState("1");

  const handleConversationChange = (conversationId: string) => {
    setActiveConversationId(conversationId);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <Side 
        onConversationChange={handleConversationChange}
        activeConversationId={activeConversationId}
      />
      
      {/* 主对话区域 */}
      <Chat activeConversationId={activeConversationId} />
    </div>
  );
} 