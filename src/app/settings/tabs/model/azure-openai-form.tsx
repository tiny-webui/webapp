"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProviderFormProps } from './provider-form-props';

export function AzureOpenAIForm({ onSubmit }: ProviderFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

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
        <label className="text-sm font-medium" htmlFor="azure-model-url">URL</label>
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
          placeholder="输入 API Key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
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
                  apiKey: apiKey.trim()
                }
              )
            }}
          >确认</Button>
        </div>
      </div>
    </div>
  );
}
