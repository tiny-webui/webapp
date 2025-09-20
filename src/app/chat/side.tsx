"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import * as ServerTypes from "@/sdk/types/IServer";

interface SideProps {
  /** Switch to a chat id. Pass undefined for the temporary new chat */
  onSwitchChat: (chatId: string | undefined) => void;
  /** Ask the outer page to attempt updating (loading more / refreshing) the chat list. Already deduplicated outside */
  requestChatListUpdateAsync: () => Promise<void>;
  /** Report the greatest chat index (0-based) currently visible in the list (not counting the temporary chat) */
  onChatDisplayRangeChange: (max: number) => void;
  chatList: ServerTypes.GetChatListResult;
  activeChatId: string | undefined;
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

  const getChatTitle = useCallback((chat: ServerTypes.GetChatListResult[number]): string => {
    const title = chat.metadata?.title;
    if (typeof title === "string") {
      return title;
    } else {
      return "未命名对话"; // Fallback
    }
  }, []);

  const handleNewChat = useCallback(() => {
    // Simply switch to undefined; rest of logic handled upstream.
    onSwitchChat(undefined);
  }, [onSwitchChat]);

  const handleClickChat = useCallback(
    (chatId: string) => {
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

  // Auto-scroll to keep the active chat or temp chat in view has been intentionally removed.
  // Rationale: The design now prefers preserving the user's current scroll position.

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
    <div className="w-80 bg-zinc-50 border-r border-border flex flex-col">
      {/* Logo and settings button */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Logo size="md" />
          <Button variant="ghost" size="sm">
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Chat title list */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-4 pt-0">
          <div className="space-y-1">
            <div
              key="temp-chat"
              className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                activeChatId === undefined
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => handleNewChat()}
            >
              <span className="flex-1 truncate">开始新对话</span>
            </div>
            {chatList.map((chat, idx) => (
              <div
                key={chat.id}
                ref={(el) => { chatItemRefs.current[idx] = el; }}
                onClick={() => handleClickChat(chat.id)}
                className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  chat.id === activeChatId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span className="flex-1 truncate">{getChatTitle(chat)}</span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground select-none">
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