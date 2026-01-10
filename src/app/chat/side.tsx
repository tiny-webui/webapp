"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Logo } from "@/components/custom/logo";
import * as ServerTypes from "@/sdk/types/IServer";
import { ChatTitle } from "./chat-title";
import { PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SideProps {
  /** Switch to a chat id. Pass undefined for the temporary new chat */
  onSwitchChat: (chatId: string | undefined) => void;
  /** Ask the outer page to attempt updating (loading more / refreshing) the chat list. Already deduplicated outside */
  requestChatListUpdateAsync: () => Promise<void>;
  /** Report the greatest chat index (0-based) currently visible in the list (not counting the temporary chat) */
  onChatDisplayRangeChange: (max: number) => void;
  chatList: ServerTypes.GetChatListResult;
  activeChatId: string | undefined;
  onHideSidebar: () => void;
}

/** Distance in px from bottom to trigger loading more */
const INFINITE_SCROLL_BOTTOM_THRESHOLD = 80;
/** Min ms between triggering list update requests due to scrolling */
const LOAD_MORE_RATE_LIMIT_MS = 3000;

export function Side({
  onSwitchChat,
  requestChatListUpdateAsync,
  onChatDisplayRangeChange,
  chatList,
  activeChatId,
  onHideSidebar,
}: SideProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastReportedMaxRef = useRef<number>(-1);
  /** Timestamp of the last load-more request */
  const lastLoadMoreRequestTimeRef = useRef<number>(0);
  /** Chat list length when the last load-more request was issued */
  const chatListLengthAtLastRequestRef = useRef<number>(0);
  const rAFRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const triggerUpdate = useCallback(async () => {
    if (isLoading) return; // avoid parallel loads
    setIsLoading(true);
    try {
      await requestChatListUpdateAsync();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, requestChatListUpdateAsync]);

  const onChatSelected = useCallback(
    (chatId: string | undefined) => {
      onSwitchChat(chatId);
    }, [onSwitchChat]);

  /** Determine last visible chat index (ignoring temp chat) and report changes */
  const updateVisibleRange = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const containerRectTop = container.getBoundingClientRect().top;
    const height = container.clientHeight;
    let lastVisible = -1;
    for (let i = 0; i < chatList.length; i++) {
      const el = chatItemRefs.current[i];
      if (!el) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      // Check if element top is within container viewport (partially visible is enough)
      if (rect.top - containerRectTop < height) {
        lastVisible = i;
      } else {
        break; // Since items are vertical & ordered, we can stop
      }
    }
    if (lastVisible !== lastReportedMaxRef.current) {
      lastReportedMaxRef.current = lastVisible;
      onChatDisplayRangeChange(lastVisible);
    }
  }, [chatList, onChatDisplayRangeChange]);

  /** Infinite scroll trigger (only when scrolling downward). Rate limit only applies if previous request produced no new items. */
  const maybeLoadMore = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentTop = container.scrollTop;
    const wasScrollingDown = currentTop > lastScrollTopRef.current;
    lastScrollTopRef.current = currentTop;
    if (!wasScrollingDown) return; // Only trigger when user scrolls down
    const distanceToBottom = container.scrollHeight - (currentTop + container.clientHeight);
    if (distanceToBottom < INFINITE_SCROLL_BOTTOM_THRESHOLD) {
      const now = Date.now();
      const currentLen = chatList.length;
      const lastLenAtRequest = chatListLengthAtLastRequestRef.current;
      const lastTime = lastLoadMoreRequestTimeRef.current;
      const listChangedSinceLastRequest = currentLen !== lastLenAtRequest;
      const rateLimitExpired = now - lastTime > LOAD_MORE_RATE_LIMIT_MS;
      if (listChangedSinceLastRequest || rateLimitExpired) {
        lastLoadMoreRequestTimeRef.current = now;
        chatListLengthAtLastRequestRef.current = currentLen;
        triggerUpdate();
      }
    }
  }, [triggerUpdate, chatList.length]);

  /** Scroll handler (throttled via rAF) */
  const onScroll = useCallback(() => {
    if (rAFRef.current !== null) return; // already scheduled
    rAFRef.current = window.requestAnimationFrame(() => {
      rAFRef.current = null;
      updateVisibleRange();
      maybeLoadMore();
    });
  }, [updateVisibleRange, maybeLoadMore]);

  /** Recompute visible range after data changes */
  useEffect(() => {
    updateVisibleRange();
  }, [chatList, activeChatId, updateVisibleRange]);

  /** Cleanup rAF on unmount */
  useEffect(() => {
    return () => {
      if (rAFRef.current !== null) {
        cancelAnimationFrame(rAFRef.current);
      }
    };
  }, []);

  return (
    <div className="w-80 bg-sidebar border-r border-border flex flex-col space-y-1">
      {/* Logo and settings button */}
      <div className="px-4">
        <div className="flex items-center justify-between h-16">
          <Logo size="md" />
          <Button variant="ghost" size="icon" onClick={onHideSidebar}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat title list */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-2 pt-0">
          <div className="space-y-1">
            <ChatTitle
              key="temp-chat"
              id={undefined}
              active={activeChatId === undefined}
              title="开始新对话"
              onChatSelected={onChatSelected}
            />
            {chatList.map((chat, idx) => {
              const title: string = (typeof chat.metadata?.title === 'string') ? chat.metadata.title : '未命名对话';
              return <ChatTitle
                key={chat.id}
                id={chat.id}
                active={chat.id === activeChatId}
                title={title}
                ref={el => {
                  chatItemRefs.current[idx] = el;
                }}
                onChatSelected={onChatSelected}
              />
            })}
            {isLoading && (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground select-none">
                <span className="inline-block size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-label="loading" />
                <span>加载中…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}