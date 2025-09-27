/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { jest } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Side } from '@/app/chat/side';

function makeChats(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `chat-${i}`,
    metadata: { title: `Chat Title ${i}` }
  }));
}

describe('Side chat list', () => {
  test('renders temp chat always and highlights when activeChatId undefined', () => {
    const switchSpy = jest.fn();
    render(
      <Side
        onSwitchChat={switchSpy}
        requestChatListUpdateAsync={async () => {}}
        onChatDisplayRangeChange={() => {}}
        chatList={makeChats(3)}
        activeChatId={undefined}
      />
    );
  const temp = screen.getByText('开始新对话');
  expect(temp).toBeInTheDocument();
  const wrapper = temp.closest('div');
  expect(wrapper).toHaveClass('bg-primary');
  });

  test('clicking temp chat calls onSwitchChat with undefined', () => {
    const switchSpy = jest.fn();
    render(
      <Side
        onSwitchChat={switchSpy}
        requestChatListUpdateAsync={async () => {}}
        onChatDisplayRangeChange={() => {}}
        chatList={makeChats(2)}
        activeChatId={'chat-0'}
      />
    );
  const temp = screen.getByText('开始新对话');
    fireEvent.click(temp);
    expect(switchSpy).toHaveBeenCalledWith(undefined);
  });

  test('scrolling near bottom triggers requestChatListUpdateAsync (rate limited)', () => {
    jest.useFakeTimers();
    const switchSpy = jest.fn();
  const updateSpy = jest.fn(() => Promise.resolve()) as () => Promise<void>;
    const chats = makeChats(30); // enough to overflow
    render(
      <Side
        onSwitchChat={switchSpy}
        requestChatListUpdateAsync={updateSpy}
        onChatDisplayRangeChange={() => {}}
        chatList={chats}
        activeChatId={'chat-0'}
      />
    );
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    // Simulate scroll near bottom
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 150, configurable: true });

    fireEvent.scroll(scrollContainer);

    act(() => {
      // Run any scheduled rAF style callbacks
      jest.advanceTimersByTime(16);
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);

    fireEvent.scroll(scrollContainer);
    act(() => {
      jest.advanceTimersByTime(16);
    });

    // Rate limited: still only one call
    expect(updateSpy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('shows loading spinner while refresh in progress', async () => {
    jest.useFakeTimers();
    const switchSpy = jest.fn();
    let resolveRefresh: () => void;
    const updateSpy = jest.fn(() => new Promise<void>(r => { resolveRefresh = r; }));
    const chats = makeChats(40);
    render(
      <Side
        onSwitchChat={switchSpy}
        requestChatListUpdateAsync={updateSpy}
        onChatDisplayRangeChange={() => {}}
        chatList={chats}
        activeChatId={undefined}
      />
    );
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 350, configurable: true }); // near bottom
    await act(async () => {
      fireEvent.scroll(scrollContainer);
      jest.advanceTimersByTime(16);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    // Spinner should appear
    expect(screen.getByLabelText('loading')).toBeInTheDocument();
    await act(async () => {
      resolveRefresh!();
    });
    // Spinner removed
    expect(screen.queryByLabelText('loading')).toBeNull();
    jest.useRealTimers();
  });

  test('clicking a chat switches to that chat id', () => {
    const switchSpy = jest.fn();
    const chats = makeChats(5);
    render(
      <Side
        onSwitchChat={switchSpy}
        requestChatListUpdateAsync={async () => {}}
        onChatDisplayRangeChange={() => {}}
        chatList={chats}
        activeChatId={undefined}
      />
    );
    const target = screen.getByText('Chat Title 3');
    fireEvent.click(target);
    expect(switchSpy).toHaveBeenCalledWith('chat-3');
  });
});
