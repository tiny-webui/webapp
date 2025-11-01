"use client";

import { useCallback, useState } from 'react';
import { ProviderKey, getProviderDisplayName, getProviderIcon, AVAILABLE_PROVIDERS } from './provider-registry';
import Image from 'next/image';
import { Modal } from '@/components/ui/modal';
import { AzureOpenAIForm } from './azure-openai-form';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';

export interface CreateModelDialogProps {
  onComplete: () => void; // UI-only for now
}

export const CreateModelDialog = ({ onComplete }: CreateModelDialogProps) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const createModelAsync = useCallback(async (name: string, settings: unknown) => {
    if (!selectedProvider) {
      onComplete();
      return;
    }
    setSaving(true);
    try {
      const modelId = await TUIClientSingleton.get().newModelAsync({
        providerName: selectedProvider,
        providerParams: settings
      });
      await TUIClientSingleton.get().setMetadataAsync({
        path: ['model', modelId],
        entries: {
          name: name
        }
      });
    } catch(error) {
      console.error("Failed to create model", error);
    } finally {
      onComplete();
    }
  }, [selectedProvider, onComplete]);

  return (
    <Modal
      isOpen={true}
      onClose={onComplete}
      title={selectedProvider ? `新建${getProviderDisplayName(selectedProvider)}模型` : "选择模型提供商"}
    >
      {selectedProvider === undefined && (!saving) && (
        <div className="grid grid-cols-2 gap-4">
          {AVAILABLE_PROVIDERS.map(p => (
            <button
              key={p}
              type="button"
              className="group flex flex-col items-center justify-center rounded-md border bg-card/40 hover:bg-accent/40 hover:border-primary transition-colors p-4 gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSelectedProvider(p)}
            >
              <div className="relative h-12 w-12">
                <Image
                  src={getProviderIcon(p)}
                  alt={`${getProviderDisplayName(p)} 图标`}
                  fill
                  sizes="48px"
                  className="object-contain"
                />
              </div>
              <div
                className="text-sm font-medium text-center text-foreground group-hover:text-primary truncate w-full"
                title={getProviderDisplayName(p)}
              >
                {getProviderDisplayName(p)}
              </div>
            </button>
          ))}
        </div>
      )}
      {selectedProvider === 'AzureOpenAI' && (!saving) && (
        <AzureOpenAIForm
          onSubmit={createModelAsync}
        />
      )}
      {saving && (
        <div className="flex w-full items-center justify-center py-8 gap-3 select-none" aria-live="polite">
          <div className="relative h-8 w-8" role="status" aria-label="正在保存">
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">保存中...</span>
        </div>
      )}
    </Modal>
  );
};
