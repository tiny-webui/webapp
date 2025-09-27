"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings,
  User,
} from "lucide-react";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { UserInput } from "./user-input";
import { Message } from "./message";

interface ChatProps {
  onCreateChat: (chatInfo: ServerTypes.GetChatListResult[0]) => void;
  requestChatListUpdateAsync: () => Promise<void>;
  activeChatId?: string;
}

export function Chat({ onCreateChat, requestChatListUpdateAsync, activeChatId}: ChatProps) {
  const [modelList, setModelList] = useState<ServerTypes.GetModelListResult>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [treeHistory, setTreeHistory] = useState<ServerTypes.TreeHistory>({ nodes: {} });
  const [tailNodeId, setTailNodeId] = useState<string | undefined>(undefined);
  const [pendingUserMessage, setPendingUserMessage] = useState<ServerTypes.Message | undefined>(undefined);
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<ServerTypes.Message | undefined>(undefined);
  const syncChatHistoryCounter = useRef(0);
  const generatingCounter = useRef(0);

  async function syncChatHistoryAsync() {
    if (generating) {
      /** 
       * Cannot read when its generating.
       * This can happen when the title is generated but the generation is still ongoing.
       */
      return;
    }
    const originalCounter = ++syncChatHistoryCounter.current;
    if (!activeChatId) {
      setTreeHistory({ nodes: {} });
      setTailNodeId(undefined);
      setLoadingChat(false);
      return;
    }
    setLoadingChat(true);
    let callMismatch = false;
    try {
      const loadedTreeHistory = await TUIClientSingleton.get().getChatAsync(activeChatId);
      if (originalCounter !== syncChatHistoryCounter.current) {
        callMismatch = true;
        return;
      }
      setTreeHistory(loadedTreeHistory);
      if ((tailNodeId === undefined || loadedTreeHistory.nodes[tailNodeId] === undefined)) {
        if (Object.keys(loadedTreeHistory.nodes).length === 0) {
          setTailNodeId(undefined);
        } else {
          /** Use the node with the latest timestamp as the tail */
          let latestNode = Object.values(loadedTreeHistory.nodes).reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
          /** 
           * Do a sanity check by go to one of the true ends where the "latest" node may lead to. 
           * Avoiding potential inconsistent timestamp. 
           */
          while (latestNode.children.length > 0) {
            latestNode = loadedTreeHistory.nodes[latestNode.children[0]];
          }
          setTailNodeId(latestNode.id);
        }
      }
    } finally {
      if (!callMismatch) {
        setLoadingChat(false);
      }
    }
  }

  async function syncModelListAsync() {
    const models = await TUIClientSingleton.get().getModelListAsync({
      metadataKeys: ['name']
    });
    setModelList(models);
    if (selectedModelId === undefined && models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  }

  useEffect(() => {
    /** @todo reduce model list update frequency. Maybe move the menu from the chat page to higher level. */
    syncModelListAsync();
    syncChatHistoryAsync();
  }, [activeChatId]);

  async function onUserMessage(message: ServerTypes.Message) {
    if (loadingChat || generating) {
      throw new Error("Cannot send message while loading or generating.");
    }
    if (message.role !== 'user') {
      throw new Error("Only user role messages are allowed to be sent from the input area.");
    }
    if (selectedModelId === undefined) {
      throw new Error("No model selected for chat.");
    }
    setPendingUserMessage(message);
    const originalCounter = ++generatingCounter.current;
    let callMismatch = false;
    setGenerating(true);
    try {
      const assistantMessage: ServerTypes.Message = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            data: ''
          }
        ]
      };
      const userMessageTimestamp = Date.now();
      setPendingAssistantMessage(assistantMessage);
      let chatId = activeChatId;
      let isNewChat = false;
      if (chatId === undefined) {
        isNewChat = true;
        /** @todo This may throw CONFLICT. If so, we need to request a chat list update and retry. */
        chatId = await TUIClientSingleton.get().newChatAsync();
        /** Do the chat title generation concurrently */
        generateChatTitleAndNotifyNewChatAsync(chatId, message);
      }
      /** 
       * This step should start even on mismatch to ensure a concise chat history
       * @todo: This may throw CONFLICT. If so, we need to update the local history and notify the user about this.
       */
      const generator = TUIClientSingleton.get().chatCompletionAsync({
        id: chatId,
        parent: isNewChat ? undefined : tailNodeId,
        modelId: selectedModelId,
        userMessage: message
      });
      while (true) {
        const result = await generator.next();
        if (originalCounter !== generatingCounter.current) {
          callMismatch = true;
          return;
        }
        if (result.done) {
          const userMessageNode: ServerTypes.MessageNode = {
            id: result.value.userMessageId,
            message: message,
            parent: tailNodeId,
            children: [result.value.assistantMessageId],
            timestamp: userMessageTimestamp,
          };
          const assistantMessageNode: ServerTypes.MessageNode = {
            id: result.value.assistantMessageId,
            message: assistantMessage,
            parent: userMessageNode.id,
            children: [],
            timestamp: Date.now(),
          };
          setTreeHistory(prev => ({
            nodes: {
              ...prev.nodes,
              [userMessageNode.id]: userMessageNode,
              [assistantMessageNode.id]: assistantMessageNode,
            }
          }));
          setTailNodeId(assistantMessageNode.id);
          setPendingUserMessage(undefined);
          setPendingAssistantMessage(undefined);
          break;
        } else {
          assistantMessage.content[0].data = assistantMessage.content[0].data + result.value;
          setPendingAssistantMessage({ ...assistantMessage });
        }
      }
    } finally {
      if (!callMismatch) {
        setGenerating(false);
      }
    }
  };

  async function generateChatTitleAndNotifyNewChatAsync(chatId: string, message: ServerTypes.Message) {
    if (selectedModelId === undefined) {
      throw new Error("No model selected for title generation.");
    }
    /** Avoid messing with the referenced message */
    message = JSON.parse(JSON.stringify(message)) as ServerTypes.Message;
    /** 
     * @todo Modify the server to take a multi message parameter for this.
     * So we can use a developer prompt instead.
     */
    message.content.unshift({
      type: 'text',
      data: 'Generate a concise chat title for the following user message. The title needs to start with a emoji representing the topic, followed by a short text. Only reply the title without any other information. Following is the user message:\n\n'
    });
    const title = (await TUIClientSingleton.get().executeGenerationTaskAsync({
      modelId: selectedModelId,
      message: message
    })).trim();
    await TUIClientSingleton.get().setMetadataAsync({
      path: ['chat', chatId],
      entries: {
        title: title 
      }
    });
    onCreateChat({
      id: chatId,
      metadata: {
        title: title
      }
    });
  }

  function getLinearHistory() : ServerTypes.MessageNode[] {
    const nodes: ServerTypes.MessageNode[] = [];
    let id = tailNodeId;
    while (id !== undefined) {
      const node = treeHistory.nodes[id];
      if (node === undefined) {
        throw new Error(`Inconsistent tree history state: node ${id} not found.`);
      }
      nodes.unshift(node);
      id = node.parent;
    }
    return nodes;
  }

  function getModelName(model: ServerTypes.GetModelListResult[number]): string {
    const modelName = model.metadata?.name;
    if (!(typeof modelName === 'string')) {
      return "未命名模型";
    }
    return modelName;
  }

  return (
    <div className="flex-1 flex flex-col bg-background">

      { /** Menu bar */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelList.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {getModelName(model)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">设为默认</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="size-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <User className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[900px] mx-auto space-y-4">
          { /** Chat history */}
          {getLinearHistory()
            .filter(n => n.message.role !== 'developer')
            .map(node => (
              <Message key={node.id} id={node.id} message={node.message} />
            ))}
          { /** Pending user message */ }
          {pendingUserMessage && (
            <Message key="pending-user-message" message={pendingUserMessage} />
          )}
          { /** Pending assistant message */ }
          {pendingAssistantMessage && (
            <Message key="pending-assistant-message" message={pendingAssistantMessage} />
          )}
        </div>
      </div>

      { /** User input area */ }
      <UserInput
        onUserMessage={onUserMessage}
        inputEnabled={!loadingChat && !generating}
      />
    </div>
  );
}