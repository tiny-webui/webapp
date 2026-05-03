"use client";

import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';

export interface DeleteFileDialogProps {
  fileId: string;
  fileName: string;
  onComplete: () => void;
}

export const DeleteFileDialog = ({ fileId, fileName, onComplete }: DeleteFileDialogProps) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(undefined);
    try {
      await TUIClientSingleton.get().deleteFileAsync({ fileId });
      onComplete();
    } catch (err) {
      console.error('Failed to delete file', err);
      setError(err instanceof Error ? err.message : '删除失败');
      setDeleting(false);
    }
  }, [fileId, onComplete]);

  return (
    <Modal
      isOpen={true}
      onClose={deleting ? () => {} : onComplete}
      title="删除文件"
      showCloseButton={!deleting}
    >
      {deleting && (
        <div className="flex w-full items-center justify-center py-8 gap-3 select-none" aria-live="polite">
          <div className="relative h-8 w-8" role="status" aria-label="正在删除">
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">删除中...</span>
        </div>
      )}
      {!deleting && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            是否确认删除文件: <span className="font-medium text-foreground break-all">“{fileName}”</span>?<br/>
            该文件将从所有引用它的聊天中移除。
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onComplete}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
