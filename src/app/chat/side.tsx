"use client";

import { useState } from "react";
import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Settings
} from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  icon?: string;
  isActive?: boolean;
}

interface SideProps {
  onConversationChange: (conversationId: string) => void;
  activeConversationId: string;
}

export function Side({ onConversationChange, activeConversationId }: SideProps) {
  const [conversations] = useState<Conversation[]>([
    { id: "1", title: "矿车速度插件", icon: "⛏️" },
    { id: "2", title: "查询命令翻译", icon: "🔵" },
    { id: "3", title: "Docker Error Troubleshooting", icon: "🐳" },
    { id: "4", title: "配置文件翻译", icon: "📄" },
    { id: "5", title: "Minecraft 服务器配置", icon: "⚙️" },
    { id: "6", title: "Bukkit 世界设置", icon: "🌍" },
    { id: "7", title: "Minecraft Mod Error", icon: "🔧" },
    { id: "8", title: "Java Agent Warning", icon: "☕" },
    { id: "9", title: "季节配置翻译", icon: "🍂" },
    { id: "10", title: "游戏世界配置翻译", icon: "🎮" },
    { id: "11", title: "Docker Port Configuration", icon: "🐳" },
    { id: "12", title: "Linux 安装问题", icon: "🐧" },
    { id: "13", title: "Server Memory Issues", icon: "💾" },
    { id: "14", title: "Greeting Exchange", icon: "👋" },
    { id: "15", title: "AdGuard DNS Rules", icon: "🛡️" },
    { id: "16", title: "Geyser 正版认证方案", icon: "🔐" },
    { id: "17", title: "Shadowsocks Key Error", icon: "🔑" },
  ]);

  const handleConversationClick = (conversationId: string) => {
    onConversationChange(conversationId);
  };

  return (
    <div className="w-80 bg-zinc-50 border-r border-border flex flex-col">
      {/* 顶部区域 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Logo size="md" />
          <Button variant="ghost" size="sm">
            <Settings className="size-4" />
          </Button>
        </div>
        
        {/* 新对话按钮 */}
        <Button className="w-full" size="sm">
          <Plus className="size-4 mr-2" />
          新对话
        </Button>
      </div>

      {/* 历史对话 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pt-0">          
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  conversation.id === activeConversationId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span className="mr-2">{conversation.icon}</span>
                <span className="flex-1 truncate">{conversation.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 