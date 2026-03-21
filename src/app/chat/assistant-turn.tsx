"use client";

import React, { useState } from "react";
import MarkdownRenderer from "@/components/custom/markdown-renderer";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunctionCallMessage } from "@/sdk/types/IServer";

/** Parts that make up an assistant turn during generation. */
export type PendingTurnPart =
  | { type: "text"; content: string }
  | { type: "tool_call"; call: FunctionCallMessage; status: "calling" | "executing" | "done"; result?: string };

/** 
 * Parts for committed (already in history) assistant turns. 
 * Built from MessageNode groups between user messages.
 */
export type CommittedTurnPart =
  | { type: "text"; content: string }
  | { type: "tool_call"; call: FunctionCallMessage; result?: string };

function ToolCallSection({ 
  call, 
  status, 
  result 
}: { 
  call: FunctionCallMessage; 
  status?: "calling" | "executing" | "done"; 
  result?: string;
}) {
  const { name, arguments: args } = call;
  const [expanded, setExpanded] = useState(false);
  const isDone = status === undefined || status === "done";
  const canExpand = isDone && (args || result);

  const statusText = (() => {
    switch (status) {
      case "calling": return "调用中…";
      case "executing": return "执行中…";
      default: return undefined;
    }
  })();

  return (
    <div className="my-1 rounded border border-border/60 bg-muted/30 text-sm">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground",
          canExpand && "cursor-pointer hover:bg-muted/50"
        )}
        onClick={() => canExpand && setExpanded(!expanded)}
        disabled={!canExpand}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span className="font-medium text-foreground/80">🔧 {name}</span>
        {statusText && (
          <span className="text-xs text-muted-foreground/70">{statusText}</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2">
          {args && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">参数</div>
              <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 rounded px-2 py-1 max-h-[200px] overflow-y-auto">
                {(() => {
                  try { return JSON.stringify(JSON.parse(args), null, 2); } catch { return args; }
                })()}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">结果</div>
              <pre className="text-xs whitespace-pre-wrap break-words bg-muted/40 rounded px-2 py-1 max-h-[300px] overflow-y-auto">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders an assistant turn consisting of text and tool call parts.
 * Used for both committed history and pending (streaming) turns.
 */
export function AssistantTurn({ parts }: { parts: (PendingTurnPart | CommittedTurnPart)[] }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg px-4 py-2 bg-background max-w-[100%]">
        {parts.map((part, idx) => {
          if (part.type === "text") {
            if (!part.content) return null;
            return <MarkdownRenderer key={idx} content={part.content} />;
          }
          return (
            <ToolCallSection
              key={idx}
              call={part.call}
              status={"status" in part ? part.status : undefined}
              result={part.result}
            />
          );
        })}
      </div>
    </div>
  );
}
