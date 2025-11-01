"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import * as ServerTypes from "@/sdk/types/IServer";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";

interface ChatMenuBarProps {
  selectedModelId?: string;
  onSelectedModelIdChange: (id: string) => void;
}

export function ChatMenuBar({ selectedModelId, onSelectedModelIdChange }: ChatMenuBarProps) {
  const [modelList, setModelList] = useState<ServerTypes.GetModelListResult>([]);
  const router = useRouter();

  function getModelName(model: ServerTypes.GetModelListResult[number]): string {
    const modelName = model.metadata?.name;
    if (!(typeof modelName === 'string')) {
      return "未命名模型";
    }
    return modelName;
  }

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

  return (
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Select
            value={selectedModelId}
            onValueChange={onSelectedModelIdChange}
            onOpenChange={(open) => {
              if (open) {
                updateModelListAsync().catch(console.error);
              }
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelList.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {getModelName(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">设为默认</span>
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
