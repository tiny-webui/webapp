"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProviderFormProps } from './provider-form-props';
import { tryGetProperty } from '@/lib/obj-helper';

export function AzureOpenAIForm({ initialName, initialSettings, onSubmit }: ProviderFormProps) {
  const [name, setName] = useState<string>(initialName ?? '');
  const [url, setUrl] = useState<string>(tryGetProperty(initialSettings, 'url', 'string') ?? '');
  const [apiKey, setApiKey] = useState<string>(tryGetProperty(initialSettings, 'apiKey', 'string') ?? '');
  const [model, setModel] = useState<string|undefined>(tryGetProperty(initialSettings, 'model', 'string'));
  const [temperature, setTemperature] = useState<number|undefined>(tryGetProperty(initialSettings, 'temperature', 'number'));

  const canSubmit = name.trim() && url.trim() && apiKey.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="azure-model-name">模型名称</label>
        <Input
          id="azure-model-name"
          placeholder="输入模型名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="azure-model-url">Full URL</label>
        <Input
          id="azure-model-url"
          placeholder="https://your-resource.openai.azure.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="azure-model-key">API Key</label>
        <Input
          id="azure-model-key"
          placeholder="API Key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
          autoComplete='off'
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="azure-model-url">Model id</label>
        <Input
          id="azure-model-model"
          placeholder="[可选] model id"
          value={model ?? ''}
          onChange={(e) => {
            const value = e.target.value.trim();
            setModel(value === '' ? undefined : value);
          }}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="azure-model-key">Temperature</label>
        <Input
          id="azure-model-temperature"
          placeholder="[可选] temperature"
          type="number"
          value={temperature ?? ''}
          onChange={(e) => {
            let value: number|undefined = parseFloat(e.target.value);
            if (Number.isNaN(value)) {
              value = undefined;
            }
            setTemperature(value);
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => { 
              onSubmit(
                name.trim(),
                {
                  url: url.trim(),
                  apiKey: apiKey.trim(),
                  temperature: temperature,
                  model: model,
                }
              )
            }}
          >确认</Button>
        </div>
      </div>
    </div>
  );
}
