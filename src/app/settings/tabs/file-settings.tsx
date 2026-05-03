"use client";

import { useCallback, useEffect, useState } from "react";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileText } from "lucide-react";
import { DeleteFileDialog } from "./user/delete-file-dialog";

type FileInfo = {
  fileId: string;
  contentId: string;
  name: string;
  uploadTime?: number;
  size?: number;
};

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileSettings() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | undefined>(undefined);
  const [fileToDelete, setFileToDelete] = useState<FileInfo | undefined>(undefined);

  const loadFiles = useCallback(async () => {
    setLoaded(false);
    try {
      const list = await TUIClientSingleton.get().listFileAsync();
      const infos: FileInfo[] = list.map(f => {
        const meta = f.fileMetadata as { name?: string; uploadTime?: number; size?: number } | null;
        return {
          fileId: f.fileId,
          contentId: f.contentId,
          name: typeof meta?.name === "string" ? meta.name : f.fileId,
          uploadTime: typeof meta?.uploadTime === "number" ? meta.uploadTime : undefined,
          size: typeof meta?.size === "number" ? meta.size : undefined,
        };
      });
      /** Newest first */
      infos.sort((a, b) => (b.uploadTime ?? 0) - (a.uploadTime ?? 0));
      setFiles(infos);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadFiles().catch(console.error);
  }, [loadFiles]);

  const handleDownload = useCallback(async (file: FileInfo) => {
    setDownloadingId(file.fileId);
    try {
      const { content } = await TUIClientSingleton.get().getFileContentAsync({ contentId: file.contentId });
      const blob = new Blob([new Uint8Array(content)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file", err);
    } finally {
      setDownloadingId(undefined);
    }
  }, []);

  if (!loaded) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/40 py-12 text-center">
          <FileText className="size-8 text-muted-foreground/70 mb-2" />
          <div className="text-sm text-muted-foreground">暂无已上传的文件</div>
          <div className="text-xs text-muted-foreground/70 mt-1">在聊天中附加文件后将显示在这里</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map(file => (
            <div
              key={file.fileId}
              className="flex items-center gap-3 rounded-lg border bg-card/50 p-3 shadow-xs hover:shadow-sm transition-all"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="flex flex-col flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="text-xs text-muted-foreground leading-tight truncate">
                  {file.uploadTime && new Date(file.uploadTime).toLocaleString()}
                  {file.size !== undefined && (
                    <>
                      {file.uploadTime ? " · " : ""}
                      {formatFileSize(file.size)}
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                aria-label="下载文件"
                title="下载文件"
                onClick={() => handleDownload(file)}
                disabled={downloadingId === file.fileId}
              >
                {downloadingId === file.fileId ? (
                  <div className="relative h-4 w-4">
                    <div className="absolute inset-0 rounded-full border-2 border-muted opacity-30" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <Download className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="删除文件"
                title="删除文件"
                onClick={() => setFileToDelete(file)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {fileToDelete && (
        <DeleteFileDialog
          fileId={fileToDelete.fileId}
          fileName={fileToDelete.name}
          onComplete={() => {
            setFileToDelete(undefined);
            loadFiles().catch(console.error);
          }}
        />
      )}
    </div>
  );
}
