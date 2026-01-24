"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { UserInput } from "./user-input";
import { Message } from "./message";
import { RequestError } from "@/sdk/app/rpc";
import { ErrorCode } from "@/sdk/types/Rpc";

interface ChatProps {
  onCreateChat: (chatId: string, message: ServerTypes.Message) => void;
  onSetChatTitle: (chatId: string, title: string) => void;
  requestChatListUpdateAsync?: () => Promise<void>;
  activeChatId?: string;
  selectedModelId?: string;
  titleGenerationModelId?: string;
  initialUserMessage?: ServerTypes.Message;
  inputHeight: number;
  onInputHeightChange: (height: number) => void;
  initialScrollPosition?: number;
  onScrollPositionChange?: (scrollTop: number) => void;
}

export function Chat({ 
  onCreateChat,
  onSetChatTitle,
  requestChatListUpdateAsync,
  activeChatId,
  selectedModelId,
  titleGenerationModelId,
  initialUserMessage,
  inputHeight,
  onInputHeightChange,
  initialScrollPosition,
  onScrollPositionChange,
}: ChatProps) {

  const [generating, setGenerating] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [treeHistory, setTreeHistory] = useState<ServerTypes.TreeHistory>({ nodes: {} });
  const [tailNodeId, setTailNodeId] = useState<string | undefined>(undefined);
  const [pendingUserMessage, setPendingUserMessage] = useState<ServerTypes.Message | undefined>(undefined);
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<ServerTypes.Message | undefined>(undefined);
  const [editingBranch, setEditingBranch] = useState(false);
  const [previousTailNodeId, setPreviousTailNodeId] = useState<string | undefined>(undefined);
  const [messageToEdit, setMessageToEdit] = useState<ServerTypes.Message | undefined>(undefined);
  const [userDetachedFromBottom, setUserDetachedFromBottom] = useState(false);
  const [generationError, setGenerationError] = useState<unknown | undefined>(undefined);
  const initialUserMessageHandled = useRef(false);
  const initializationCalled = useRef(false);
  const generatingCounter = useRef(0);
  const initialGenerationScrollDone = useRef(false);
  const scrollRestored = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setUserDetachedFromBottom(distanceFromBottom > 20);
    onScrollPositionChange?.(container.scrollTop);
  }, [onScrollPositionChange]);

  useEffect(() => {
    if (!generating || !bottomRef.current) {
      return;
    }
    const isInitialAssistantMessage = pendingAssistantMessage?.content.length === 1 && pendingAssistantMessage.content[0].data === '';
    if (!initialGenerationScrollDone.current && pendingAssistantMessage) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      initialGenerationScrollDone.current = true;
      return;
    }
    if (userDetachedFromBottom) {
      return;
    }
    if (isInitialAssistantMessage || pendingAssistantMessage) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pendingAssistantMessage, generating, userDetachedFromBottom]);

  const generateChatTitleAsync = useCallback(async (chatId: string, message: ServerTypes.Message) => {
    const modelId = titleGenerationModelId ?? selectedModelId;
    if (modelId === undefined) {
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
      modelId: modelId,
      message: message
    })).trim();
    await TUIClientSingleton.get().setMetadataAsync({
      path: ['chat', chatId],
      entries: {
        title: title 
      }
    });
    onSetChatTitle(chatId, title);
  }, [onSetChatTitle, selectedModelId, titleGenerationModelId]);

  const onUserMessage = useCallback(async (message: ServerTypes.Message) => {
    if (loadingChat || generating) {
      throw new Error("Cannot send message while loading or generating.");
    }
    if (message.role !== 'user') {
      throw new Error("Only user role messages are allowed to be sent from the input area.");
    }
    if (selectedModelId === undefined) {
      throw new Error("No model selected for chat.");
    }
    setEditingBranch(false);
    setPreviousTailNodeId(undefined);
    setMessageToEdit(undefined);
    setPendingUserMessage(message);
    const originalCounter = ++generatingCounter.current;
    let callMismatch = false;
    setGenerating(true);
    try {
      let chatId = activeChatId;
      if (chatId === undefined) {
        try {
          /** This may throw CONFLICT. If so, we need to request a chat list update and retry. */
          chatId = await TUIClientSingleton.get().newChatAsync();
        } catch (error) {
          if (!(error instanceof RequestError) || error.code !== ErrorCode.CONFLICT) {
            throw error;
          }
          await requestChatListUpdateAsync?.();
          chatId = await TUIClientSingleton.get().newChatAsync();
        }
        onCreateChat(chatId, message);
        return;
      }
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
      initialGenerationScrollDone.current = false;
      setPendingAssistantMessage(assistantMessage);
      /** 
       * This step should start even on mismatch to ensure a concise chat history
       * @todo: This may throw CONFLICT. If so, we need to update the local history and notify the user about this.
       */
      const generator = TUIClientSingleton.get().chatCompletionAsync({
        id: chatId,
        parent: tailNodeId,
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
              ...Object.fromEntries(Object.entries(prev.nodes).map(([i, n]) => {
                /** React calls this twice.. */
                if (n.id === tailNodeId && n.children.indexOf(userMessageNode.id) < 0) {
                  return [i, {
                    ...n,
                    children: [...n.children, userMessageNode.id]
                  }]
                } else {
                  return [i, n];
                }
              })),
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
    } catch (error) {
      if (!callMismatch) {
        setGenerationError(error)
      }
    } finally {
      if (!callMismatch) {
        setGenerating(false);
      }
    }
  }, [loadingChat, generating, selectedModelId, activeChatId, tailNodeId, onCreateChat, requestChatListUpdateAsync]);

  const cancelFailedGeneration = useCallback(() => {
    setGenerationError(undefined);
    setPendingUserMessage(undefined);
    setPendingAssistantMessage(undefined);
  }, []);

  const retryFailedGenerationAsync = useCallback(async () => {
    setGenerationError(undefined);
    const message = pendingUserMessage;
    if (message === undefined) {
      throw new Error("No pending user message to retry.");
    }
    await onUserMessage(message);
  }, [onUserMessage, pendingUserMessage]);

  useEffect(()=>{
    /** Avoid react's stupid load twice policy in debug mode which messes up the server. */
    if (initializationCalled.current) {
      return;
    }
    initializationCalled.current = true;
    (async () => {
      if (!activeChatId) {
        /** No chat */
        setTreeHistory({ nodes: {} });
        setTailNodeId(undefined);
        setLoadingChat(false);
        setEditingBranch(false);
        setPreviousTailNodeId(undefined);
        setMessageToEdit(undefined);
        return;
      }
      if (initialUserMessage && !initialUserMessageHandled.current) {
        /** New chat */
        initialUserMessageHandled.current = true;
        onUserMessage(initialUserMessage);
        /** generate chat title concurrently */
        generateChatTitleAsync(activeChatId, initialUserMessage);
        setInitialLoadComplete(true);
        return;
      }
      /** Existing chat */
      setLoadingChat(true);
      try {
        const loadedTreeHistory = await TUIClientSingleton.get().getChatAsync(activeChatId);
        setTreeHistory(loadedTreeHistory);
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
      } finally {
        setLoadingChat(false);
        setInitialLoadComplete(true);
      }
    })();
  /** Only load once */
  }, []);

  useEffect(() => {
    if (initialLoadComplete && !scrollRestored.current && initialScrollPosition !== undefined && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = initialScrollPosition;
      scrollRestored.current = true;
    }
  }, [initialLoadComplete, initialScrollPosition]);

  const getLinearHistory = useCallback(() : ServerTypes.MessageNode[] => {
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
  }, [tailNodeId, treeHistory]);

  const editUserMessage = useCallback((id: string) => {
    setEditingBranch(true);
    setPreviousTailNodeId(tailNodeId);
    setTailNodeId(treeHistory.nodes[id].parent);
    setMessageToEdit(treeHistory.nodes[id].message);
  }, [tailNodeId, treeHistory]);

  const cancelEditingUserMessage = useCallback(() => {
    setEditingBranch(false);
    setTailNodeId(previousTailNodeId);
    setPreviousTailNodeId(undefined);
    setMessageToEdit(undefined);
  }, [previousTailNodeId]);

  function formatGenerationError(error: unknown): string {
    if (error instanceof RequestError) {
      return `${error.message} (code ${error.code})`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return `${error}`;
  }

  function getNodeSiblings(tree: ServerTypes.TreeHistory, nodeId: string): ServerTypes.MessageNode[] {
    const parentId = tree.nodes[nodeId].parent;
    if (parentId === undefined) {
      /** Root node, find all root nodes in a stable order */
      return Object.values(tree.nodes).filter(n => n.parent === undefined).sort((a, b) => a.timestamp - b.timestamp);
    } else {
      return tree.nodes[parentId].children.map(childId => tree.nodes[childId]);
    }
  }

  function findLatestTailFromRoot(tree: ServerTypes.TreeHistory, rootId: string): ServerTypes.MessageNode {
    let currentNode = tree.nodes[rootId];
    while (currentNode.children.length > 0) {
      const latestChild = currentNode.children
        .map(childId => tree.nodes[childId])
        .reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
      currentNode = latestChild;
    }
    return currentNode;
  }

  const messageHasPreviousSiblings = useCallback((id: string) => {
    const siblings = getNodeSiblings(treeHistory, id);
    return siblings.findIndex(n => n.id === id) > 0;
  }, [treeHistory]);

  const messageHasNextSiblings = useCallback((id: string) => {
    const siblings = getNodeSiblings(treeHistory, id);
    const index = siblings.findIndex(n => n.id === id);
    return index >= 0 && index < siblings.length - 1;
  }, [treeHistory]);

  const gotoPreviousSibling = useCallback((id: string) => {
    const siblings = getNodeSiblings(treeHistory, id);
    const index = siblings.findIndex(n => n.id === id);
    if (index <= 0) {
      return;
    }
    const rootId = siblings[index - 1].id;
    setTailNodeId(findLatestTailFromRoot(treeHistory, rootId).id);
  }, [treeHistory, setTailNodeId]);

  const gotoNextSibling = useCallback((id: string) => {
    const siblings = getNodeSiblings(treeHistory, id);
    const index = siblings.findIndex(n => n.id === id);
    if (index < 0 || index >= siblings.length - 1) {
      return;
    }
    const rootId = siblings[index + 1].id;
    setTailNodeId(findLatestTailFromRoot(treeHistory, rootId).id);
  }, [treeHistory, setTailNodeId]);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      <div
        className="flex-1 overflow-y-auto p-4"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div className="max-w-[900px] mx-auto space-y-4">
          {getLinearHistory()
            .filter(n => n.message.role !== 'developer')
            .map(node => (
              <Message 
                key={node.id}
                message={node.message}
                showButtons={node.message.role === 'user'}
                editable={!loadingChat && !generating && !editingBranch && generationError === undefined}
                hasPrevious={messageHasPreviousSiblings(node.id) && !loadingChat && !generating && !editingBranch && generationError === undefined}
                hasNext={messageHasNextSiblings(node.id) && !loadingChat && !generating && !editingBranch && generationError === undefined}
                onEdit={() => {editUserMessage(node.id)}}
                onPrevious={() => {gotoPreviousSibling(node.id)}}
                onNext={() => {gotoNextSibling(node.id)}}
              />
            ))}
          {editingBranch && (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground/80">
              <span>正在编辑</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEditingUserMessage}
              >
                取消
              </Button>
            </div>
          )}
          {pendingUserMessage && (
            <Message key="pending-user-message" message={pendingUserMessage} />
          )}
          {pendingAssistantMessage && (
            <Message key="pending-assistant-message" message={pendingAssistantMessage} />
          )}
          {generating && (
            <div ref={bottomRef} className="flex min-h-[24px] items-end">
              <div className="ml-4 flex items-end gap-2" role="status" aria-label="Generating">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
          {(generationError !== undefined) && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm"
              role="alert"
              aria-label="Generation error"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-destructive">生成失败</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-foreground/80">
                    {formatGenerationError(generationError)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelFailedGeneration}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { void retryFailedGenerationAsync(); }}
                    disabled={pendingUserMessage === undefined}
                  >
                    重试
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      { /** User input area */ }
      <UserInput
        onUserMessage={onUserMessage}
        inputEnabled={!loadingChat && !generating && generationError === undefined}
        initialMessage={editingBranch ? messageToEdit : undefined}
        editorHeight={inputHeight}
        onEditorHeightChange={onInputHeightChange}
      />
    </div>
  );
}