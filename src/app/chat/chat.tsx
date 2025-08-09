"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronDown,
  Settings,
  User,
  X,
  Globe,
  Image,
  Code,
  Send,
  Plus,
  MessageSquare,
  Share
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatProps {
  activeConversationId: string;
}

// 模拟不同对话的消息内容
const conversationMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "1-1",
      content: "你好！我是TinyWebUI助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    },
    {
      id: "1-2",
      content: "我想了解一下矿车速度插件的配置",
      isUser: true,
      timestamp: new Date()
    },
    {
      id: "1-3",
      content: "好的！矿车速度插件可以帮助你调整Minecraft中矿车的移动速度。主要配置包括：\n\n1. 基础速度设置\n2. 加速倍率\n3. 最大速度限制\n\n你想了解哪个方面的配置？",
      isUser: false,
      timestamp: new Date()
    }
  ],
  "2": [
    {
      id: "2-1",
      content: "你好！我是TinyWebUI助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    },
    {
      id: "2-2",
      content: "我需要翻译一些查询命令",
      isUser: true,
      timestamp: new Date()
    },
    {
      id: "2-3",
      content: "我可以帮你翻译各种查询命令。请告诉我具体需要翻译什么命令，比如：\n\n- 玩家查询命令\n- 服务器状态命令\n- 权限查询命令\n\n你遇到的是哪种类型的命令？",
      isUser: false,
      timestamp: new Date()
    }
  ],
  "3": [
    {
      id: "3-1",
      content: "你好！我是TinyWebUI助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    },
    {
      id: "3-2",
      content: "Docker容器启动失败了",
      isUser: true,
      timestamp: new Date()
    },
    {
      id: "3-3",
      content: "Docker启动失败通常有以下几个常见原因：\n\n1. 端口冲突\n2. 镜像不存在\n3. 权限问题\n4. 磁盘空间不足\n\n请提供具体的错误信息，我可以帮你更准确地诊断问题。",
      isUser: false,
      timestamp: new Date()
    }
  ]
};

export function Chat({ activeConversationId }: ChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  
  // 根据当前对话ID获取消息
  const messages = conversationMessages[activeConversationId] || [
    {
      id: "default-1",
      content: "你好！我是TinyWebUI助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    }
  ];

  const handleSend = () => {
    if (inputValue.trim()) {
      // 这里可以添加发送消息的逻辑
      console.log("发送消息:", inputValue);
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* 顶部栏 */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                <SelectItem value="claude-3-sonnet">claude-3-sonnet</SelectItem>
                <SelectItem value="claude-3-haiku">claude-3-haiku</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">设为默认</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="size-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <User className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 信息横幅 */}
      <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm">
          这是一条公告
        </span>
        <Button variant="ghost" size="sm" className="text-white hover:bg-blue-600">
          <X className="size-4" />
        </Button>
      </div>

      {/* 对话内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[642px] mx-auto">
          {messages.length === 0 ? (
            // 空状态
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="size-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {selectedModel}
                </h2>
                <p className="text-muted-foreground">
                  开始新的对话吧！
                </p>
              </div>
            </div>
          ) : (
            // 消息列表
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部输入区域 */}
      <div className="border-t border-border p-4">
        <div className="max-w-[642px] mx-auto">
          {/* 输入框 */}
          <div className="flex items-end space-x-2 mb-3">
            <Button variant="ghost" size="sm">
              <Plus className="size-4" />
            </Button>
            <div className="flex-1 relative">
              <Input
                placeholder="今天我能为您做些什么？"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pr-12"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Button variant="ghost" size="sm" onClick={handleSend}>
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* 功能按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Globe className="size-4 mr-1" />
                网络搜索
              </Button>
              <Button variant="outline" size="sm">
                <Image className="size-4 mr-1" />
                图像
              </Button>
              <Button variant="outline" size="sm">
                <Code className="size-4 mr-1" />
                代码解释器
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Share className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 