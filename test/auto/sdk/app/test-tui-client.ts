import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as rpc from '../../../../src/sdk/app/rpc';
import { ErrorCode } from '../../../../src/sdk/types/Rpc';

const makeRequestAsync = jest.fn<(method: string, params: unknown) => Promise<unknown>>();

jest.unstable_mockModule('../../../../src/sdk/app/rpc', () => ({
    ...rpc,
    Client: jest.fn(() => ({
        makeRequestAsync,
        connectAsync: async () => {},
        close: () => {},
    })),
}));
jest.unstable_mockModule('../../../../src/sdk/session/secure-session', () => ({
    Connection: jest.fn(),
}));
jest.unstable_mockModule('../../../../src/sdk/session/websocket-client', () => ({
    Connection: jest.fn(),
}));

const { TUIClient } = await import('../../../../src/sdk/tui-client');

let client: InstanceType<typeof TUIClient>;

beforeEach(async () => {
    makeRequestAsync.mockReset();
    client = new TUIClient('localhost', () => {}, () => {});
    await client.connectAsync('test-user', 'test-password');
});

describe('Pinned chat client', () => {
    test('fetches an unpaged list without changing the regular list', async () => {
        const pinned = [{ id: 'pinned', metadata: { title: 'Pinned' } }];
        const regular = [{ id: 'recent' }, ...pinned];
        makeRequestAsync.mockResolvedValueOnce(pinned).mockResolvedValueOnce(regular);

        await expect(client.getPinnedChatListAsync({ metaDataKeys: ['title'] })).resolves.toEqual(pinned);
        expect(makeRequestAsync).toHaveBeenNthCalledWith(1, 'getPinnedChatList', { metaDataKeys: ['title'] });
        await expect(client.getChatListAsync({ start: 0, quantity: 50 })).resolves.toEqual(regular);
        expect(makeRequestAsync).toHaveBeenNthCalledWith(2, 'getChatList', {
            start: 0, quantity: 50, metaDataKeys: undefined,
        });
    });

    test('reuses the pinned list on NOT_MODIFIED and accepts a changed order', async () => {
        const pinned = [{ id: 'first' }, { id: 'second' }];
        makeRequestAsync.mockResolvedValueOnce(pinned)
            .mockRejectedValueOnce(new rpc.RequestError(ErrorCode.NOT_MODIFIED, 'Unchanged'))
            .mockResolvedValueOnce([...pinned].reverse());

        await expect(client.getPinnedChatListAsync({})).resolves.toEqual(pinned);
        await expect(client.getPinnedChatListAsync({})).resolves.toEqual(pinned);
        await expect(client.getPinnedChatListAsync({})).resolves.toEqual([...pinned].reverse());
    });

    test.each([true, false])('sets pin state explicitly to %s', async pinned => {
        makeRequestAsync.mockResolvedValue(undefined);
        await client.setChatPinnedAsync({ id: 'chat', pinned });
        expect(makeRequestAsync).toHaveBeenCalledWith('setChatPinned', { id: 'chat', pinned });
    });

    test.each([
        { result: null },
        { result: {} },
        { result: [null] },
        { result: [{ id: 1 }] },
        { result: [{ id: 'chat', metadata: null }] },
    ])('rejects invalid pinned lists: $result', async ({ result }) => {
        makeRequestAsync.mockResolvedValue(result);
        await expect(client.getPinnedChatListAsync({})).rejects.toThrow(rpc.RequestError);
    });

    test('requires a connection for both pin endpoints', async () => {
        const disconnected = new TUIClient('localhost', () => {}, () => {});
        await expect(disconnected.getPinnedChatListAsync({})).rejects.toThrow('client not connected');
        await expect(disconnected.setChatPinnedAsync({ id: 'chat', pinned: true }))
            .rejects.toThrow('client not connected');
    });
});