import * as rpc from './app/rpc';
import * as secureSession from './session/secure-session'
import * as websocket from './session/websocket-client'
import * as types from './types/IServer';
import { PagedResourceCache, ResourceCache } from './app/resource-cache';

/**
 * @todo All methods
 * @todo All caching
 * @todo Handle functional errors
 */

export class TUIClient {
    #url: string;
    #onDisconnected: (error: unknown | undefined) => void;
    #wasUnderAttack: () => void;
    #rpcClient: rpc.Client | undefined = undefined;
    #cache: ResourceCache = new ResourceCache();
    #chatListCache: PagedResourceCache<types.GetChatListResult[number]> = new PagedResourceCache();

    /**
     * 
     * @param url The websocket url. WITHOUT the protocol segment like ws:// or wss://
     * @param onDisconnected The connection was closed. Try reconnect or connect with new credentials.
     * @param wasUnderAttack The server detected attack against the current user.
     */
    constructor(
        url: string,
        onDisconnected: (error: unknown | undefined) => void,
        wasUnderAttack: () => void
    ) {
        this.#url = url;
        this.#onDisconnected = onDisconnected;
        this.#wasUnderAttack = wasUnderAttack;
    }

    /**
     * This will create a new connection with the given credentials.
     * The old connection will be closed and discarded.
     * All cache will be cleaned as they will be out of sync.
     * 
     * @param username 
     * @param password 
     */
    async connectAsync(username: string, password: string) {
        this.#rpcClient?.close();
        const webSocketConnection = new websocket.Connection(this.#url);
        const secureConnection = new secureSession.Connection(webSocketConnection, username, password, () => {
            this.#wasUnderAttack();
        });
        this.#rpcClient = new rpc.Client(secureConnection, () => {
            this.#onDisconnected(undefined);
        }, (error) => {
            this.#onDisconnected(error);
        });
        await this.#rpcClient.connectAsync();
    }

    /**
     * This will reconnect the old connection.
     * This will fail if the old connection can no longer reconnect.
     * In that case. Consider prompt the user to reenter their credentials 
     *      and connect with a new session.
     * All cache will be cleaned as they will be out of sync.
     */
    async reconnectAsync() {
        if (this.#rpcClient === undefined) {
            throw new Error('Cannot reconnect as there is no old connection');
        }
        await this.#rpcClient.connectAsync();
    }

    async #getChatListAsync(start: number, quantity: number, metaDataKeys?: string[]): Promise<types.GetChatListResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.GetChatListParams, types.GetChatListResult>(
            'getChatList', {
                start,
                quantity,
                metaDataKeys
            });
        if (!(typeof result === 'object') || result === null) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an object");
        }
        for (const item of result) {
            if (!('id' in item) || ((typeof item.id) !== 'string')) {
                throw new rpc.RequestError(-1, "Invalid response, id missing");
            }
            if ('metadata' in item) {
                if (typeof item.metadata !== 'object' || item.metadata === null) {
                    throw new rpc.RequestError(-1, "Invalid response, invalid metadata");
                }
            }
        }
        return result;
    }

    async getChatListAsync(params: types.GetChatListParams): Promise<types.GetChatListResult> {
        return this.#chatListCache.getAsync(
            this.#getChatListAsync.bind(this),
            params.start,
            params.quantity,
            params.metaDataKeys);
    }

    async #newChatAsync(): Promise<string> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<undefined, string>('newChat', undefined);
        if (typeof result !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, result should be a string");
        }
        return result;
    }

    async newChatAsync(): Promise<string> {
        const chatId = await this.#newChatAsync();
        this.#chatListCache.unshift({
            id: chatId
        });
        this.#cache.update<types.TreeHistory>(() => {
            return {
                nodes: {}
            };
        }, ['chat', chatId]);
        return chatId;
    }

    async * #chatCompletionAsync(params: types.ChatCompletionParams): 
        AsyncGenerator<string, types.ChatCompletionInfo, void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const generator = this.#rpcClient.makeStreamRequestAsync<types.ChatCompletionParams, string, types.ChatCompletionInfo>(
            'chatCompletion', params);
        while (true) {
            const it = await generator.next();
            if (it.done === true) {
                if (typeof it.value !== 'object' || it.value === null) {
                    throw new rpc.RequestError(-1, "Invalid final response, value should be an object");
                }
                if (!('userMessageId' in it.value) || typeof it.value.userMessageId !== 'string') {
                    throw new rpc.RequestError(-1, "Invalid final response, invalid userMessageId");
                }
                if (!('assistantMessageId' in it.value) || typeof it.value.assistantMessageId !== 'string') {
                    throw new rpc.RequestError(-1, "Invalid final response, invalid assistantMessageId");
                }
                return it.value;
            } else {
                if (typeof it.value !== 'string') {
                    throw new rpc.RequestError(-1, "Invalid segment, value should be a string");
                }
                yield it.value;
            }
        }
    }

    async * chatCompletionAsync(params: types.ChatCompletionParams):
        AsyncGenerator<string, types.ChatCompletionInfo, void> {
        const userMessageTimestamp = Date.now();
        let assistantMessageContent: string = '';
        const generator = this.#chatCompletionAsync(params);
        while (true) {
            const it = await generator.next();
            if (it.done === true) {
                this.#cache.update<types.TreeHistory>((history) => {
                    history = history ?? { nodes: {} } as types.TreeHistory;
                    if (params.parent !== undefined) {
                        const parent = history.nodes[params.parent];
                        parent?.children.push(it.value.userMessageId);
                    }
                    history.nodes[it.value.userMessageId] = {
                        id: it.value.userMessageId,
                        message: params.userMessage,
                        parent: params.parent,
                        children: [it.value.assistantMessageId],
                        /** 
                         * This will differ from the server side value.
                         * But that won't be a significant problem.
                         * DO NOT use this as a unique identifier.
                         */
                        timestamp: userMessageTimestamp
                    };
                    history.nodes[it.value.assistantMessageId] = {
                        id: it.value.assistantMessageId,
                        message: {
                            role: 'assistant',
                            content: [{
                                type: 'text',
                                data: assistantMessageContent
                            }]
                        },
                        parent: it.value.userMessageId,
                        children: [],
                        /** This will also differ from the server side value */
                        timestamp: Date.now()
                    };
                    return history;
                }, ['chat', params.id]);
                return it.value;
            } else {
                assistantMessageContent += it.value;
                yield it.value;
            }
        }
    }

    async #getModelListAsync(params: types.GetModelListParams): Promise<types.GetModelListResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.GetModelListParams, types.GetModelListResult>(
            'getModelList', params);
        if (!Array.isArray(result)) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an array");
        }
        for (const item of result) {
            if (!('id' in item) || ((typeof item.id) !== 'string')) {
                throw new rpc.RequestError(-1, "Invalid response, id missing");
            }
            if ('metadata' in item) {
                if (typeof item.metadata !== 'object' || item.metadata === null) {
                    throw new rpc.RequestError(-1, "Invalid response, invalid metadata");
                }
            }
        }
        return result;
    }

    async getModelListAsync(params: types.GetModelListParams): Promise<types.GetModelListResult> {
        return this.#cache.getAsync(this.#getModelListAsync.bind(this), ['modelList'], params);
    }

    async #newModelAsync(params: types.ModelSettings): Promise<string> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.ModelSettings, string>(
            'newModel', params);
        if (typeof result !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, result should be a string");
        }
        return result;
    }

    async newModelAsync(params: types.ModelSettings): Promise<string> {
        const modelId = await this.#newModelAsync(params);
        this.#cache.update<types.GetModelListResult>((list) => {
            list = list ?? [];
            list.unshift({
                id: modelId
            });
            return list;
        }, ['modelList']);
        this.#cache.update<types.ModelSettings>(() => {
            return params
        }, ['model', modelId]);
        return modelId;
    }

}
