"use client";

import { useState, useCallback, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';
import { NewUserParams } from '@/sdk/types/IServer';
import { parseRegistrationString } from '@/sdk/registration';

export interface CreateUserDialogProps {
  onComplete: () => void;
}

export const CreateUserDialog = ({ onComplete }: CreateUserDialogProps) => {
  const [registrationString, setRegistrationString] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserParams, setNewUserParams] = useState<NewUserParams|undefined>(undefined);
  const [publicMetadata, setPublicMetadata] = useState<{ [key: string]: unknown }|undefined>(undefined);
  const [note, setNote] = useState<string|undefined>(undefined);

  const handleConfirm = useCallback(async () => {
    try {
      if (newUserParams === undefined) {
        throw new Error("Cannot create user: missing parameters");
      }
      const userId = await TUIClientSingleton.get().newUserAsync(newUserParams);
      if (note) {
        await TUIClientSingleton.get().setMetadataAsync({
          path: ['userAdmin', userId],
          entries: {
            note: note
          }
        });
      }
      if (publicMetadata) {
        await TUIClientSingleton.get().setMetadataAsync({
          path: ['userPublic', userId],
          entries: publicMetadata
        });
      }
    } catch (error) {
      console.error("Failed to create user", error);
    } finally {
      onComplete();
    }
  }, [onComplete, newUserParams, note, publicMetadata]);

  useEffect(() => {
    try {
      const result = parseRegistrationString(registrationString);
      const params: NewUserParams = {
        userName: result.username,
        adminSettings: {
          role: isAdmin ? 'admin' : 'user'
        },
        credential: {
          w0: Buffer.from(result.w0).toString('base64'),
          L: Buffer.from(result.L).toString('base64'),
          salt: Buffer.from(result.salt).toString('base64')
        }
      }
      setNewUserParams(params);
      if (result.publicMetadata !== undefined) {
        setPublicMetadata(result.publicMetadata);
      }
    } catch {
      setNewUserParams(undefined);
      setPublicMetadata(undefined);
    }
  }, [registrationString, isAdmin, setNewUserParams, setPublicMetadata]);

  // Mock validation logic for now
  const getStatusMessage = () => {
    if (!newUserParams) {
      if (registrationString) {
        return "注册信息格式错误。";
      } else {
        return "请输入注册信息。";
      }
    }
    return `${newUserParams.userName}将被注册为${isAdmin ? '管理员' : '普通用户'}。`;
  };

  return (
    <Modal
      isOpen={true}
      onClose={onComplete}
      title="Add User"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="registration-string" className="text-sm font-medium">
            注册信息
          </label>
          <Input
            id="registration-string"
            type="password"
            placeholder="请粘贴注册信息..."
            value={registrationString}
            onChange={(e) => setRegistrationString(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="is-admin" className="text-sm font-medium cursor-pointer select-none" onClick={() => setIsAdmin(!isAdmin)}>
            是否为管理员
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={isAdmin}
            onClick={() => setIsAdmin(!isAdmin)}
            className={`
              relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50
              ${isAdmin ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
                ${isAdmin ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="admin-note" className="text-sm font-medium">
            管理员备注
          </label>
          <Input
            id="admin-note"
            placeholder="[可选] 备注"
            value={note ?? ''}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {getStatusMessage()}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onComplete}>
            取消
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={newUserParams === undefined}
          >
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
};
