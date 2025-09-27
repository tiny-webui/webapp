"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Side } from "@/app/chat/side";
import type * as ServerTypes from "@/sdk/types/IServer";

/**
 * Interactive demo harness for the chat Side component.
 * No real server is used – chat list data is mocked locally with pseudo pagination.
 *
 * Features:
 * - Infinite scroll: loads more mock chats when bottom is approached.
 * - Active chat switching & temp chat (undefined) state.
 * - Simulated latency for loading pages so the loading cadence feels realistic.
 * - Shows current visible max index & total count for debugging.
 */

/** Number of chats to return each page */
const PAGE_SIZE = 25;
/** Artificial network latency in ms (longer to visualize loading) */
const MOCK_LATENCY_MS = 1500;
/** Total mock chats we can ever produce (after which pagination stops) */
const MAX_MOCK_CHATS = 200;

type MockChat = ServerTypes.GetChatListResult[number];

export default function SideDemoPage() {
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);
  const [chatList, setChatList] = useState<ServerTypes.GetChatListResult>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const maxVisibleRef = useRef<number>(-1);
  const loadPromiseRef = useRef<Promise<void> | undefined>(undefined);

  // Pre-generate deterministic mock chats metadata on demand
  const generateChats = useCallback((startIndex: number, count: number): MockChat[] => {
    const chats: MockChat[] = [];
    for (let i = startIndex; i < startIndex + count; i++) {
      if (i >= MAX_MOCK_CHATS) break;
      chats.push({
        id: `mock-chat-${i}`,
        metadata: {
          title: `示例会话 #${i.toString().padStart(3, "0")}`,
          // Provide some extra noisy keys for realism
          createdAt: Date.now() - (MAX_MOCK_CHATS - i) * 1000 * 13,
        },
      });
    }
    return chats;
  }, []);

  const loadMoreAsync = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    const current = chatList.length;
    const remaining = MAX_MOCK_CHATS - current;
    const toGenerate = remaining <= 0 ? 0 : Math.min(PAGE_SIZE, remaining);
    // Always simulate latency even if no new items will be appended
    await new Promise(r => setTimeout(r, MOCK_LATENCY_MS));
    if (toGenerate > 0) {
      const newChats = generateChats(current, toGenerate);
      setChatList(prev => ([...prev, ...newChats] as ServerTypes.GetChatListResult));
    }
    if (current + toGenerate >= MAX_MOCK_CHATS) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [chatList.length, generateChats, isLoading]);

  // Deduplicated request method to match Side prop expectations
  const requestChatListUpdateAsync = useCallback(async () => {
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    loadPromiseRef.current = loadMoreAsync();
    try {
      await loadPromiseRef.current;
    } finally {
      loadPromiseRef.current = undefined;
    }
  }, [loadMoreAsync]);

  // Initial load
  useEffect(() => {
    if (chatList.length === 0) {
      requestChatListUpdateAsync();
    }
  }, [chatList.length, requestChatListUpdateAsync]);

  const onSwitchChat = useCallback((chatId: string | undefined) => {
    setActiveChatId(chatId);
  }, []);

  const onChatDisplayRangeChange = useCallback((max: number) => {
    maxVisibleRef.current = max;
  }, []);

  // Provide some debug info panel on the right to view state
  const shrinkList = useCallback(() => {
    if (chatList.length === 0) return;
    const removeCount = Math.min(chatList.length, Math.max(1, Math.floor(Math.random() * 30) + 1));
    setChatList(prev => {
      const newList = prev.slice(0, Math.max(0, prev.length - removeCount));
      // If active chat was removed, reset to undefined
      if (activeChatId && !newList.find(c => c.id === activeChatId)) {
        setActiveChatId(undefined);
      }
      // If we removed items, allow further loading again (if previously exhausted)
      if (newList.length < MAX_MOCK_CHATS) {
        setHasMore(true);
      }
      return newList as ServerTypes.GetChatListResult;
    });
  }, [chatList.length, activeChatId]);

  const debugPanel = useMemo(() => {
    return (
      <div className="w-80 p-4 border-l border-border text-sm space-y-2 bg-white/50 backdrop-blur">
        <div className="font-medium">调试信息</div>
        <div>当前激活: {activeChatId === undefined ? '（临时新对话）' : activeChatId}</div>
        <div>已加载会话数: {chatList.length}</div>
        <div>最后可见索引: {maxVisibleRef.current}</div>
        <div>是否还有更多: {hasMore ? '是' : '否'}</div>
        <div>是否加载中: {isLoading ? '是' : '否'}</div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={shrinkList}
            className="px-2 py-1 rounded-md border bg-white hover:bg-accent text-xs"
          >随机减少会话</button>
        </div>
        <div className="text-xs text-muted-foreground leading-snug">
          向下滚动左侧列表以触发加载。点击“开始新对话”切换到临时状态。使用“随机减少会话”测试列表缩短后的行为。
        </div>
      </div>
    );
  }, [activeChatId, chatList.length, hasMore, isLoading, shrinkList]);

  return (
    <div className="flex h-screen">
      <Side
        onSwitchChat={onSwitchChat}
        requestChatListUpdateAsync={requestChatListUpdateAsync}
        onChatDisplayRangeChange={onChatDisplayRangeChange}
        chatList={chatList}
        activeChatId={activeChatId}
      />
      {debugPanel}
    </div>
  );
}
