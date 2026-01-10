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

function renderSide(override: Partial<React.ComponentProps<typeof Side>> = {}) {
  const props: React.ComponentProps<typeof Side> = {
    onSwitchChat: jest.fn(),
    requestChatListUpdateAsync: async () => {},
    onChatDisplayRangeChange: jest.fn(),
    chatList: makeChats(3),
    activeChatId: undefined,
    onHideSidebar: jest.fn(),
    ...override,
  };
  return render(<Side {...props} />);
}

function mockRaf() {
  const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    return setTimeout(() => cb(0), 0) as unknown as number;
  });
  const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => clearTimeout(id));
  return { rafSpy, cancelSpy };
}

async function fireScroll(container: HTMLElement) {
  await act(async () => {
    fireEvent.scroll(container);
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

describe('Side chat list', () => {
  test('renders temp chat always and highlights when activeChatId undefined', () => {
    renderSide();
    const temp = screen.getByText('开始新对话');
    expect(temp).toBeInTheDocument();
    const wrapper = temp.closest('div');
    expect(wrapper).toHaveClass('bg-primary');
  });

  test('clicking temp chat calls onSwitchChat with undefined', () => {
    const switchSpy = jest.fn();
    renderSide({
      onSwitchChat: switchSpy,
      chatList: makeChats(2),
      activeChatId: 'chat-0'
    });
    const temp = screen.getByText('开始新对话');
    fireEvent.click(temp);
    expect(switchSpy).toHaveBeenCalledWith(undefined);
  });

  test('scrolling near bottom triggers requestChatListUpdateAsync (rate limited)', async () => {
    jest.useFakeTimers();
    const switchSpy = jest.fn();
    const updateSpy = jest.fn(() => Promise.resolve()) as () => Promise<void>;
    const { rafSpy, cancelSpy } = mockRaf();
    const chats = makeChats(30); // enough to overflow
    renderSide({
      onSwitchChat: switchSpy,
      requestChatListUpdateAsync: updateSpy,
      chatList: chats,
      activeChatId: 'chat-0'
    });
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    // Simulate scroll near bottom
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 150, configurable: true });

    await fireScroll(scrollContainer);

    expect(updateSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(scrollContainer, 'scrollTop', { value: 180, configurable: true });
    await fireScroll(scrollContainer);

    // Rate limited: still only one call
    expect(updateSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
  });

  test('scrolling upward does not trigger load more even near bottom', async () => {
    jest.useFakeTimers();
    const updateSpy = jest.fn(() => Promise.resolve()) as () => Promise<void>;
    const { rafSpy, cancelSpy } = mockRaf();

    const chats = makeChats(40);
    renderSide({ requestChatListUpdateAsync: updateSpy, chatList: chats, activeChatId: 'chat-0' });
    const container = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    Object.defineProperty(container, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });

    // First scroll down near bottom triggers load more
    Object.defineProperty(container, 'scrollTop', { value: 350, configurable: true });
    await fireScroll(container);

    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Scroll upward while still near bottom should not trigger again
    Object.defineProperty(container, 'scrollTop', { value: 320, configurable: true });
    await fireScroll(container);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
  });

  test('shows loading spinner while refresh in progress', async () => {
    jest.useFakeTimers();
    const switchSpy = jest.fn();
    let resolveRefresh: () => void;
    const updateSpy = jest.fn(() => new Promise<void>(r => { resolveRefresh = r; }));
    const { rafSpy, cancelSpy } = mockRaf();
    const chats = makeChats(40);
    renderSide({
      onSwitchChat: switchSpy,
      requestChatListUpdateAsync: updateSpy,
      chatList: chats,
      activeChatId: undefined
    });
    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 350, configurable: true }); // near bottom
    await fireScroll(scrollContainer);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    // Spinner should appear
    expect(screen.getByLabelText('loading')).toBeInTheDocument();
    await act(async () => {
      resolveRefresh!();
    });
    // Spinner removed
    expect(screen.queryByLabelText('loading')).toBeNull();
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
  });

  test('clicking a chat switches to that chat id', () => {
    const switchSpy = jest.fn();
    const chats = makeChats(5);
    renderSide({ onSwitchChat: switchSpy, chatList: chats, activeChatId: undefined });
    const target = screen.getByText('Chat Title 3');
    fireEvent.click(target);
    expect(switchSpy).toHaveBeenCalledWith('chat-3');
  });

  test('collapsing sidebar calls onHideSidebar', () => {
    const hideSpy = jest.fn();
    renderSide({ onHideSidebar: hideSpy });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  test('reports visible chat range when scrolling', () => {
    jest.useFakeTimers();
    const onRangeChange = jest.fn();
    const { rafSpy, cancelSpy } = mockRaf();

    const chatList = makeChats(3);
    renderSide({ chatList, onChatDisplayRangeChange: onRangeChange, activeChatId: 'chat-0' });

    const container = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });
    jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, right: 0, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({})
    });

    chatList.forEach((_, idx) => {
      const el = screen.getByText(`Chat Title ${idx}`).closest('div') as HTMLElement;
      jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        top: idx === 0 ? 0 : idx === 1 ? 60 : 140,
        bottom: idx === 0 ? 30 : idx === 1 ? 90 : 170,
        left: 0, right: 0, width: 100, height: 30, x: 0, y: 0, toJSON: () => ({})
      });
    });

    fireEvent.scroll(container);
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(onRangeChange).toHaveBeenCalledWith(1);
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
  });
});
