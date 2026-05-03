"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { UserInput } from "./user-input";
import { Message } from "./message";
import { AssistantTurn, type PendingTurnPart, type CommittedTurnPart } from "./assistant-turn";
import { FileContextBar, type AttachedFile, serializeContextFiles, parseContextFiles } from "./file-context-bar";
import { ListFilesTool, type ListFilesToolContext } from "@/tools/list-files";
import { QuickJSTool, type QuickJSToolContext } from "@/tools/quickjs";
import { RequestError } from "@/sdk/app/rpc";
import { ErrorCode } from "@/sdk/types/Rpc";

const listFilesTool = new ListFilesTool();
const quickJSTool = new QuickJSTool();

type ToolContext = ListFilesToolContext & QuickJSToolContext;

interface ChatProps {
  onCreateChat: (chatId: string, message: ServerTypes.Message, attachedFiles: AttachedFile[]) => void;
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
  initialAttachedFiles?: AttachedFile[];
  onAttachedFilesChange?: (files: AttachedFile[]) => void;
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
  initialAttachedFiles,
  onAttachedFilesChange,
}: ChatProps) {

  const [generating, setGenerating] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [treeHistory, setTreeHistory] = useState<ServerTypes.TreeHistory>({ nodes: {} });
  const [tailNodeId, setTailNodeId] = useState<string | undefined>(undefined);
  const [pendingUserMessage, setPendingUserMessage] = useState<ServerTypes.ChatMessage | undefined>(undefined);
  const [pendingTurnParts, setPendingTurnParts] = useState<PendingTurnPart[]>([]);
  const [editingBranch, setEditingBranch] = useState(false);
  const [previousTailNodeId, setPreviousTailNodeId] = useState<string | undefined>(undefined);
  const [messageToEdit, setMessageToEdit] = useState<ServerTypes.ChatMessage | undefined>(undefined);
  const [userDetachedFromBottom, setUserDetachedFromBottom] = useState(false);
  const [generationError, setGenerationError] = useState<unknown | undefined>(undefined);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(initialAttachedFiles ?? []);
  const initialUserMessageHandled = useRef(false);
  const initializationCalled = useRef(false);
  const generatingCounter = useRef(0);
  const initialGenerationScrollDone = useRef(false);
  const scrollRestored = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const handleAttachedFilesChange = useCallback((files: AttachedFile[]) => {
    setAttachedFiles(files);
    onAttachedFilesChange?.(files);
  }, [onAttachedFilesChange]);

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
    if (!initialGenerationScrollDone.current && pendingTurnParts.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      initialGenerationScrollDone.current = true;
      return;
    }
    if (userDetachedFromBottom) {
      return;
    }
    if (pendingTurnParts.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pendingTurnParts, generating, userDetachedFromBottom]);

  const generateChatTitleAsync = useCallback(async (chatId: string, message: ServerTypes.Message) => {
    const modelId = titleGenerationModelId ?? selectedModelId;
    if (modelId === undefined) {
      throw new Error("No model selected for title generation.");
    }
    if (!('role' in message) || message.role !== 'user') {
      throw new Error("Title generation can only be triggered by a user message.");
    }
    /** Avoid messing with the referenced message */
    message = JSON.parse(JSON.stringify(message)) as ServerTypes.ChatMessage;
    /** 
     * @todo Modify the server to take a multi message parameter for this.
     * So we can use a developer prompt instead.
     */
    const messages: Array<ServerTypes.ChatMessage> = [
      {
        role: 'developer',
        content: [{
          type: 'text',
          data: 'Generate a concise chat title for the following user message. The title needs to start with a emoji representing the topic, followed by a short text. Only reply the title without any other information. Following is the user message:\n\n'
        }]
      },
      message
    ];
    const response = (await TUIClientSingleton.get().executeGenerationTaskAsync({
      modelId: modelId,
      messages: messages
    })).messages[0];
    if (!('role' in response) || response.role !== 'assistant') {
      throw new Error("Unexpected response message from title generation.");
    }
    const title = response.content[0]?.data.trim();
    if (title === undefined) {
      throw new Error("No content in title generation response.");
    }
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
    if (!('role' in message) || message.role !== 'user') {
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
        onCreateChat(chatId, message, attachedFiles);
        /** Persist attached file IDs to the newly created chat */
        if (attachedFiles.length > 0) {
          TUIClientSingleton.get().setMetadataAsync({
            path: ['chat', chatId],
            entries: { contextFiles: serializeContextFiles(attachedFiles.filter(f => !f.deleted)) },
          });
        }
        return;
      }

      /** Resolve file context for tools */
      const activeFiles = attachedFiles.filter(f => !f.deleted);
      let toolContext: ToolContext | undefined;
      let tools: ServerTypes.Tool[] | undefined;
      if (activeFiles.length > 0) {
        const files: ToolContext["files"] = [];
        for (const af of activeFiles) {
          try {
            const meta = await TUIClientSingleton.get().getFileMetaAsync({ fileId: af.fileId });
            const { content } = await TUIClientSingleton.get().getFileContentAsync({ contentId: meta.contentId });
            const decoder = new TextDecoder("utf-8", { fatal: true });
            files.push({ name: af.name, content: decoder.decode(content) });
          } catch (err) {
            if (err instanceof RequestError && err.code === ErrorCode.NOT_FOUND) {
              /** File was deleted server-side; mark it */
              handleAttachedFilesChange(
                attachedFiles.map(f => f.fileId === af.fileId ? { ...f, deleted: true } : f)
              );
            } else {
              throw err;
            }
          }
        }
        if (files.length > 0) {
          toolContext = { files };
          tools = [
            { name: listFilesTool.name, description: listFilesTool.description, parameters: listFilesTool.paramSchema },
            { name: quickJSTool.name, description: quickJSTool.description, parameters: quickJSTool.paramSchema },
          ];
        }
      }

      initialGenerationScrollDone.current = false;

      /** 
       * Tool call loop: the generation may request tool calls, we execute them and continue.
       * The first round sends [userMessage], subsequent rounds send accumulated messages.
       */
      let pendingMessages: ServerTypes.Message[] = [message];
      let parentForNextCall = tailNodeId;
      setPendingTurnParts([]);

      while (true) {
        const pendingFunctionCalls: ServerTypes.FunctionCallMessage[] = [];

        const generator = TUIClientSingleton.get().chatCompletionAsync({
          id: chatId,
          parent: parentForNextCall,
          modelId: selectedModelId,
          messages: pendingMessages,
          tools,
        });

        while (true) {
          const result = await generator.next();
          if (originalCounter !== generatingCounter.current) {
            callMismatch = true;
            return;
          }
          if (result.done) {
            parentForNextCall = result.value.messageIds[result.value.messageIds.length - 1];
            break;
          } else {
            if (typeof result.value === "string") {
              const valueString = result.value;
              setPendingTurnParts(parts => {
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type !== 'text') {
                  return [...parts, { type: "text", content: valueString }];
                } else {
                  lastPart.content += result.value;
                  return [...parts];
                }
              });
            } else if (result.value.event === "function_call_end") {
              const fc = result.value.data;
              pendingFunctionCalls.push(fc);
              setPendingTurnParts(parts => [
                ...parts,
                {
                  type: "tool_call",
                  call: fc,
                  status: "calling",
                }
              ]);
            }
          }
        }

        if (originalCounter !== generatingCounter.current) {
          callMismatch = true;
          return;
        }

        if (pendingFunctionCalls.length === 0) {
          break;
        }

        /** Execute tool calls and build output messages */
        const toolOutputMessages: ServerTypes.FunctionCallOutputMessage[] = [];
        for (const functionCall of pendingFunctionCalls) {
          /** Update status to executing */
          setPendingTurnParts(parts => parts.map(part => {
            return part.type === 'tool_call' && part.call.call_id === functionCall.call_id ? {...part, status: "executing"} : part
          }));

          let resultText: string;
          try {
            if (functionCall.name === listFilesTool.name && toolContext) {
              resultText = await listFilesTool.callAsync(JSON.parse(functionCall.arguments), toolContext);
            } else if (functionCall.name === quickJSTool.name && toolContext) {
              resultText = await quickJSTool.callAsync(JSON.parse(functionCall.arguments), toolContext);
            } else {
              resultText = `[Error] Unknown tool: ${functionCall.name}`;
            }
          } catch (err) {
            resultText = `[Error] ${err instanceof Error ? err.message : String(err)}`;
          }

          setPendingTurnParts(parts => parts.map(part => {
            return part.type === 'tool_call' && part.call.call_id === functionCall.call_id ? {...part, status: "done", result: resultText} : part
          }));

          toolOutputMessages.push({
            type: "function_call_output",
            call_id: functionCall.call_id,
            output: [{ type: "text", data: resultText }],
          });
        }

        /** Prepare next round: the parent is the last message from this round */
        pendingMessages = toolOutputMessages;
      }

      /** All done — update tree history from cache and set tail */
      const finalHistory = await TUIClientSingleton.get().getChatAsync(chatId);
      setTreeHistory(finalHistory);
      setTailNodeId(parentForNextCall);
      setPendingUserMessage(undefined);
      setPendingTurnParts([]);
    } catch (error) {
      if (!callMismatch) {
        setGenerationError(error);
      }
    } finally {
      if (!callMismatch) {
        setGenerating(false);
      }
    }
  }, [loadingChat, generating, selectedModelId, activeChatId, tailNodeId, attachedFiles, onCreateChat, requestChatListUpdateAsync, handleAttachedFilesChange]);

  const cancelFailedGeneration = useCallback(() => {
    setGenerationError(undefined);
    setPendingUserMessage(undefined);
    setPendingTurnParts([]);
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
        /** Load attached files from chat metadata. We persist the file
         *  name alongside the id, so no per-file server lookup is needed —
         *  this also avoids spurious errors when a file has been deleted
         *  server-side. Deletion is detected lazily at message-send time. */
        try {
          const meta = await TUIClientSingleton.get().getMetadataAsync({
            path: ['chat', activeChatId],
            keys: ['contextFiles'],
          });
          const loadedFiles = parseContextFiles(meta.contextFiles);
          if (loadedFiles.length > 0) {
            setAttachedFiles(loadedFiles);
            onAttachedFilesChange?.(loadedFiles);
          }
        } catch {
          /* metadata may not exist yet */
        }
      } finally {
        setLoadingChat(false);
        setInitialLoadComplete(true);
      }
    })();
  /** Only load once */
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Group the linear history into renderable turns.
   * User messages render as Message. Everything between two user messages
   * (assistant text, function calls, function call outputs) is grouped into an AssistantTurn.
   */
  type RenderItem =
    | { kind: "user"; node: ServerTypes.MessageNode }
    | { kind: "assistant-turn"; parts: CommittedTurnPart[]; firstNodeId: string };

  const getRenderItems = useCallback((): RenderItem[] => {
    const linear = getLinearHistory();
    const items: RenderItem[] = [];
    let currentTurnParts: CommittedTurnPart[] = [];
    let turnFirstId: string | undefined;

    const flushTurn = () => {
      if (currentTurnParts.length > 0 && turnFirstId) {
        items.push({ kind: "assistant-turn", parts: currentTurnParts, firstNodeId: turnFirstId });
        currentTurnParts = [];
        turnFirstId = undefined;
      }
    };

    for (const node of linear) {
      const msg = node.message;
      if ("role" in msg) {
        if (msg.role === "developer") continue;
        if (msg.role === "user") {
          flushTurn();
          items.push({ kind: "user", node });
        } else {
          /** assistant */
          if (!turnFirstId) turnFirstId = node.id;
          const text = msg.content.filter(c => c.type === "text").map(c => c.data).join("\n");
          if (text) {
            currentTurnParts.push({ type: "text", content: text });
          }
        }
      } else if (msg.type === "function_call") {
        if (!turnFirstId) turnFirstId = node.id;
        currentTurnParts.push({
          type: "tool_call",
          call: msg,
        });
      } else if (msg.type === "function_call_output") {
        /** Attach result to the last tool_call part if possible */
        const lastTc = [...currentTurnParts].reverse().find(p => p.type === "tool_call");
        if (lastTc && lastTc.type === "tool_call" && lastTc.call.call_id === msg.call_id) {
          lastTc.result = msg.output.filter(o => o.type === "text").map(o => o.data).join("\n");
        }
      }
    }
    flushTurn();
    return items;
  }, [getLinearHistory]);

  const editUserMessage = useCallback((id: string) => {
    const node = treeHistory.nodes[id];
    if (node === undefined) {
      throw new Error(`Inconsistent tree history state: node ${id} not found.`);
    }
    if (!('role' in node.message) || node.message.role !== 'user') {
      throw new Error("Only user messages can be edited.");
    }
    setEditingBranch(true);
    setPreviousTailNodeId(tailNodeId);
    setTailNodeId(node.parent);
    setMessageToEdit(node.message);
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
          {getRenderItems().map(item => {
            if (item.kind === "user") {
              const node = item.node;
              return (
                <Message
                  key={node.id}
                  message={node.message as ServerTypes.ChatMessage}
                  showButtons
                  editable={!loadingChat && !generating && !editingBranch && generationError === undefined}
                  hasPrevious={messageHasPreviousSiblings(node.id) && !loadingChat && !generating && !editingBranch && generationError === undefined}
                  hasNext={messageHasNextSiblings(node.id) && !loadingChat && !generating && !editingBranch && generationError === undefined}
                  onEdit={() => editUserMessage(node.id)}
                  onPrevious={() => gotoPreviousSibling(node.id)}
                  onNext={() => gotoNextSibling(node.id)}
                />
              );
            } else {
              return (
                <AssistantTurn key={item.firstNodeId} parts={item.parts} />
              );
            }
          })}
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
          {pendingTurnParts.length > 0 && (
            <AssistantTurn key="pending-turn" parts={pendingTurnParts} />
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

      { /** File context bar */ }
      <FileContextBar
        chatId={activeChatId}
        attachedFiles={attachedFiles}
        onAttachedFilesChange={handleAttachedFilesChange}
        disabled={loadingChat || generating}
      />

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