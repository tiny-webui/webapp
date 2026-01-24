"use client";

import { Button } from "@/components/ui/button";
import ImageBlock from "@/components/custom/image-block";
import { Send } from "lucide-react";
import React from "react";
import * as ServerTypes from "@/sdk/types/IServer";
import { cn } from "@/lib/utils";

interface UserInputProps {
  onUserMessage: (message: ServerTypes.Message) => void;
  /** This controls the send button. Not the editor. */
  inputEnabled: boolean;
  initialMessage?: ServerTypes.Message;
  /** Optional controlled height for the editor. */
  editorHeight?: number;
  onEditorHeightChange?: (height: number) => void;
}

export function UserInput({ onUserMessage, inputEnabled, initialMessage, editorHeight: controlledHeight, onEditorHeightChange }: UserInputProps) {
  /** Text input */
  const [inputValue, setInputValue] = React.useState(
    initialMessage?.content
      .filter(c => c.type === 'text' || c.type === 'refusal')
      .map(c => c.data).join('\n') ?? ""
  );
  /** Image data urls */
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initialMessage?.content
      .filter(c => c.type === 'image_url')
      .map(c => c.data) ?? []
  );

  const MIN_HEIGHT = 80;
  const MAX_HEIGHT = 400;

  const [uncontrolledEditorHeight, setUncontrolledEditorHeight] = React.useState<number>(MIN_HEIGHT);
  const startYRef = React.useRef<number | null>(null);
  const startHeightRef = React.useRef<number>(0);
  const draggingRef = React.useRef(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const isControlled = controlledHeight !== undefined;
  const editorHeight = isControlled ? controlledHeight as number : uncontrolledEditorHeight;
  const setEditorHeight = React.useCallback((height: number) => {
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
    if (isControlled) {
      onEditorHeightChange?.(clamped);
    } else {
      setUncontrolledEditorHeight(clamped);
    }
  }, [isControlled, onEditorHeightChange]);

  const beginDrag = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    startHeightRef.current = editorHeight;
    draggingRef.current = true;
    // Prevent text selection while dragging.
    document.body.style.userSelect = "none";
  };

  React.useEffect(() => {
    if (!initialMessage) {
      return;
    }
    setInputValue(
      initialMessage.content
        .filter(c => c.type === 'text' || c.type === 'refusal')
        .map(c => c.data).join('\n') ?? ""
    );
    setImageUrls(
      initialMessage.content
        .filter(c => c.type === 'image_url')
        .map(c => c.data) ?? []
    );
  }, [initialMessage]);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || startYRef.current === null) {
        return;
      }
      const delta = startYRef.current - e.clientY; // dragging up increases height
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
      setEditorHeight(newHeight);
    };
    const onUp = () => {
      draggingRef.current = false;
      startYRef.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editorHeight, setEditorHeight]);

  React.useLayoutEffect(() => {
    const ta = textAreaRef.current;
    const scrollEl = scrollContainerRef.current;
    if (!ta || !scrollEl) return;

    const wasAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 8;
    const previousScrollTop = scrollEl.scrollTop;

    ta.style.height = "auto";

    const parentRect = scrollEl.getBoundingClientRect();
    const childRect = ta.getBoundingClientRect();
    const maxVisibleHeight = parentRect.height - (childRect.top - parentRect.top) - 8;
    const targetHeight = Math.max(ta.scrollHeight, maxVisibleHeight);

    ta.style.height = `${targetHeight}px`;

    // Restore scroll to where the user was, or keep the caret visible at the bottom.
    if (wasAtBottom) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    } else {
      scrollEl.scrollTop = previousScrollTop;
    }
  }, [editorHeight, inputValue, imageUrls]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (imageUrls.length === 0 && !trimmed) {
      return;
    }

    const content: ServerTypes.Message["content"] = [];
    if (imageUrls.length > 0) {
      for (const url of imageUrls) {
        content.push({ type: "image_url", data: url });
      }
    }
    if (trimmed) {
      content.push({ type: "text", data: trimmed });
    }

    onUserMessage({ role: "user", content });

    setImageUrls([]);
    setInputValue("");

    // Refocus for subsequent typing.
    requestAnimationFrame(() => textAreaRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.altKey) {
      e.preventDefault();
      if (inputEnabled) {
        handleSend();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!e.clipboardData) {
      return;
    }
    const items = e.clipboardData.items;
    const filePromises: Promise<string>[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        filePromises.push(new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }));
      }
    }
    if (filePromises.length > 0) {
      e.preventDefault(); // Prevent any text insertion from clipboard when images are present.
      Promise.all(filePromises)
        .then(dataUrls => {
          if (dataUrls.length === 0) {
            return;
          }
          setImageUrls(prev => [...prev, ...dataUrls]);
        })
        .catch(() => {/* swallow errors; user can retry paste */});
    }
  };

  const sendDisabled = !inputEnabled || (imageUrls.length === 0 && !inputValue.trim());

  return (
    <div className="border-t border-border p-4 relative select-none">
      {/* Drag handle (top edge) */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-row-resize"
        onMouseDown={beginDrag}
        aria-label="调整输入区域高度"
      >
        <div className="mx-auto h-full w-24">
          {/* visual hint - subtle line */}
          <div className="h-[2px] mt-[6px] rounded bg-muted-foreground/30" />
        </div>
      </div>
      <div className="max-w-[900px] mx-auto flex flex-col justify-end">
        <div className="flex items-end">
          <div className="flex-1 relative" style={{ height: editorHeight }}>
            <div
              className={cn(
                "absolute inset-0 flex flex-col overflow-y-auto rounded-md border border-input bg-transparent",
                "scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
              )}
              ref={scrollContainerRef}
            >
              {imageUrls.length > 0 && (
                <div className="p-2 flex flex-wrap gap-2">
                  {imageUrls.map((src, idx) => (
                    <ImageBlock
                      key={idx}
                      src={src}
                      alt={`粘贴图片 ${idx + 1}`}
                      removable
                      onRemove={() => setImageUrls(prev => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>
              )}
              <textarea
                ref={textAreaRef}
                placeholder="请输入内容，Alt + Enter 发送"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className={cn(
                  "w-full resize-none",
                  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
                  "dark:bg-input/30 bg-transparent px-3 py-2 text-sm outline-none flex-shrink-0",
                  "focus-visible:border-none focus-visible:ring-0",
                  imageUrls.length > 0 ? "pt-1" : "",
                )}
                rows={1}
              />
            </div>
            <div className="absolute right-2 bottom-2 flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSend}
                disabled={sendDisabled}
                aria-label={sendDisabled ? "发送不可用" : "发送消息 (Alt+Enter)"}
              >
                <Send className="size-4 mr-1" />
                <span className="text-[10px] leading-none text-muted-foreground">Alt+Enter</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
