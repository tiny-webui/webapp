"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/custom/logo";
import { UiSettings } from "./tabs/ui-settings";
import { ChatSettings } from "./tabs/chat-settings";
import { ModelSettings } from "./tabs/model-settings";
import { GlobalSettings } from "./tabs/global-settings";
import { UserSettings } from "./tabs/user-settings";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";

const structure = [
  {
    id: "user",
    label: "用户设置",
    children: [
      { id: "ui", label: "界面设置" },
      { id: "chat", label: "聊天设置" },
    ],
  },
  {
    id: "admin",
    label: "管理员设置",
    children: [
      { id: "model", label: "模型管理" },
      { id: "global", label: "全局设置" },
      { id: "user", label: "用户管理" },
    ],
  },
] as const;

type LeafTabId = typeof structure[number]["children"][number]["id"];

async function isCurrentUserAdminAsync(): Promise<boolean> {
    const result = await TUIClientSingleton.get().getUserAdminSettingsAsync("");
    return result.role === 'admin';
}

export default function SettingsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTab, setCurrentTab] = useState<LeafTabId>("ui");

  // Derived label for header etc. (if needed later)
  const currentLabel = useMemo(() => {
    for (const group of structure) {
      const found = group.children.find(c => c.id === currentTab);
      if (found) return found.label;
    }
    return "";
  }, [currentTab]);


  function onClose() {
    // Try to go back; if no history (SSR direct open), fallback to /chat
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push("/chat");
    }
  }

  // Perform admin check once on mount
  useEffect(() => {
    let mounted = true;
    isCurrentUserAdminAsync()
      .then(result => {
        if (mounted) {
          setIsAdmin(result);
        }
      })
      .catch(err => {
        console.error("Admin check failed", err);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar styled like chat side */}
      <aside className="w-80 bg-sidebar border-r border-border flex flex-col">
        {/* Logo area (same spacing as chat) */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Logo size="md" />
          </div>
        </div>
        {/* Scrollable category list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pt-0 space-y-6">
            {structure
              .filter(group => group.id !== 'admin' || isAdmin)
              .map(group => (
              <div key={group.id}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</div>
                <ul className="space-y-1">
                  {group.children.map(child => {
                    const active = child.id === currentTab;
                    return (
                      <li key={child.id}>
                        <button
                          className={cn(
                            "flex items-center w-full px-3 py-2 rounded-md cursor-pointer text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                          onClick={() => setCurrentTab(child.id as LeafTabId)}
                        >
                          <span className="flex-1 text-left truncate">{child.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Right side */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top menu bar */}
        <div className="border-b border-border px-4 h-14 flex items-center justify-between relative">
          <div className="font-medium text-sm">{currentLabel}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose} aria-label="关闭设置">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[900px] mx-auto space-y-8 py-2">
            {currentTab === "ui" && <UiSettings />}
            {currentTab === "chat" && <ChatSettings />}
            {currentTab === "model" && isAdmin && <ModelSettings />}
            {currentTab === "global" && isAdmin && <GlobalSettings />}
            {currentTab === "user" && isAdmin && <UserSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
