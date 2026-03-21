"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { Paperclip, X, Upload, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import * as ServerTypes from "@/sdk/types/IServer";

export type AttachedFile = {
  fileId: string;
  name: string;
  /** true if the file was deleted from server but is still referenced in chat metadata */
  deleted?: boolean;
};

interface FileContextBarProps {
  chatId: string | undefined;
  attachedFiles: AttachedFile[];
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
}

export function FileContextBar({
  chatId,
  attachedFiles,
  onAttachedFilesChange,
  disabled,
}: FileContextBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allFiles, setAllFiles] = useState<ServerTypes.ListFileResult>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  /** Close picker when clicking outside */
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const loadAllFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const files = await TUIClientSingleton.get().listFileAsync();
      setAllFiles(files);
    } catch {
      /* best effort */
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setPickerOpen(true);
    loadAllFiles();
  }, [disabled, loadAllFiles]);

  const toggleFile = useCallback(
    async (fileId: string, fileName: string) => {
      const isAttached = attachedFiles.some((f) => f.fileId === fileId);
      let next: AttachedFile[];
      if (isAttached) {
        next = attachedFiles.filter((f) => f.fileId !== fileId);
      } else {
        next = [...attachedFiles, { fileId, name: fileName }];
      }
      onAttachedFilesChange(next);
      if (chatId) {
        await TUIClientSingleton.get().setMetadataAsync({
          path: ["chat", chatId],
          entries: { contextFileIds: next.map((f) => f.fileId) },
        });
      }
    },
    [attachedFiles, chatId, onAttachedFilesChange]
  );

  const detachFile = useCallback(
    async (fileId: string) => {
      if (disabled) return;
      const next = attachedFiles.filter((f) => f.fileId !== fileId);
      onAttachedFilesChange(next);
      if (chatId) {
        await TUIClientSingleton.get().setMetadataAsync({
          path: ["chat", chatId],
          entries: { contextFileIds: next.map((f) => f.fileId) },
        });
      }
    },
    [attachedFiles, chatId, disabled, onAttachedFilesChange]
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      /** Reset so the same file can be re-selected */
      e.target.value = "";

      setUploading(true);
      setUploadError(undefined);
      try {
        /** Read as ArrayBuffer for UTF-8 validation */
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        /** Validate full UTF-8 text */
        const decoder = new TextDecoder("utf-8", { fatal: true });
        try {
          decoder.decode(bytes);
        } catch {
          setUploadError("文件不是有效的 UTF-8 文本文件。");
          return;
        }

        /** Upload */
        const metadata = { name: file.name, uploadTime: Date.now() };
        const result = await TUIClientSingleton.get().putFileAsync({
          content: bytes,
          metadata,
        });

        /** Attach to chat */
        const newFile: AttachedFile = { fileId: result.fileId, name: file.name };
        const next = [...attachedFiles, newFile];
        onAttachedFilesChange(next);
        if (chatId) {
          await TUIClientSingleton.get().setMetadataAsync({
            path: ["chat", chatId],
            entries: { contextFileIds: next.map((f) => f.fileId) },
          });
        }

        /** Refresh picker list */
        await loadAllFiles();
        setUploading(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [attachedFiles, chatId, loadAllFiles, onAttachedFilesChange]
  );

  const nonDeletedCount = attachedFiles.filter((f) => !f.deleted).length;

  return (
    <>
      {/* Context bar */}
      <div className="border-t border-border/50 px-4 py-1.5">
        <div className="max-w-[900px] mx-auto flex items-center gap-2 flex-wrap min-h-[28px]">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={openPicker}
            disabled={disabled}
          >
            <Paperclip className="size-3.5" />
            附加文件
          </Button>

          {attachedFiles.map((f) => (
            <span
              key={f.fileId}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                f.deleted
                  ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                  : "border-border bg-muted/50 text-foreground/80"
              )}
            >
              {f.deleted && <AlertTriangle className="size-3" />}
              {f.name}
              {!disabled && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  onClick={() => detachFile(f.fileId)}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}

          {nonDeletedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {nonDeletedCount} 个文件
            </span>
          )}
        </div>
      </div>

      {/* File picker popover */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)}>
          <div
            ref={pickerRef}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">选择文件</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3" />
                  上传新文件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.bat,.ps1,.html,.css,.scss,.less,.svg"
                  onChange={handleUpload}
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loadingFiles ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  加载中…
                </div>
              ) : allFiles.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  暂无文件，请上传新文件
                </div>
              ) : (
                allFiles.map((f) => {
                  const meta = f.fileMetadata as { name?: string; uploadTime?: number } | null;
                  const name = meta?.name ?? f.fileId;
                  const isAttached = attachedFiles.some((a) => a.fileId === f.fileId);
                  return (
                    <button
                      key={f.fileId}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => toggleFile(f.fileId, name)}
                    >
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isAttached
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {isAttached && <Check className="size-3" />}
                      </div>
                      <span className="truncate flex-1">{name}</span>
                      {meta?.uploadTime && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(meta.uploadTime).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      <Modal
        isOpen={uploading || !!uploadError}
        onClose={() => {
          if (!uploading) setUploadError(undefined);
        }}
        title="上传文件"
        showCloseButton={!uploading}
      >
        {uploading && (
          <div className="flex items-center gap-3 py-2">
            <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-full border-2 border-muted opacity-30" />
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <span className="text-sm">正在上传并验证文件…</span>
          </div>
        )}
        {uploadError && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>{uploadError}</span>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setUploadError(undefined)}>
                确定
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
