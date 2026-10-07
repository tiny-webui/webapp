"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chat } from "./chat";
import { ChatMenuBar } from "./menu-bar";
import { Side } from "./side";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { RequestError } from "@/sdk/app/rpc";
import { ErrorCode } from "@/sdk/types/Rpc";
import * as settings from "@/lib/settings";
import { Logo } from "@/components/custom/logo";

const CHAT_LIST_MARGIN = 50;

type ChatLists = {
  chats: ServerTypes.GetChatListResult;
  pinned: ServerTypes.GetPinnedChatListResult;
};

export default function ChatPage() {
  const [activeChatId, setActiveChatId] = useState<string|undefined>(undefined);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string|undefined>(undefined);
  const [titleGenerationModelId, setTitleGenerationModelId] = useState<string|undefined>(undefined);
  const chatListsRef = useRef<ChatLists>({ chats: [], pinned: [] });
  const [chatLists, setChatLists] = useState(chatListsRef.current);
  const [initialized, setInitialized] = useState(false);
  const [newChatUserMessage, setNewChatUserMessage] = useState<ServerTypes.Message|undefined>(undefined);
  const [newChatAttachedFiles, setNewChatAttachedFiles] = useState<import('./file-context-bar').AttachedFile[]>([]);
  const [inputHeight, setInputHeight] = useState<number>(80);
  /** The index of the last chat displayed. -1 if none is displayed */
  const maxDisplayedChatIndex = useRef<number>(-1);
  const updateChatListPromise = useRef<Promise<void>|undefined>(undefined);
  const refreshChatListRequested = useRef(false);
  const scrollPositions = useRef<Record<string, number>>({});

  const updateChatLists = useCallback((updater: (current: ChatLists) => ChatLists) => {
    chatListsRef.current = updater(chatListsRef.current);
    setChatLists(chatListsRef.current);
  }, []);

  const onSwitchChat = useCallback((chatId: string | undefined) => {
    setActiveChatId(chatId);
    setNewChatUserMessage(undefined);
    setNewChatAttachedFiles([]);
  }, []);

  function onChatDisplayRangeChange(max: number) {
    maxDisplayedChatIndex.current = max;
  }

  const onCreateChat = useCallback((chatId: string, message: ServerTypes.Message, attachedFiles: import('./file-context-bar').AttachedFile[]) => {
    const chatInfo = {
      id: chatId
    };
    updateChatLists(current => ({ ...current, chats: [chatInfo, ...current.chats] }));
    refreshChatListRequested.current = true;
    setActiveChatId(chatId);
    setNewChatUserMessage(message);
    setNewChatAttachedFiles(attachedFiles);
  }, [updateChatLists]);

  const onDeleteChat = useCallback((chatId: string) => {
    updateChatLists(current => ({
      chats: current.chats.filter(chat => chat.id !== chatId),
      pinned: current.pinned.filter(chat => chat.id !== chatId),
    }));
    refreshChatListRequested.current = true;
    if (activeChatId === chatId) {
      setActiveChatId(undefined);
    }
  }, [activeChatId, updateChatLists]);

  const onSetChatTitle = useCallback((chatId: string, title: string) => {
    const updateTitle = (list: ServerTypes.GetChatListResult) => {
      return list.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            metadata: {
              ...chat.metadata,
              title: title,
            },
          };
        } else {
          return chat;
        }
      });
    };
    updateChatLists(current => ({
      chats: updateTitle(current.chats),
      pinned: updateTitle(current.pinned),
    }));
    refreshChatListRequested.current = true;
  }, [updateChatLists]);

  const onScrollPositionChange = useCallback((scrollTop: number) => {
    if (activeChatId) {
      scrollPositions.current[activeChatId] = scrollTop;
    }
  }, [activeChatId]);

  const updateChatListAsync = useCallback(async (fromStart?: boolean) => {
    /** Allow two trials in case of resource conflict */
    for (let trial = 0; trial < 2; trial++) {
      try {
        const client = TUIClientSingleton.get();
        const pinned = await client.getPinnedChatListAsync({ metaDataKeys: ["title"] });
        const pinnedIds = new Set(pinned.map(chat => chat.id));
        const chats = fromStart ? [] : [...chatListsRef.current.chats];
        let quantity = fromStart
          ? Math.max(chatListsRef.current.chats.length, maxDisplayedChatIndex.current + 1 + CHAT_LIST_MARGIN)
          : CHAT_LIST_MARGIN;
        while (true) {
          const segment = await client.getChatListAsync({
            start: chats.length,
            quantity,
            metaDataKeys: ["title"],
          });
          chats.push(...segment);
          if (segment.length < quantity || segment.some(chat => !pinnedIds.has(chat.id))) {
            break;
          }
          quantity = CHAT_LIST_MARGIN;
        }
        updateChatLists(() => ({ chats, pinned }));
        return;
      } catch (error) {
        if (trial === 0 && error instanceof RequestError && error.code === ErrorCode.CONFLICT) {
          /** Retry from the start */
          fromStart = true; 
        } else {
          throw error;
        }
      }
    }
  }, [updateChatLists]);

  const updateChatListDedupAsync = useCallback(async (fromStart = false) => {
    if (fromStart) {
      refreshChatListRequested.current = true;
    }
    if (updateChatListPromise.current !== undefined) {
      await updateChatListPromise.current;
      return;
    }
    updateChatListPromise.current = (async () => {
      do {
        const refresh = refreshChatListRequested.current;
        refreshChatListRequested.current = false;
        await updateChatListAsync(refresh);
      } while (refreshChatListRequested.current);
    })();
    try {
      await updateChatListPromise.current;
    } finally {
      updateChatListPromise.current = undefined;
    }
  }, [updateChatListAsync]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      await updateChatListDedupAsync();
      if (canceled) {
        return;
      }
      await settings.UserSettings.fetchAsync();
      if (canceled) {
        return;
      }
      await settings.GlobalSettings.fetchAsync();
      if (canceled) {
        return;
      }
      const models = await TUIClientSingleton.get().getModelListAsync({
        metadataKeys: ['name']
      });
      if (canceled) {
        return;
      }
      if (models.find(m => m.id === settings.UserSettings.defaultModelId) !== undefined) {
        setSelectedModelId(settings.UserSettings.defaultModelId);
      }
      if (models.find(m => m.id === settings.GlobalSettings.titleGenerationModelId) !== undefined) {
        setTitleGenerationModelId(settings.GlobalSettings.titleGenerationModelId);
      }
      setInitialized(true);
    })().catch(console.error);
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinnedChatIds = new Set(chatLists.pinned.map(chat => chat.id));
  const chatList = [...chatLists.pinned, ...chatLists.chats.filter(chat => !pinnedChatIds.has(chat.id))];

  if (!initialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <Logo className="text-primary" size="lg" />
          <div className="relative h-12 w-12">
            {/* Static track */}
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            {/* Spinning arc */}
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="sr-only">Loading</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {isSidebarVisible && (
        <Side 
          onSwitchChat={onSwitchChat}
          requestChatListUpdateAsync={updateChatListDedupAsync}
          onChatDisplayRangeChange={onChatDisplayRangeChange}
          onSetChatTitle={onSetChatTitle}
          onDeleteChat={onDeleteChat}
          chatList={chatList}
          pinnedChatIds={pinnedChatIds}
          activeChatId={activeChatId}
          onHideSidebar={() => setIsSidebarVisible(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <ChatMenuBar
          selectedModelId={selectedModelId}
          onSelectedModelIdChange={setSelectedModelId}
          isSidebarVisible={isSidebarVisible}
          onShowSidebar={() => setIsSidebarVisible(true)}
          onNewChat={() => onSwitchChat(undefined)}
        />
        <Chat
          key={activeChatId}
          onCreateChat={onCreateChat}
          onSetChatTitle={onSetChatTitle}
          requestChatListUpdateAsync={updateChatListDedupAsync}
          activeChatId={activeChatId}
          selectedModelId={selectedModelId}
          titleGenerationModelId={titleGenerationModelId}
          initialUserMessage={newChatUserMessage}
          inputHeight={inputHeight}
          onInputHeightChange={setInputHeight}
          initialScrollPosition={activeChatId ? scrollPositions.current[activeChatId] : undefined}
          onScrollPositionChange={onScrollPositionChange}
          initialAttachedFiles={newChatAttachedFiles}
        />
      </div>
    </div>
  );
}