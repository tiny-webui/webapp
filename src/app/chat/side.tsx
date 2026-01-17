"use client";

import { useEffect, useRef, useCallback, useState, MouseEvent, useLayoutEffect } from "react";
import { PanelLeftClose } from "lucide-react";
import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { RequestError } from "@/sdk/app/rpc";
import * as ServerTypes from "@/sdk/types/IServer";
import { ErrorCode } from "@/sdk/types/Rpc";
import { ChatTitle } from "./chat-title";

interface SideProps {
  /** Switch to a chat id. Pass undefined for the temporary new chat */
  onSwitchChat: (chatId: string | undefined) => void;
  /** Ask the outer page to attempt updating (loading more / refreshing) the chat list. Already deduplicated outside */
  requestChatListUpdateAsync: () => Promise<void>;
  /** Report the greatest chat index (0-based) currently visible in the list (not counting the temporary chat) */
  onChatDisplayRangeChange: (max: number) => void;
  onSetChatTitle: (chatId: string, title: string) => void;
  onDeleteChat: (chatId: string) => void;
  chatList: ServerTypes.GetChatListResult;
  activeChatId: string | undefined;
  onHideSidebar: () => void;
}

/** Distance in px from bottom to trigger loading more */
const INFINITE_SCROLL_BOTTOM_THRESHOLD = 80;
/** Min ms between triggering list update requests due to scrolling */
const LOAD_MORE_RATE_LIMIT_MS = 3000;

type ContextMenuState = {
  x: number;
  y: number;
  chatId: string;
  title: string;
} | null;

type DialogState = {
  open: boolean;
  chatId: string;
  title: string;
};

export function Side({
  onSwitchChat,
  requestChatListUpdateAsync,
  onChatDisplayRangeChange,
  onSetChatTitle,
  onDeleteChat,
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [renameDialog, setRenameDialog] = useState<DialogState>({ open: false, chatId: "", title: "" });
  const [deleteDialog, setDeleteDialog] = useState<DialogState>({ open: false, chatId: "", title: "" });
  const [renameInput, setRenameInput] = useState<string>("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

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

  const getChatTitle = useCallback((chat: ServerTypes.GetChatListResult[number]): string => {
    const title = chat.metadata?.title;
    return typeof title === "string" && title.trim().length > 0 ? title : "未命名对话";
  }, []);

  const onChatContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, chat: ServerTypes.GetChatListResult[number]) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      chatId: chat.id,
      title: getChatTitle(chat),
    });
  }, [getChatTitle]);

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

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openRenameDialog = useCallback((chatId: string, title: string) => {
    setRenameDialog({ open: true, chatId, title });
    setRenameInput(title);
    setActionError(undefined);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setRenameDialog({ open: false, chatId: "", title: "" });
    setRenameInput("");
    setActionError(undefined);
  }, []);

  const openDeleteDialog = useCallback((chatId: string, title: string) => {
    setDeleteDialog({ open: true, chatId, title });
    setActionError(undefined);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, chatId: "", title: "" });
    setActionError(undefined);
  }, []);

  /** Ensure the context menu stays within the viewport bounds */
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const padding = 8; // small offset to avoid sticking to the edges
    const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
    const maxY = Math.max(padding, window.innerHeight - rect.height - padding);
    const clampedX = Math.max(padding, Math.min(contextMenu.x, maxX));
    const clampedY = Math.max(padding, Math.min(contextMenu.y, maxY));

    if (clampedX !== contextMenu.x || clampedY !== contextMenu.y) {
      setContextMenu(prev => (prev ? { ...prev, x: clampedX, y: clampedY } : prev));
    }
  }, [contextMenu]);

  const confirmRenameAsync = useCallback(async () => {
    if (!renameDialog.chatId) {
      return;
    }
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setActionError("标题不能为空");
      return;
    }
    setRenameSubmitting(true);
    try {
      await TUIClientSingleton.get().setMetadataAsync({
        path: ["chat", renameDialog.chatId],
        entries: { title: trimmed },
      });
      onSetChatTitle(renameDialog.chatId, trimmed);
      closeRenameDialog();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : `${error}`);
    } finally {
      setRenameSubmitting(false);
    }
  }, [renameDialog.chatId, renameInput, onSetChatTitle, closeRenameDialog]);

  const confirmDeleteAsync = useCallback(async () => {
    if (!deleteDialog.chatId) {
      return;
    }
    setDeleteSubmitting(true);
    try {
      await TUIClientSingleton.get().deleteChatAsync(deleteDialog.chatId);
      onDeleteChat(deleteDialog.chatId);
      closeDeleteDialog();
    } catch (error) {
      if (error instanceof RequestError && error.code === ErrorCode.CONFLICT) {
        closeDeleteDialog();
        await requestChatListUpdateAsync();
        /** TODO: notify the user with global error banner. */
        return;
      }
      console.error(error);
      setActionError(error instanceof Error ? error.message : `${error}`);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteDialog.chatId, onDeleteChat, closeDeleteDialog, requestChatListUpdateAsync]);

  /** Cleanup rAF on unmount */
  useEffect(() => {
    return () => {
      if (rAFRef.current !== null) {
        cancelAnimationFrame(rAFRef.current);
      }
    };
  }, []);

  return (
    <>
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
                const title = getChatTitle(chat);
                return <ChatTitle
                  key={chat.id}
                  id={chat.id}
                  active={chat.id === activeChatId}
                  title={title}
                  ref={el => {
                    chatItemRefs.current[idx] = el;
                  }}
                  onChatSelected={onChatSelected}
                  onContextMenu={event => onChatContextMenu(event, chat)}
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

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
          onContextMenu={event => {
            event.preventDefault();
            closeContextMenu();
          }}
        >
          <div
            className="absolute min-w-[170px] overflow-hidden rounded-md border border-border bg-background text-sm shadow-lg"
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={event => event.stopPropagation()}
          >
            <button
              className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                closeContextMenu();
                openRenameDialog(contextMenu.chatId, contextMenu.title);
              }}
            >
              重命名
            </button>
            <button
              className="w-full px-3 py-2 text-left text-destructive hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                closeContextMenu();
                openDeleteDialog(contextMenu.chatId, contextMenu.title);
              }}
            >
              删除
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={renameDialog.open}
        onClose={closeRenameDialog}
        title="重命名对话"
      >
        <div className="space-y-4">
          <Input
            value={renameInput}
            onChange={event => setRenameInput(event.target.value)}
            placeholder="请输入新标题"
            autoFocus
          />
          {actionError && (
            <p className="text-xs text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeRenameDialog} disabled={renameSubmitting}>
              取消
            </Button>
            <Button onClick={confirmRenameAsync} disabled={renameSubmitting}>
              {renameSubmitting ? "保存中…" : "确认"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteDialog.open}
        onClose={closeDeleteDialog}
        title="删除对话"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            删除后将无法恢复：{deleteDialog.title}
          </p>
          {actionError && (
            <p className="text-xs text-destructive">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDeleteDialog} disabled={deleteSubmitting}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAsync} disabled={deleteSubmitting}>
              {deleteSubmitting ? "删除中…" : "确认删除"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}