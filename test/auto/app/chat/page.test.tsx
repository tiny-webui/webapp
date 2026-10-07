import React from 'react';
import { jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Side as SideComponent } from '@/app/chat/side';
import type * as ServerTypes from '@/sdk/types/IServer';
import { RequestError } from '@/sdk/app/rpc';
import { ErrorCode } from '@/sdk/types/Rpc';

const client = {
  getChatListAsync: jest.fn<(params: ServerTypes.GetChatListParams) => Promise<ServerTypes.GetChatListResult>>(),
  getPinnedChatListAsync: jest.fn<(params: ServerTypes.GetPinnedChatListParams) => Promise<ServerTypes.GetPinnedChatListResult>>(),
  getModelListAsync: jest.fn<() => Promise<ServerTypes.GetModelListResult>>(),
};

type SideProps = React.ComponentProps<typeof SideComponent>;
let sideProps: SideProps;
let regular: ServerTypes.GetChatListResult;
let pinned: ServerTypes.GetPinnedChatListResult;

jest.unstable_mockModule('@/lib/tui-client-singleton', () => ({
  TUIClientSingleton: { get: () => client },
}));
jest.unstable_mockModule('@/lib/settings', () => ({
  UserSettings: { fetchAsync: async () => {} },
  GlobalSettings: { fetchAsync: async () => {} },
}));
jest.unstable_mockModule('@/components/custom/logo', () => ({ Logo: () => null }));
jest.unstable_mockModule('@/app/chat/menu-bar', () => ({ ChatMenuBar: () => null }));
jest.unstable_mockModule('@/app/chat/chat', () => ({
  Chat: ({ activeChatId }: { activeChatId?: string }) => <div data-testid="active-chat">{activeChatId}</div>,
}));
jest.unstable_mockModule('@/app/chat/side', () => ({
  Side: (props: SideProps) => {
    sideProps = props;
    return <ol aria-label="Chats">
      {props.chatList.map(chat => <li key={chat.id}>
        <button onClick={() => props.onSwitchChat(chat.id)}>{chat.id}</button>
      </li>)}
    </ol>;
  },
}));

const { default: ChatPage } = await import('@/app/chat/page');

function displayedIds() {
  return within(screen.getByRole('list', { name: 'Chats' })).queryAllByRole('button')
    .map(button => button.textContent);
}

async function renderPage() {
  render(<ChatPage />);
  await screen.findByRole('list', { name: 'Chats' });
}

beforeEach(() => {
  jest.resetAllMocks();
  regular = Array.from({ length: 110 }, (_, index) => ({ id: `chat-${index}` }));
  pinned = [];
  client.getChatListAsync.mockImplementation(async ({ start, quantity }) => regular.slice(start, start + quantity));
  client.getPinnedChatListAsync.mockImplementation(async () => [...pinned]);
  client.getModelListAsync.mockResolvedValue([]);
});

test('shows all pins first in server order and removes duplicate regular rows', async () => {
  pinned = [regular[2], regular[100]];
  await renderPage();
  expect(displayedIds().slice(0, 4)).toEqual(['chat-2', 'chat-100', 'chat-0', 'chat-1']);
  expect(displayedIds().filter(id => id === 'chat-2')).toHaveLength(1);
  expect(sideProps.pinnedChatIds).toEqual(new Set(['chat-2', 'chat-100']));
});

test('uses the unfiltered server count for the next offset', async () => {
  pinned = [regular[0], regular[100]];
  await renderPage();
  expect(displayedIds()).toHaveLength(51);
  await act(async () => sideProps.requestChatListUpdateAsync());
  expect(client.getChatListAsync).toHaveBeenLastCalledWith({
    start: 50, quantity: 50, metaDataKeys: ['title'],
  });
  expect(displayedIds()).toContain('chat-50');
  expect(new Set(displayedIds()).size).toBe(displayedIds().length);
});

test('continues past a full page containing only pinned chats', async () => {
  pinned = regular.slice(0, 51);
  await renderPage();
  expect(client.getChatListAsync.mock.calls.map(([params]) => params.start)).toEqual([0, 50]);
  expect(displayedIds()).toContain('chat-51');
});

test('a head refresh replaces both lists in their latest activity order', async () => {
  pinned = [regular[2], regular[3]];
  await renderPage();
  const updated = regular[49];
  regular = [updated, ...regular.filter(chat => chat.id !== updated.id)];
  pinned.reverse();
  await act(async () => sideProps.requestChatListUpdateAsync(true));
  expect(displayedIds().slice(0, 4)).toEqual(['chat-3', 'chat-2', 'chat-49', 'chat-0']);
  expect(client.getChatListAsync.mock.calls.at(-1)?.[0].start).toBe(0);
});

test('unpinning an active chat outside the loaded page does not deselect it', async () => {
  pinned = [regular[100]];
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'chat-100' }));
  pinned = [];
  await act(async () => sideProps.requestChatListUpdateAsync(true));
  expect(screen.getByTestId('active-chat').textContent).toBe('chat-100');
  expect(displayedIds()).not.toContain('chat-100');
  await act(async () => sideProps.requestChatListUpdateAsync());
  await act(async () => sideProps.requestChatListUpdateAsync());
  expect(displayedIds().indexOf('chat-100')).toBe(100);
});

test('restarts pagination when the server reports an ordering conflict', async () => {
  await renderPage();
  client.getChatListAsync.mockRejectedValueOnce(new RequestError(ErrorCode.CONFLICT, 'List changed'));
  regular.reverse();
  await act(async () => sideProps.requestChatListUpdateAsync());
  expect(client.getChatListAsync.mock.calls.map(([params]) => params.start)).toEqual([0, 50, 0]);
  expect(displayedIds()[0]).toBe('chat-109');
});

test('queues a head refresh requested during an in-flight page load', async () => {
  await renderPage();
  let resolvePage!: (value: ServerTypes.GetChatListResult) => void;
  const nextPage = regular.slice(50, 100);
  client.getChatListAsync.mockImplementationOnce(() => new Promise(resolve => { resolvePage = resolve; }));
  const loading = sideProps.requestChatListUpdateAsync();
  await waitFor(() => expect(client.getChatListAsync).toHaveBeenCalledTimes(2));
  regular.reverse();
  const refreshing = sideProps.requestChatListUpdateAsync(true);
  await act(async () => {
    resolvePage(nextPage);
    await Promise.all([loading, refreshing]);
  });
  expect(client.getChatListAsync.mock.calls.map(([params]) => params.start)).toEqual([0, 50, 0]);
  expect(displayedIds()[0]).toBe('chat-109');
});

test('a failed refresh does not prevent later refreshes', async () => {
  await renderPage();
  client.getPinnedChatListAsync.mockRejectedValueOnce(new Error('Connection lost'));
  await act(async () => {
    await expect(sideProps.requestChatListUpdateAsync(true)).rejects.toThrow('Connection lost');
  });
  regular.reverse();
  await act(async () => sideProps.requestChatListUpdateAsync(true));
  expect(displayedIds()[0]).toBe('chat-109');
});