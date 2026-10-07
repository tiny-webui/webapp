"use client";

import { useEffect, useState, useCallback, useLayoutEffect, useRef } from "react";
import { Copy, Trash2 } from "lucide-react";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";
import Image from "next/image";
import { AVAILABLE_PROVIDERS, getProviderDisplayName, getProviderIcon } from "./model/provider-registry";
import { CreateModelDialog } from "./model/create-model-dialog";
import { ModifyModelDialog } from "./model/modify-model-dialog";
import { DeleteModelDialog } from "./model/delete-model-dialog";

type ModelInfo = {
  id: string;
  name: string;
  providerName: string;
  providerParams: unknown;
};

type ContextMenuState = {
  model: ModelInfo;
  x: number;
  y: number;
} | null;

export function ModelSettings() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreateModelDialog, setShowCreateModelDialog] = useState(false);
  const [modelToDuplicate, setModelToDuplicate] = useState<ModelInfo | undefined>(undefined);
  const [modelToModify, setModelToModify] = useState<string | undefined>(undefined);
  const [modelToDelete, setModelToDelete] = useState<ModelInfo | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const loadModels = useCallback(async () => {
    setLoaded(false);
    const models = await TUIClientSingleton.get().getModelListAsync({ metadataKeys: ["name"] });
    const modelInfoList: ModelInfo[] = await Promise.all(models.map(async (model) => {
      let modelName = model.metadata?.name as string;
      if (typeof modelName !== "string") {
        modelName = "未命名模型";
      }
      const modelSettings = await TUIClientSingleton.get().getModelAsync(model.id);
      return {
        id: model.id,
        name: modelName, 
        providerName: modelSettings.providerName,
        providerParams: modelSettings.providerParams
      }
    }));
    setModels(modelInfoList);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadModels().catch(console.error);
  }, [loadModels]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeContextMenu = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        closeContextMenu();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const padding = 8;
    const clampedX = Math.max(padding, Math.min(contextMenu.x, window.innerWidth - rect.width - padding));
    const clampedY = Math.max(padding, Math.min(contextMenu.y, window.innerHeight - rect.height - padding));
    if (clampedX !== contextMenu.x || clampedY !== contextMenu.y) {
      setContextMenu({ ...contextMenu, x: clampedX, y: clampedY });
    }
  }, [contextMenu]);

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
            setModelToDuplicate(undefined);
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
            onClick={() => setModelToModify(model.id)}
            onContextMenu={event => {
              event.preventDefault();
              setContextMenu({ model, x: event.clientX, y: event.clientY });
            }}
          >
            <div className="flex w-full items-center">
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
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={event => {
            event.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            role="menu"
            aria-label="模型操作"
            className="absolute min-w-[170px] overflow-hidden rounded-md border border-border bg-background text-sm shadow-lg"
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={event => event.stopPropagation()}
            onKeyDown={event => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
              const activeIndex = items.findIndex(item => item === event.target);
              const direction = event.key === "ArrowDown" ? 1 : -1;
              items[(activeIndex + direction + items.length) % items.length]?.focus();
            }}
          >
            <button
              type="button"
              role="menuitem"
              autoFocus
              disabled={!AVAILABLE_PROVIDERS.some(provider => provider === contextMenu.model.providerName)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
              onClick={() => {
                setModelToDuplicate(contextMenu.model);
                setContextMenu(null);
                setShowCreateModelDialog(true);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              复制
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => {
                setModelToDelete(contextMenu.model);
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              删除
            </button>
          </div>
        </div>
      )}
      {
        showCreateModelDialog && (
          <CreateModelDialog
            initialProvider={AVAILABLE_PROVIDERS.find(provider => provider === modelToDuplicate?.providerName)}
            initialSettings={modelToDuplicate?.providerParams}
            onComplete={() => {
              setShowCreateModelDialog(false);
              setModelToDuplicate(undefined);
              loadModels().catch(console.error);
            }}
          />
        )
      }
      {
        modelToModify && (
          <ModifyModelDialog
            modelId={modelToModify}
            onComplete={() => {
              setModelToModify(undefined);
              loadModels().catch(console.error);
            }}
          />
        )
      }
      {
        modelToDelete && (
          <DeleteModelDialog
            modelInfo={modelToDelete}
            onComplete={() => {
              setModelToDelete(undefined);
              loadModels().catch(console.error);
            }}
          />
        )
      }
    </div>
  );
}
