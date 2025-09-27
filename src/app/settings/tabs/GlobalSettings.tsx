"use client";

import { useEffect, useState } from "react";
import * as settings from "@/lib/settings";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import * as ServerTypes from "@/sdk/types/IServer";
import { DropDownOption } from "../options/DropDown";

export function GlobalSettings() {
  const [titleGenerationModelId, setTitleGenerationModelId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      await settings.GlobalSettings.fetchAsync();
      if (canceled) {
        return;
      }
      setTitleGenerationModelId(settings.GlobalSettings.titleGenerationModelId);
      setLoaded(true);
    })().catch(console.error);
    return () => { canceled = true; };
  }, []);

  if (!loaded) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="relative h-12 w-12">
          {/* Static track */}
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            {/* Spinning arc */}
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <span className="sr-only">加载中...</span>
      </div>
    );
  }
  return (
    <DropDownOption<ServerTypes.GetModelListResult[number]> 
      label="会话标题生成模型"
      placeholder="选择模型"
      value={titleGenerationModelId}
      updateOptionsAsync={async () => {
        return await TUIClientSingleton.get().getModelListAsync({ metadataKeys: ["name"] });
      }}
      saveValueAsync={async (value) => {
        setTitleGenerationModelId(value);
        settings.GlobalSettings.titleGenerationModelId = value;
        await settings.GlobalSettings.saveAsync();
      }}
      getItemCaption={(model) => {
        const modelName = model.metadata?.name;
        if (!(typeof modelName === "string")) {
          return "未命名模型";
        }
        return modelName;
      }}
      getItemValue={(item) => item.id}
      getItemKey={(item) => item.id}
    />
  );
}
