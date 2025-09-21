"use client";

import { useEffect, useRef, useState } from "react";
import { Chat } from "./chat";
import { Side } from "./side";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { RequestError } from "@/sdk/app/rpc";
import { ErrorCode } from "@/sdk/types/Rpc";

const CHAT_LIST_MARGIN = 50;

export default function ChatPage() {
  const [activeChatId, setActiveChatId] = useState<string|undefined>(undefined);
  const [chatList, setChatList] = useState<ServerTypes.GetChatListResult>([]);
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
    console.log("updateChatListDedupAsync called");
    if (updateChatListPromise.current === undefined) {
      updateChatListPromise.current = updateChatListAsync();
    }
    await updateChatListPromise.current;
    updateChatListPromise.current = undefined;
  }

  useEffect(() => {
    updateChatListDedupAsync().catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Side 
        onSwitchChat={onSwitchChat}
        requestChatListUpdateAsync={updateChatListDedupAsync}
        onChatDisplayRangeChange={onChatDisplayRangeChange}
        chatList={chatList}
        activeChatId={activeChatId}
      />
      <Chat
        onCreateChat={onCreateChat}
        requestChatListUpdateAsync={updateChatListDedupAsync}
        activeChatId={activeChatId}
      />
    </div>
  );
}