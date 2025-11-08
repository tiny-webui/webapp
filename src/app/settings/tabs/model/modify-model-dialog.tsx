"use client";

import { useCallback, useEffect, useState } from 'react';
import { ProviderKey } from './provider-registry';
import { Modal } from '@/components/ui/modal';
import { AzureOpenAIForm } from './azure-openai-form';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';
import { objectsAreEqual } from '@/lib/obj-helper';

export interface ModifyModelDialogProps {
  modelId: string;
  onComplete: () => void; // UI-only for now
}

export const ModifyModelDialog = ({ modelId, onComplete }: ModifyModelDialogProps) => {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelName, setModelName] = useState<string | undefined>(undefined);
  const [providerName, setProviderName] = useState<ProviderKey | undefined>(undefined);
  const [providerParams, setProviderParams] = useState<unknown>(undefined);

  const modifyModelAsync = useCallback(async (name: string, settings: unknown) => {
    if (providerName === undefined) {
      onComplete();
      return;
    }
    setSaving(true);
    try {
      if (modelName !== name) {
        await TUIClientSingleton.get().setMetadataAsync({
          path: ['model', modelId],
          entries: {
            name: name
          }
        });
      }
      if (!objectsAreEqual(providerParams, settings)) {
        await TUIClientSingleton.get().modifyModelAsync({
          id: modelId,
          settings: {
            providerName: providerName,
            providerParams: settings
          }
        });
      }
    } catch(error) {
      console.error("Failed to create model", error);
    } finally {
      onComplete();
    }
  }, [modelId, modelName, providerName, providerParams, onComplete]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const modelMetadata = await TUIClientSingleton.get().getMetadataAsync({
        path: ['model', modelId],
        keys: ['name']
      });
      if (canceled) {
        return;
      }
      let modelName = modelMetadata?.name as string;
      if (typeof modelName !== "string") {
        modelName = "未命名模型";
      }
      setModelName(modelName);
      const modelSettings = await TUIClientSingleton.get().getModelAsync(modelId);
      if (canceled) {
        return;
      }
      setProviderName(modelSettings.providerName as ProviderKey);
      setProviderParams(modelSettings.providerParams);
      setLoaded(true);
    })();
    return () => { canceled = true; };
  }, [modelId]);

  return (
    <Modal
      isOpen={true}
      onClose={onComplete}
      title={"修改模型配置"}
    >
      {providerName === 'AzureOpenAI' && (!saving) && loaded && (
        <AzureOpenAIForm
          initialName={modelName}
          initialSettings={providerParams}
          onSubmit={modifyModelAsync}
        />
      )}
      {saving || (!loaded) && (
        <div className="flex w-full items-center justify-center py-8 gap-3 select-none" aria-live="polite">
          <div className="relative h-8 w-8" role="status" aria-label={saving ? "正在保存" : "正在加载"}>
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">{saving ? "保存中..." : "加载中..."}</span>
        </div>
      )}
    </Modal>
  );
};
