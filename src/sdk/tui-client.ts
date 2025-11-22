import * as rpc from './app/rpc';
import * as secureSession from './session/secure-session'
import * as websocket from './session/websocket-client'
import * as types from './types/IServer';
import { PagedResourceCache, ResourceCache } from './app/resource-cache';

export class TUIClient implements types.IServer {
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
            if (typeof item.id !== 'string') {
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

    async #getChatAsync(id: string): Promise<types.TreeHistory> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<string, types.TreeHistory>('getChat', id);
        if (typeof result !== 'object' || result === null) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an object");
        }
        if (typeof result.nodes !== 'object' || result.nodes === null) {
            throw new rpc.RequestError(-1, "Invalid response, nodes should be an object");
        }
        for (const nodeId in result.nodes) {
            const node = result.nodes[nodeId];
            if (typeof node.id !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, node.id should be a string");
            }
            if (typeof node.message !== 'object' || node.message === null) {
                throw new rpc.RequestError(-1, "Invalid response, node.message should be an object");
            }
            if (node.parent !== undefined && typeof node.parent !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, node.parent should be a string");
            }
            if (!Array.isArray(node.children)) {
                throw new rpc.RequestError(-1, "Invalid response, node.children should be an array");
            }
            for (const childId of node.children) {
                if (typeof childId !== 'string') {
                    throw new rpc.RequestError(-1, "Invalid response, node.children should be an array of strings");
                }
            }
            if (typeof node.timestamp !== 'number') {
                throw new rpc.RequestError(-1, "Invalid response, node.timestamp should be a number");
            }
        }
        return result;
    }

    async getChatAsync(id: string): Promise<types.TreeHistory> {
        return await this.#cache.getAsync(this.#getChatAsync.bind(this), ['chat', id], id);
    }

    async #deleteChatAsync(id: string): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<string, void>('deleteChat', id);
    }

    async deleteChatAsync(id: string): Promise<void> {
        await this.#deleteChatAsync(id);
        this.#chatListCache.delete(item=>item.id === id);
        this.#cache.delete(['chat', id]);
    }

    async * #chatCompletionAsync(params: types.ChatCompletionParams): 
        AsyncGenerator<string, types.ChatCompletionInfo, void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        /** Incrase timeout to 2min for thinking models. */
        const generator = this.#rpcClient.makeStreamRequestAsync<types.ChatCompletionParams, string, types.ChatCompletionInfo>(
            'chatCompletion', params, 120_000);
        while (true) {
            const it = await generator.next();
            if (it.done === true) {
                if (typeof it.value !== 'object' || it.value === null) {
                    throw new rpc.RequestError(-1, "Invalid final response, value should be an object");
                }
                if (typeof it.value.userMessageId !== 'string') {
                    throw new rpc.RequestError(-1, "Invalid final response, invalid userMessageId");
                }
                if (typeof it.value.assistantMessageId !== 'string') {
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

    async executeGenerationTaskAsync(params: types.executeGenerationTaskParams): Promise<string> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.executeGenerationTaskParams, string>(
            'executeGenerationTask', params);
        if (typeof result !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, result should be a string");
        }
        return result;
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
            if (typeof item.id !== 'string') {
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

    async #getModelAsync(id: string): Promise<types.ModelSettings> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<string, types.ModelSettings>('getModel', id);
        if (typeof result !== 'object' || result === null) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an object");
        }
        if (typeof result.providerName !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, providerName should be a string");
        }
        if (result.providerParams === undefined) {
            throw new rpc.RequestError(-1, "Invalid response, providerParams should be present");
        }
        return result;
    }

    async getModelAsync(id: string): Promise<types.ModelSettings> {
        return await this.#cache.getAsync(this.#getModelAsync.bind(this), ['model', id], id);
    }

    async #deleteModelAsync(id: string): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<string, void>('deleteModel', id);
    }

    async deleteModelAsync(id: string): Promise<void> {
        await this.#deleteModelAsync(id);
        this.#cache.update<types.GetModelListResult>(list => {
            list = list ?? [];
            return list.filter(model => model.id !== id);
        }, ['modelList']);
        this.#cache.delete(['model', id]);
    }

    async #modifyModelAsync(params: types.ModifyModelSettingsParams): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<types.ModifyModelSettingsParams, void>(
            'modifyModel', params);
    }

    async modifyModelAsync(params: types.ModifyModelSettingsParams): Promise<void> {
        await this.#modifyModelAsync(params);
        this.#cache.update<types.ModelSettings>(() => {
            return params.settings;
        }, ['model', params.id]);
    }

    async #getUserListAsync(params: types.GetUserListParams): Promise<types.GetUserListResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.GetUserListParams, types.GetUserListResult>(
            'getUserList', params);
        if (!Array.isArray(result)) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an array");
        }
        for (const user of result) {
            if (typeof user.id !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, user.id should be a string");
            }
            if (typeof user.userName !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, user.userName should be a string");
            }
            if (typeof user.adminSettings !== 'object' || user.adminSettings === null) {
                throw new rpc.RequestError(-1, "Invalid response, user.adminSettings should be an object");
            }
            if (user.adminSettings.role !== 'admin' && user.adminSettings.role !== 'user') {
                throw new rpc.RequestError(-1, "Invalid response, invalid user.adminSettings.role");
            }
            if (user.publicMetadata !== undefined) {
                if (typeof user.publicMetadata !== 'object' || user.publicMetadata === null) {
                    throw new rpc.RequestError(-1, "Invalid response, user.publicMetadata should be an object");
                }
            }
        }
        return result;
    }

    async getUserListAsync(params: types.GetUserListParams): Promise<types.GetUserListResult> {
        return await this.#cache.getAsync(this.#getUserListAsync.bind(this), ['userList'], params);
    }

    async #newUserAsync(params: types.NewUserParams): Promise<string> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.NewUserParams, string>(
            'newUser', params);
        if (typeof result !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, result should be a string");
        }
        return result;
    }

    async newUserAsync(params: types.NewUserParams): Promise<string> {
        const userId = await this.#newUserAsync(params);
        this.#cache.update<types.GetUserListResult>(list => {
            list = list ?? [];
            list.unshift({
                id: userId,
                userName: params.userName,
                adminSettings: params.adminSettings
            });
            return list;
        }, ['userList']);
        this.#cache.update<types.UserAdminSettings>(() => {
            return params.adminSettings;
        }, ['user', userId, 'adminSettings']);
        return userId;
    }

    async #deleteUserAsync(id: string): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<string, void>(
            'deleteUser', id);
    }

    async deleteUserAsync(id: string): Promise<void> {
        await this.#deleteUserAsync(id);
        this.#cache.update<types.GetUserListResult>(list => {
            list = list ?? [];
            return list.filter(user => user.id !== id);
        }, ['userList']);
        this.#cache.delete(['user', id, 'adminSettings']);
    }

    async #getUserAdminSettingsAsync(id: string): Promise<types.UserAdminSettings> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<string, types.UserAdminSettings>(
            'getUserAdminSettings', id);
        if (typeof result !== 'object' || result === null) {
            throw new rpc.RequestError(-1, "result should be an object");
        }
        if (result.role !== 'admin' && result.role !== 'user') {
            throw new rpc.RequestError(-1, "Invalid response, invalid user.adminSettings.role");
        }
        return result;
    }

    async getUserAdminSettingsAsync(id: string): Promise<types.UserAdminSettings> {
        const settings = await this.#cache.getAsync(
            this.#getUserAdminSettingsAsync.bind(this), ['user', id, 'adminSettings'], id);
        this.#cache.update<types.GetUserListResult>(list => {
            const user = list?.find(user => user.id === id);
            if (user !== undefined) {
                user.adminSettings = settings;
            }
            return list ?? [];
        }, ['userList']);
        return settings;
    }

    async #setUserAdminSettingsAsync(params: types.SetUserAdminSettingsParams): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<types.SetUserAdminSettingsParams, void>(
            'setUserAdminSettings', params);
    }

    async setUserAdminSettingsAsync(params: types.SetUserAdminSettingsParams): Promise<void> {
        await this.#setUserAdminSettingsAsync(params);
        this.#cache.update<types.GetUserListResult>(list => {
            const user = list?.find(u => u.id === params.id);
            if (user !== undefined) {
                user.adminSettings = params.adminSettings;
            }
            return list ?? [];
        }, ['userList']);
        this.#cache.update<types.UserAdminSettings>(() => {
            return params.adminSettings;
        }, ['user', params.id, 'adminSettings']);
    }

    async setUserCredentialAsync(params: types.UserCredential): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<types.UserCredential, void>(
            'setUserCredential', params);
    }

    /** 
     * Metadata
     * Metadata themselves are not version tracked.
     * However, we need to update the lists that contain them.
     */

    async setMetadataAsync(params: types.SetMetadataParams): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<types.SetMetadataParams, void>(
            'setMetadata', params);
        if (params.path[0] === 'model') {
            const modelId = params.path[1];
            this.#cache.update<types.GetModelListResult>(list => {
                const model = list?.find(m => m.id === modelId);
                if (model !== undefined) {
                    model.metadata = {
                        ...model.metadata,
                        ...params.entries
                    };
                }
                return list ?? [];
            }, ['modelList']);
        }
        else if (params.path[0] === 'userPublic') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]) ?? list?.find(u => u.isSelf);
                if (user !== undefined) {
                    user.publicMetadata = {
                        ...user.publicMetadata,
                        ...params.entries
                    };
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'userAdmin') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]);
                if (user !== undefined) {
                    user.adminMetadata = {
                        ...user.adminMetadata,
                        ...params.entries
                    };
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'chat') {
            const chatId = params.path[1];
            this.#chatListCache.update(
                chat => chat.id === chatId,
                chat => {
                    return {
                        ...chat,
                        id: chatId,
                        metadata: {
                            ...chat?.metadata,
                            ...params.entries
                        }
                    };
                }
            );
        }
    }

    async getMetadataAsync(params: types.GetMetadataParams): Promise<types.GetMetadataResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const metadata = await this.#rpcClient.makeRequestAsync<types.GetMetadataParams, types.GetMetadataResult>(
            'getMetadata', params);
        if (params.path[0] === 'model') {
            const modelId = params.path[1];
            this.#cache.update<types.GetModelListResult>(list => {
                const model = list?.find(m => m.id === modelId);
                if (model !== undefined) {
                    model.metadata = {
                        ...model.metadata,
                        ...metadata
                    };
                }
                return list ?? [];
            }, ['modelList']);
        }
        else if (params.path[0] === 'userPublic') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]) ?? list?.find(u => u.isSelf);
                if (user !== undefined) {
                    user.publicMetadata = {
                        ...user.publicMetadata,
                        ...metadata
                    };
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'userAdmin') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]);
                if (user !== undefined) {
                    user.adminMetadata = {
                        ...user.adminMetadata,
                        ...metadata
                    };
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'chat') {
            const chatId = params.path[1];
            this.#chatListCache.update(
                chat => chat.id === chatId,
                chat => {
                    return {
                        ...chat,
                        id: chatId,
                        metadata: {
                            ...chat?.metadata,
                            ...metadata
                        }
                    };
                }
            );
        }
        return metadata;
    }
    
    async deleteMetadataAsync(params: types.DeleteMetadataParams): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        await this.#rpcClient.makeRequestAsync<types.DeleteMetadataParams, void>(
            'deleteMetadata', params);
        if (params.path[0] === 'model') {
            const modelId = params.path[1];
            this.#cache.update<types.GetModelListResult>(list => {
                const model = list?.find(m => m.id === modelId);
                if (model?.metadata !== undefined) {
                    for (const key of params.keys) {
                        delete model.metadata[key];
                    }
                }
                return list ?? [];
            }, ['modelList']);
        }
        else if (params.path[0] === 'userPublic') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]) ?? list?.find(u => u.isSelf);
                if (user?.publicMetadata !== undefined) {
                    for (const key of params.keys) {
                        delete user.publicMetadata[key];
                    }
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'userAdmin') {
            this.#cache.update<types.GetUserListResult>(list => {
                const user = list?.find(u => u.id === params.path[1]);
                if (user?.adminMetadata !== undefined) {
                    for (const key of params.keys) {
                        delete user.adminMetadata[key];
                    }
                }
                return list ?? [];
            }, ['userList']);
        }
        else if (params.path[0] === 'chat') {
            const chatId = params.path[1];
            this.#chatListCache.update(
                chat => chat.id === chatId,
                chat => {
                    if (chat?.metadata !== undefined) {
                        for (const key of params.keys) {
                            delete chat.metadata[key];
                        }
                    }
                    return {
                        ...chat,
                        id: chatId,
                        metadata: {
                            ...chat?.metadata,
                        }
                    };
                }
            );
        }
    }
}
