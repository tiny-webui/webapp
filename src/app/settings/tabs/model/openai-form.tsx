"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProviderFormProps } from './provider-form-props';
import { tryGetProperty } from '@/lib/obj-helper';
import { Select } from '@/components/ui/select';

const validReasoningEfforts = new Set(['none', 'low', 'medium', 'high']);

export function OpenAIForm({ initialName, initialSettings, onSubmit }: ProviderFormProps) {
  const [name, setName] = useState<string>(initialName ?? '');
  const [url, setUrl] = useState<string>(tryGetProperty(initialSettings, 'url', 'string') ?? '');
  const [apiKey, setApiKey] = useState<string>(tryGetProperty(initialSettings, 'apiKey', 'string') ?? '');
  const [model, setModel] = useState<string>(tryGetProperty(initialSettings, 'model', 'string') ?? '');
  const [temperature, setTemperature] = useState<number | undefined>(tryGetProperty(initialSettings, 'temperature', 'number'));

  const initialReasoningEffort = tryGetProperty(initialSettings, 'reasoningEffort', 'string');
  const [reasoningEffort, setReasoningEffort] = useState<string>(
    validReasoningEfforts.has(initialReasoningEffort ?? '') ? (initialReasoningEffort ?? '') : ''
  );

  const reasoningOptions = new Map([
    ["none", "none"],
    ["low", "low"],
    ["medium", "medium"],
    ["high", "high"],
  ]);

  const canSubmit = name.trim() && apiKey.trim() && model.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-name">模型名称</label>
        <Input
          id="openai-model-name"
          placeholder="输入模型名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-url">Base URL</label>
        <Input
          id="openai-model-url"
          placeholder="[可选] https://api.openai.com/v1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-key">API Key</label>
        <Input
          id="openai-model-key"
          placeholder="API Key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-id">Model id</label>
        <Input
          id="openai-model-id"
          placeholder="例如 gpt-4o"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-temperature">Temperature</label>
        <Input
          id="openai-model-temperature"
          placeholder="[可选] temperature"
          type="number"
          value={temperature ?? ''}
          onChange={(e) => {
            let value: number | undefined = parseFloat(e.target.value);
            if (Number.isNaN(value)) {
              value = undefined;
            }
            setTemperature(value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="openai-model-reasoning">Reasoning Effort</label>
        <Select
          id="openai-model-reasoning"
          candidates={reasoningOptions}
          value={reasoningEffort}
          onValueChange={(value) => {
            setReasoningEffort(value);
          }}
          placeholder="[可选] reasoning effort"
          allowClear
          className="w-full"
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const trimmedName = name.trim();
              const trimmedUrl = url.trim();
              const settings: Record<string, unknown> = {
                apiKey: apiKey.trim(),
                model: model.trim(),
              };
              if (temperature !== undefined) {
                settings.temperature = temperature;
              }
              if (trimmedUrl !== '') {
                settings.url = trimmedUrl;
              }
              if (reasoningEffort !== '') {
                settings.reasoningEffort = reasoningEffort;
              }
              onSubmit(trimmedName, settings);
            }}
          >确认</Button>
        </div>
      </div>
    </div>
  );
}
