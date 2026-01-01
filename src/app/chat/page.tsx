"use client";

import { useEffect, useRef, useState } from "react";
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

export default function ChatPage() {
  const [activeChatId, setActiveChatId] = useState<string|undefined>(undefined);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string|undefined>(undefined);
  const [titleGenerationModelId, setTitleGenerationModelId] = useState<string|undefined>(undefined);
  const [chatList, setChatList] = useState<ServerTypes.GetChatListResult>([]);
  const [initialized, setInitialized] = useState(false);
  /** The index of the last chat displayed. -1 if none is displayed */
  const maxDisplayedChatIndex = useRef<number>(-1);
  const updateChatListPromise = useRef<Promise<void>|undefined>(undefined);

  function onSwitchChat(chatId: string | undefined) {
    setActiveChatId(chatId);
  }

  function onChatDisplayRangeChange(max: number) {
    maxDisplayedChatIndex.current = max;
  }

  function onCreateChat(chatInfo: ServerTypes.GetChatListResult[0]) {
    setChatList([chatInfo, ...chatList]);
    if (activeChatId === undefined) {
      /** Focus on the newly created chat if we are not on another chat already. */
      setActiveChatId(chatInfo.id);
    }
  }

  async function updateChatListAsync(fromStart?: boolean) {
    /** Allow two trials in case of resource conflict */
    for (let trial = 0; trial < 2; trial++) {
      try {
        const oldList = JSON.parse(JSON.stringify(chatList)) as ServerTypes.GetChatListResult;
        const start = fromStart ? 0 : chatList.length;
        const segment = await TUIClientSingleton.get().getChatListAsync({
          start: start,
          quantity: fromStart ? maxDisplayedChatIndex.current + 1 + CHAT_LIST_MARGIN : CHAT_LIST_MARGIN,
          metaDataKeys: ["title"],
        });
        const newList = fromStart ? segment : [...oldList, ...segment];
        setChatList(newList);
        if (newList.find(c => c.id === activeChatId) === undefined) {
          /** The active chat was deleted */
          setActiveChatId(undefined);
        }
        return;
      } catch (error) {
        if (error instanceof RequestError && (error.code === ErrorCode.CONFLICT)) {
          /** Retry from the start */
          fromStart = true; 
        } else {
          throw error;
        }
      }
    }
  }

  async function updateChatListDedupAsync() {
    if (updateChatListPromise.current === undefined) {
      updateChatListPromise.current = updateChatListAsync();
    }
    await updateChatListPromise.current;
    updateChatListPromise.current = undefined;
  }

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
          chatList={chatList}
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
          onNewChat={() => setActiveChatId(undefined)}
        />
        <Chat
          key={activeChatId}
          onCreateChat={onCreateChat}
          activeChatId={activeChatId}
          selectedModelId={selectedModelId}
          titleGenerationModelId={titleGenerationModelId}
        />
      </div>
    </div>
  );
}