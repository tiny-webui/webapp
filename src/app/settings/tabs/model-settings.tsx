"use client";

import { useEffect, useState, useCallback } from "react";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import Image from "next/image";
import { getProviderDisplayName, getProviderIcon } from "./model/provider-registry";
import { CreateModelDialog } from "./model/create-model-dialog";

type ModelInfo = {
  id: string;
  name: string;
  providerName: string;
};


export function ModelSettings() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreateModelDialog, setShowCreateModelDialog] = useState(false);

  const loadModels = useCallback(async () => {
    setLoaded(false);
    const models = await TUIClientSingleton.get().getModelListAsync({ metadataKeys: ["name"] });
    const modelInfoList: ModelInfo[] = await Promise.all(models.map(async (model) => {
      let modelName = model.metadata?.name as string;
      if (typeof modelName !== "string") {
        modelName = "未命名模型";
      }
      return {
        id: model.id,
        name: modelName, 
        providerName: (await TUIClientSingleton.get().getModelAsync(model.id)).providerName
      }
    }));
    setModels(modelInfoList);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadModels().catch(console.error);
  }, [loadModels]);

  if (!loaded) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        <button
          type="button"
          className="group relative flex h-20 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/40 hover:border-primary/60 hover:bg-accent/40 transition-colors p-2"
          onClick={() => {
            setShowCreateModelDialog(true);
          }}
          aria-label="新增模型"
        >
          <div className="text-3xl leading-none text-muted-foreground group-hover:text-primary">+</div>
        </button>
        {models.map(model => (
          <div
            key={model.id}
            className="relative flex h-20 overflow-hidden rounded-lg border bg-card/50 p-2 shadow-xs hover:shadow-sm transition-all"
          >
            <div className="flex w-full items-center">
              {/* Square icon area: fills card height (minus padding) but keeps square ratio */}
              <div className="relative mr-3 aspect-square h-full max-h-20 shrink-0">
                <Image
                  src={getProviderIcon(model.providerName)}
                  alt={`${model.providerName} 图标`}
                  fill
                  sizes="80px"
                  className="object-contain"
                  priority={false}
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0 justify-center gap-1">
                <div className="text-base font-medium leading-tight truncate" title={model.name}>{model.name}</div>
                <div className="text-sm text-muted-foreground leading-tight truncate" title={model.providerName}>
                  {getProviderDisplayName(model.providerName)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {
        showCreateModelDialog && (
          <CreateModelDialog
            onModelCreationComplete={() => {
              setShowCreateModelDialog(false);
              loadModels().catch(console.error);
            }}
          />
        )
      }
    </div>
  );
}
