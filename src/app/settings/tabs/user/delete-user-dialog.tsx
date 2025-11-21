"use client";

import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';

export interface DeleteUserDialogProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

export const DeleteUserDialog = ({ userId, email, onComplete }: DeleteUserDialogProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      console.log('Deleting user', userId);
      await TUIClientSingleton.get().deleteUserAsync(userId);
    } catch (err) {
      console.error('Failed to delete user', err);
    } finally {
      onComplete();
    }
  }, [userId, onComplete]);

  return (
    <Modal
      isOpen={true}
      onClose={onComplete}
      title="删除用户"
    >
      {(deleting) && (
        <div className="flex w-full items-center justify-center py-8 gap-3 select-none" aria-live="polite">
          <div className="relative h-8 w-8" role="status" aria-label="正在删除">
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">删除中...</span>
        </div>
      )}
      {(!deleting) && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            是否确认删除用户: <span className="font-medium text-foreground">“{email}”</span>?<br/>
            这将永久删除该用户数据。
          </p>
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
