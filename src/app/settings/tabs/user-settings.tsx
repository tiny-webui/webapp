"use client";

import { useCallback, useEffect, useState } from "react";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import { CreateUserDialog } from "./user/create-user-dialog";
import { DeleteUserDialog } from "./user/delete-user-dialog";

type UserInfo = {
    id: string;
    email: string;
    role: 'admin' | 'user';
    isSelf?: boolean;
    note?: string;
};

export function UserSettings() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserInfo | undefined>(undefined);

  const loadUsers = useCallback(async() => {
    const userList = await TUIClientSingleton.get().getUserListAsync({
        adminMetadataKeys: ['note']
    });
    const userInfoList: UserInfo[] = userList.map(user => {
        let note = user.adminMetadata?.note;
        if (typeof note !== 'string') {
            note = undefined;
        }
        return {
            id: user.id,
            email: user.userName,
            role: user.adminSettings.role,
            isSelf: user.isSelf,
            note: note as string | undefined
        }
    });
    setUsers(userInfoList);
  }, [setUsers]);

  useEffect(() => {
    loadUsers().catch(console.error);
  }, [loadUsers]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        <button
          type="button"
          className="group relative flex h-28 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/40 hover:border-primary/60 hover:bg-accent/40 transition-colors p-2"
          aria-label="Create new user"
          onClick={() => setShowCreateUserDialog(true)}
        >
          <div className="text-3xl leading-none text-muted-foreground group-hover:text-primary">+</div>
        </button>

        {users.map(user => (
          <div
            key={user.id}
            className="relative flex flex-col h-28 justify-center overflow-hidden rounded-lg border bg-card/50 p-3 shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <button
              type="button"
              aria-label="Delete User"
              className="absolute top-1 right-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground hover:bg-destructive/20 hover:border-destructive/50 border border-border/60 text-xs font-semibold transition-colors"
              onClick={(e) => { e.stopPropagation(); setUserToDelete(user); }}
            >
              ×
            </button>
            <div className="flex flex-col gap-1.5 pr-4">
                <div className="text-base font-medium leading-tight truncate" title={user.email}>
                    {user.email}
                </div>
                <div className="flex gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border inline-block ${
                        user.role === 'admin' 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-muted text-muted-foreground border-border'
                    }`}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                    {user.isSelf && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
                            You
                        </span>
                    )}
                </div>
                <div className="text-sm text-muted-foreground leading-tight line-clamp-1 break-all" title={user.note}>
                    {user.note || <span className="italic opacity-50">No notes</span>}
                </div>
            </div>
          </div>
        ))}
      </div>
      {showCreateUserDialog && (
        <CreateUserDialog
          onComplete={() => {
            setShowCreateUserDialog(false);
            loadUsers().catch(console.error);
          }}
        />
      )}
      {userToDelete && (
        <DeleteUserDialog
          userId={userToDelete.id}
          email={userToDelete.email}
          onComplete={() => {
            setUserToDelete(undefined);
            loadUsers().catch(console.error);
          }}
        />
      )}
    </div>
  );
}
