/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const client = {
  getModelListAsync: jest.fn<() => Promise<{ id: string; metadata: { name: string } }[]>>(),
  getModelAsync: jest.fn<(modelId: string) => Promise<{ providerName: string; providerParams: unknown }>>(),
  getMetadataAsync: jest.fn<(params: unknown) => Promise<Record<string, unknown>>>(),
  newModelAsync: jest.fn<(settings: unknown) => Promise<string>>(),
  modifyModelAsync: jest.fn<(params: unknown) => Promise<void>>(),
  deleteModelAsync: jest.fn<(modelId: string) => Promise<void>>(),
  setMetadataAsync: jest.fn<(params: unknown) => Promise<void>>(),
};

jest.unstable_mockModule('@/lib/tui-client-singleton', () => ({
  TUIClientSingleton: { get: () => client },
}));

jest.unstable_mockModule('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const { CreateModelDialog } = await import('@/app/settings/tabs/model/create-model-dialog');
const { ModelSettings } = await import('@/app/settings/tabs/model-settings');

const sourceModels = [
  {
    id: 'source-openai',
    name: 'Existing OpenAI',
    providerName: 'OpenAI' as const,
    providerParams: {
      url: 'https://openai.example.com/v1',
      apiKey: 'openai-test-key',
      model: 'gpt-4o',
      temperature: 0,
      reasoningEffort: 'high',
    },
    urlLabel: 'Base URL',
  },
  {
    id: 'source-azure',
    name: 'Existing Azure OpenAI',
    providerName: 'AzureOpenAI' as const,
    providerParams: {
      url: 'https://azure.example.com/openai/deployments/test/chat/completions?api-version=2025-01-01',
      apiKey: 'azure-test-key',
      model: 'azure-deployment',
      temperature: 0.5,
    },
    urlLabel: 'Full URL',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  client.getModelListAsync.mockResolvedValue(sourceModels.map(source => ({
    id: source.id,
    metadata: { name: source.name },
  })));
  client.getModelAsync.mockImplementation(async modelId => {
    const source = sourceModels.find(model => model.id === modelId);
    if (!source) throw new Error(`Unexpected model: ${modelId}`);
    return { providerName: source.providerName, providerParams: source.providerParams };
  });
  client.getMetadataAsync.mockResolvedValue({ name: sourceModels[0].name });
  client.newModelAsync.mockResolvedValue('new-model');
  client.deleteModelAsync.mockResolvedValue(undefined);
  client.setMetadataAsync.mockResolvedValue(undefined);
});

describe('Model creation presets', () => {
  test.each(sourceModels)('prefills $providerName settings but requires a new name', async (source) => {
    const onComplete = jest.fn();
    render(
      <CreateModelDialog
        initialProvider={source.providerName}
        initialSettings={source.providerParams}
        onComplete={onComplete}
      />
    );

    expect(screen.getByLabelText('模型名称')).toHaveValue('');
    expect(screen.getByLabelText(source.urlLabel)).toHaveValue(source.providerParams.url);
    expect(screen.getByLabelText('API Key')).toHaveValue(source.providerParams.apiKey);
    expect(screen.getByDisplayValue(source.providerParams.model)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(source.providerParams.temperature);
    if (source.providerName === 'OpenAI') {
      expect(screen.getByRole('combobox')).toHaveTextContent('high');
    }
    expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
    expect(client.newModelAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'My copied model' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(client.newModelAsync).toHaveBeenCalledWith({
      providerName: source.providerName,
      providerParams: source.providerParams,
    });
    expect(client.setMetadataAsync).toHaveBeenCalledWith({
      path: ['model', 'new-model'],
      entries: { name: 'My copied model' },
    });
  });

  test('still starts with provider selection and empty fields when no preset is supplied', () => {
    render(<CreateModelDialog onComplete={jest.fn()} />);

    expect(screen.getByText('选择模型提供商')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^OpenAI/ }));

    expect(screen.getByLabelText('模型名称')).toHaveValue('');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('Model id')).toHaveValue('');
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
    expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
  });
});

describe('Model context menu', () => {
  test.each(sourceModels)('duplicates $providerName through the creation dialog without modifying the source', async (source) => {
    const originalSettings = { ...source.providerParams };
    render(<ModelSettings />);

    fireEvent.contextMenu(await screen.findByText(source.name), { clientX: 100, clientY: 120 });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.queryByLabelText('模型名称')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '复制' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('修改模型配置')).not.toBeInTheDocument();
    expect(screen.getByLabelText('模型名称')).toHaveValue('');
    expect(screen.getByLabelText(source.urlLabel)).toHaveValue(source.providerParams.url);
    expect(screen.getByLabelText('API Key')).toHaveValue(source.providerParams.apiKey);
    expect(screen.getByDisplayValue(source.providerParams.model)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(source.providerParams.temperature);
    expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
    expect(client.newModelAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'New model' } });
    fireEvent.change(screen.getByLabelText(source.urlLabel), { target: { value: 'https://copy.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await screen.findByText(source.name);
    expect(client.newModelAsync).toHaveBeenCalledTimes(1);
    expect(client.newModelAsync).toHaveBeenCalledWith({
      providerName: source.providerName,
      providerParams: { ...originalSettings, url: 'https://copy.example.com' },
    });
    expect(client.setMetadataAsync).toHaveBeenCalledWith({
      path: ['model', 'new-model'],
      entries: { name: 'New model' },
    });
    expect(client.modifyModelAsync).not.toHaveBeenCalled();
    expect(source.providerParams).toEqual(originalSettings);
    expect(client.getModelListAsync).toHaveBeenCalledTimes(2);
  });

  test('cancelling a duplicate leaves subsequent blank creation empty', async () => {
    render(<ModelSettings />);
    fireEvent.contextMenu(await screen.findByText(sourceModels[0].name));
    fireEvent.click(screen.getByRole('menuitem', { name: '复制' }));
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Discarded copy' } });
    fireEvent.click(screen.getByRole('button', { name: '' }));

    fireEvent.click(await screen.findByRole('button', { name: '新增模型' }));
    expect(screen.getByText('选择模型提供商')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^OpenAI/ }));

    expect(screen.getByLabelText('模型名称')).toHaveValue('');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('Model id')).toHaveValue('');
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
    expect(client.newModelAsync).not.toHaveBeenCalled();
    expect(client.setMetadataAsync).not.toHaveBeenCalled();
  });

  test.each(['Escape', 'Tab', 'scroll', 'resize', 'outside click'])('dismisses the menu on %s', async (action) => {
    render(<ModelSettings />);
    fireEvent.contextMenu(await screen.findByText(sourceModels[0].name));
    const menu = screen.getByRole('menu');
    expect(screen.getByRole('menuitem', { name: '复制' })).toHaveFocus();

    if (action === 'scroll') {
      fireEvent.scroll(window);
    } else if (action === 'resize') {
      fireEvent.resize(window);
    } else if (action === 'outside click') {
      fireEvent.click(menu.parentElement!);
    } else {
      fireEvent.keyDown(menu, { key: action });
    }

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('模型名称')).not.toBeInTheDocument();
    expect(client.newModelAsync).not.toHaveBeenCalled();
  });

  test('arrow keys navigate between duplicate and delete', async () => {
    render(<ModelSettings />);
    fireEvent.contextMenu(await screen.findByText(sourceModels[0].name));
    const duplicateItem = screen.getByRole('menuitem', { name: '复制' });
    const deleteItem = screen.getByRole('menuitem', { name: '删除' });

    expect(duplicateItem).toHaveFocus();
    fireEvent.keyDown(duplicateItem, { key: 'ArrowDown' });
    expect(deleteItem).toHaveFocus();
    fireEvent.keyDown(deleteItem, { key: 'ArrowUp' });
    expect(duplicateItem).toHaveFocus();
    expect(client.deleteModelAsync).not.toHaveBeenCalled();
  });

  test('left-click still edits the existing model', async () => {
    render(<ModelSettings />);
    fireEvent.click(await screen.findByText(sourceModels[0].name));

    expect(screen.getByText('修改模型配置')).toBeInTheDocument();
    expect(await screen.findByLabelText('模型名称')).toHaveValue(sourceModels[0].name);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(client.newModelAsync).not.toHaveBeenCalled();
  });

  test.each(sourceModels)('deletes the selected $providerName model only after confirmation', async (source) => {
    render(<ModelSettings />);
    const model = await screen.findByText(source.name);
    expect(screen.queryByRole('button', { name: '删除模型' })).not.toBeInTheDocument();

    fireEvent.contextMenu(model);
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('修改模型配置')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '删除模型' })).toBeInTheDocument();
    expect(screen.getByText(`“${source.name}”`)).toBeInTheDocument();
    expect(client.deleteModelAsync).not.toHaveBeenCalled();

    client.getModelListAsync.mockResolvedValueOnce(sourceModels
      .filter(model => model.id !== source.id)
      .map(model => ({ id: model.id, metadata: { name: model.name } })));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(client.getModelListAsync).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: '新增模型' });
    expect(client.deleteModelAsync).toHaveBeenCalledTimes(1);
    expect(client.deleteModelAsync).toHaveBeenCalledWith(source.id);
    expect(screen.queryByRole('heading', { name: '删除模型' })).not.toBeInTheDocument();
    expect(screen.queryByText(source.name)).not.toBeInTheDocument();
  });

  test('cancelling deletion keeps the model without calling delete', async () => {
    render(<ModelSettings />);
    fireEvent.contextMenu(await screen.findByText(sourceModels[0].name));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => expect(client.getModelListAsync).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(sourceModels[0].name)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '删除模型' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(client.deleteModelAsync).not.toHaveBeenCalled();
  });
});