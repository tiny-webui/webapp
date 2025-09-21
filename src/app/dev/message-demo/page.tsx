"use client";

import React, { useCallback, useMemo, useState } from "react";
import type * as ServerTypes from "@/sdk/types/IServer";
import { Message } from "@/app/chat/message";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Message component demo page.
 * Lets you compose a single `ServerTypes.Message` and preview its rendering in isolation.
 * Image URL field is left empty by default – you can supply any valid URL to test the image branch.
 */
export default function MessageDemoPage() {
  const [role, setRole] = useState<ServerTypes.Message["role"]>("user");
  const [text, setText] = useState("你好，这是一条测试消息\n支持多行显示。");
  const [imageUrl, setImageUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [messageVersion, setMessageVersion] = useState(0); // force re-key if needed

  const message: ServerTypes.Message = useMemo(() => {
    const content: ServerTypes.Message["content"] = [];
    if (text.trim().length > 0) {
      content.push({ type: "text", data: text });
    }
    if (showImage && imageUrl.trim()) {
      content.push({ type: "image_url", data: imageUrl.trim() });
    }
    return { role, content };
  }, [role, text, showImage, imageUrl]);

  const reset = useCallback(() => {
    setRole("user");
    setText("");
    setImageUrl("");
    setShowImage(false);
    setMessageVersion(v => v + 1);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left: live preview */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border p-3 text-sm font-medium">Message 组件演示</div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[642px] mx-auto space-y-4">
            {message.content.length === 0 ? (
              <div className="text-xs text-muted-foreground">当前消息为空。输入文本或启用图片。</div>
            ) : (
              <Message key={messageVersion} id={`demo-${messageVersion}`} message={message} />
            )}
          </div>
        </div>
      </div>
      {/* Right: controls */}
      <aside className="w-80 border-l border-border p-4 text-sm space-y-4 bg-white/60 backdrop-blur">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">角色 (role)</label>
          <Select value={role} onValueChange={(v) => setRole(v as ServerTypes.Message["role"]) }>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">user</SelectItem>
              <SelectItem value="assistant">assistant</SelectItem>
              <SelectItem value="developer">developer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">文本内容 (text)</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="输入文本..."
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-muted-foreground">图片选项 (image_url)</label>
            <label className="text-xs flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showImage}
                onChange={e => setShowImage(e.target.checked)}
                className="accent-ring"
              /> 显示
            </label>
          </div>
          <input
            type="text"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="粘贴图片 URL (留空使用纯文本)"
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            disabled={!showImage}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={reset}>重置</Button>
          <Button size="sm" variant="outline" onClick={() => setMessageVersion(v => v + 1)}>刷新 key</Button>
        </div>
        <div className="text-[11px] text-muted-foreground leading-snug pt-2">
          role 为 developer 的消息在实际聊天渲染中通常会被过滤；此处仍可预览。<br />
          图片功能：需要提供可访问的 URL（留空或禁用则不显示）。
        </div>
      </aside>
    </div>
  );
}
