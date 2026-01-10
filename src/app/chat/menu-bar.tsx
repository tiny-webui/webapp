"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings, PanelLeftOpen, SquarePen } from "lucide-react";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";

interface ChatMenuBarProps {
  selectedModelId?: string;
  onSelectedModelIdChange: (id: string) => void;
  isSidebarVisible: boolean;
  onShowSidebar: () => void;
  onNewChat: () => void;
}

export function ChatMenuBar({ 
  selectedModelId, 
  onSelectedModelIdChange,
  isSidebarVisible,
  onShowSidebar,
  onNewChat
}: ChatMenuBarProps) {
  const [modelList, setModelList] = useState<ServerTypes.GetModelListResult>([]);
  const router = useRouter();

  const getModelName = useCallback((model: ServerTypes.GetModelListResult[number]): string => {
    const modelName = model.metadata?.name;
    if (!(typeof modelName === "string")) {
      return "未命名模型";
    }
    return modelName;
  }, []);

  const updateModelListAsync = useCallback(async () => {
    const models = await TUIClientSingleton.get().getModelListAsync({ metadataKeys: ['name'] });
    setModelList(models);
    if (models.find(m => m.id === selectedModelId) === undefined) {
      onSelectedModelIdChange(models[0]?.id ?? undefined);
    }
  }, [onSelectedModelIdChange, selectedModelId]);

  useEffect(() => {
    updateModelListAsync().catch(console.error);
    // This should NOT be called when selectedModelId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const candidates = useMemo(() => {
    return new Map(
      modelList.map(model => [getModelName(model), model.id])
    );
  }, [getModelName, modelList]);

  return (
    <div className="border-b border-border px-4">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center space-x-2">
          {!isSidebarVisible && (
            <>
              <Button variant="ghost" size="icon" onClick={onShowSidebar}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onNewChat}>
                <SquarePen className="h-4 w-4" />
              </Button>
            </>
          )}
          <Select
            candidates={candidates}
            value={selectedModelId ?? ""}
            onValueChange={onSelectedModelIdChange}
            onOpen={() => {
              updateModelListAsync().catch(console.error);
            }}
            placeholder="选择模型"
            className="w-[180px]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
            aria-label="打开设置"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
