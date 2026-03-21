import * as rpc from './app/rpc';
import * as secureSession from './session/secure-session'
import * as websocket from './session/websocket-client'
import * as types from './types/IServer';
import { PagedResourceCache, ResourceCache } from './app/resource-cache';

function Base64Encode(binary: Uint8Array): string {
    let binaryStr = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < binary.length; i += chunkSize) {
        binaryStr += String.fromCharCode(...binary.subarray(i, i + chunkSize));
    }
    return btoa(binaryStr);
}

function Base64Decode(base64: string): Uint8Array {
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const converted = padded.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(converted);
    const binary = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        binary[i] = binaryStr.charCodeAt(i);
    }
    return binary;
}

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

    #validateMessageContent(content: types.MessageContent): void {
        if (typeof content !== 'object' || content === null) {
            throw new rpc.RequestError(-1, "Invalid message content, should be an object");
        }
        if (content.type !== 'text' && content.type !== 'image_url' && content.type !== 'refusal') {
            throw new rpc.RequestError(-1, "Invalid message content, invalid type");
        }
        if (typeof content.data !== 'string') {
            throw new rpc.RequestError(-1, "Invalid message content, data should be a string");
        }
    }

    #validateMessage(message: types.Message): void {
        if (typeof message !== 'object' || message === null) {
            throw new rpc.RequestError(-1, "Invalid message, should be an object");
        }
        if ('role' in message) {
            if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'developer') {
                throw new rpc.RequestError(-1, "Invalid message, invalid role");
            }
            if (!Array.isArray(message.content)) {
                throw new rpc.RequestError(-1, "Invalid message, content should be an array");
            }
            for (const content of message.content) {
                this.#validateMessageContent(content);
            }
        } else if (message.type === 'function_call') {
            if (typeof message.call_id !== 'string') {
                throw new rpc.RequestError(-1, "Invalid message, call_id should be a string");
            }
            if (typeof message.name !== 'string') {
                throw new rpc.RequestError(-1, "Invalid message, name should be a string");
            }
            if (typeof message.arguments !== 'string') {
                throw new rpc.RequestError(-1, "Invalid message, arguments should be a string");
            }
        } else if (message.type === 'function_call_output') {
            if (typeof message.call_id !== 'string') {
                throw new rpc.RequestError(-1, "Invalid message, call_id should be a string");
            }
            if (!Array.isArray(message.output)) {
                throw new rpc.RequestError(-1, "Invalid message, output should be an array");
            }
            for (const content of message.output) {
                this.#validateMessageContent(content);
            }
        } else {
            throw new rpc.RequestError(-1, "Invalid message, unknown type");
        }
    }

    async * #chatCompletionAsync(params: types.ChatCompletionParams):
        AsyncGenerator<types.ChatCompletionSegment, types.ChatCompletionInfo, void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        /** Incrase timeout to 2min for thinking models. */
        const generator = this.#rpcClient.makeStreamRequestAsync<types.ChatCompletionParams, types.ChatCompletionSegment, types.ChatCompletionInfo>(
            'chatCompletion', params, 120_000);
        while (true) {
            const it = await generator.next();
            if (it.done === true) {
                if (typeof it.value !== 'object' || it.value === null) {
                    throw new rpc.RequestError(-1, "Invalid final response, value should be an object");
                }
                if (!Array.isArray(it.value.messageIds)) {
                    throw new rpc.RequestError(-1, "Invalid final response, messageIds should be an array");
                }
                for (const messageId of it.value.messageIds) {
                    if (typeof messageId !== 'string') {
                        throw new rpc.RequestError(-1, "Invalid final response, messageIds should be an array of strings");
                    }
                }
                return it.value;
            } else {
                if (typeof it.value !== 'string') {
                    if (typeof it.value !== 'object' || it.value === null) {
                        throw new rpc.RequestError(-1, "Invalid segment response, value should be a string or an object");
                    }
                    if (it.value.event === 'function_call_start') {
                        /** Empty case */
                    } else if (it.value.event === 'function_call_end') {
                        if (typeof it.value.data !== 'object' || it.value.data === null) {
                            throw new rpc.RequestError(-1, "Invalid segment response, data should be an object");
                        }
                        if (it.value.data.type !== 'function_call') {
                            throw new rpc.RequestError(-1, "Invalid segment response, data.type should be 'function_call'");
                        }
                        if (typeof it.value.data.call_id !== 'string') {
                            throw new rpc.RequestError(-1, "Invalid segment response, data.call_id should be a string");
                        }
                        if (typeof it.value.data.name !== 'string') {
                            throw new rpc.RequestError(-1, "Invalid segment response, data.name should be a string");
                        }
                        if (typeof it.value.data.arguments !== 'string') {
                            throw new rpc.RequestError(-1, "Invalid segment response, data.arguments should be a string");
                        }
                    } else {
                        throw new rpc.RequestError(-1, "Invalid segment response, unknown event type");
                    }
                }
                yield it.value;
            }
        }
    }

    async * chatCompletionAsync(params: types.ChatCompletionParams):
        AsyncGenerator<types.ChatCompletionSegment, types.ChatCompletionInfo, void> {
        const requestMessageTimestamp = Date.now();
        const generatedMessages: Array<types.Message> = [];
        let assistantMessageContent: string = '';
        const generator = this.#chatCompletionAsync(params);
        while (true) {
            const it = await generator.next();
            if (it.done === true) {
                if (assistantMessageContent.length !== 0) {
                    generatedMessages.push({
                        role: 'assistant',
                        content: [{
                            type: 'text',
                            data: assistantMessageContent
                        }]
                    });
                }
                if (params.messages.length + generatedMessages.length !== it.value.messageIds.length) {
                    throw new rpc.RequestError(-1, "Invalid final response, messageIds length should be equal to the sum of input messages and generated messages");
                }

                this.#cache.update<types.TreeHistory>((history) => {
                    history = history ?? { nodes: {} } as types.TreeHistory;
                    if (params.parent !== undefined) {
                        const parent = history.nodes[params.parent];
                        parent?.children.push(it.value.messageIds[0]);
                    }
                    let i = 0;
                    const allMessages = [...params.messages, ...generatedMessages];
                    for (const message of allMessages) {
                        history.nodes[it.value.messageIds[i]] = {
                            id: it.value.messageIds[i],
                            message: message,
                            parent: i === 0 ? params.parent : it.value.messageIds[i - 1],
                            children: i === allMessages.length - 1 ? [] : [it.value.messageIds[i + 1]],
                            timestamp: i < params.messages.length ? requestMessageTimestamp : Date.now()
                        }
                        i++;
                    }
                    return history;
                }, ['chat', params.id]);
                return it.value;
            } else {
                if (typeof it.value === 'string') {
                    assistantMessageContent += it.value;
                } else if (it.value.event === 'function_call_start') {
                    if (assistantMessageContent.length !== 0) {
                        generatedMessages.push({
                            role: 'assistant',
                            content: [{
                                type: 'text',
                                data: assistantMessageContent
                            }]
                        });
                    }
                    assistantMessageContent = '';
                } else {
                    generatedMessages.push({
                        type: 'function_call',
                        call_id: it.value.data.call_id,
                        name: it.value.data.name,
                        arguments: it.value.data.arguments,
                        extra: it.value.data.extra
                    });
                }
                yield it.value;
            }
        }
    }

    async executeGenerationTaskAsync(params: types.executeGenerationTaskParams): Promise<types.executeGenerationTaskResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.executeGenerationTaskParams, types.executeGenerationTaskResult>(
            'executeGenerationTask', params);
        if (typeof result !== 'object' || result === null) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an object");
        }
        if (!Array.isArray(result.messages)) {
            throw new rpc.RequestError(-1, "Invalid response, messages should be an array");
        }
        for (const message of result.messages) {
            this.#validateMessage(message);
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

    async putFileAsync(params: {
        content: Uint8Array;
        metadata: unknown;
    }): Promise<types.PutFileResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const contentBase64 = Base64Encode(params.content);
        const result = await this.#rpcClient.makeRequestAsync<types.PutFileParams, types.PutFileResult>('putFile', {
            fileMetadata: params.metadata,
            contentBase64: contentBase64
        });
        if (typeof result.fileId !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, fileId should be a string");
        }
        if (typeof result.contentId !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, contentId should be a string");
        }
        this.#cache.update<types.GetFileMetaResult>(() => {
            return {
                contentId: result.contentId,
                fileMetadata: params.metadata,
            }
        }, ['fileMeta', result.fileId]);
        this.#cache.update<Uint8Array>(value => {
            if (value !== undefined) {
                return value;
            }
            return params.content;
        }, ['fileContent', result.contentId]);
        this.#cache.update<types.ListFileResult>(list => {
            list = list ?? [];
            list.unshift({
                fileId: result.fileId,
                contentId: result.contentId,
                fileMetadata: params.metadata,
            });
            return list;
        }, ['fileList']);
        return result;
    }

    async #getFileMetaAsync(params: types.GetFileMetaParams): Promise<types.GetFileMetaResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.GetFileMetaParams, types.GetFileMetaResult>(
            'getFileMeta', params);
        if (typeof result.contentId !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, contentId should be a string");
        }
        if (typeof result.fileMetadata !== 'object' || result.fileMetadata === null) {
            throw new rpc.RequestError(-1, "Invalid response, fileMetadata should be an object");
        }
        return result;
    }

    async getFileMetaAsync(params: types.GetFileMetaParams): Promise<types.GetFileMetaResult> {
        /** The file list content will not change because of this. Since the elements are constants. */
        return await this.#cache.getConstAsync(this.#getFileMetaAsync.bind(this), ['fileMeta', params.fileId], params);
    }

    async #getFileContentAsync(params: types.GetFileContentParams): Promise<Uint8Array> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<types.GetFileContentParams, types.GetFileContentResult>(
            'getFileContent', params);
        if (typeof result.contentBase64 !== 'string') {
            throw new rpc.RequestError(-1, "Invalid response, contentBase64 should be a string");
        }
        const content = Base64Decode(result.contentBase64);
        this.#cache.update<Uint8Array>(() => {
            return content;
        }, ['fileContent', params.contentId]);
        return content;
    }

    async getFileContentAsync(params: types.GetFileContentParams): Promise<{ content: Uint8Array; }> {
        const content = await this.#cache.getConstAsync(this.#getFileContentAsync.bind(this), ['fileContent', params.contentId], params);
        return { content };
    }

    async deleteFileAsync(params: types.DeleteFileParams): Promise<void> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const contentId = (await this.getFileMetaAsync({ fileId: params.fileId })).contentId;
        await this.#rpcClient.makeRequestAsync<types.DeleteFileParams, void>(
            'deleteFile', params);
        this.#cache.delete(['fileMeta', params.fileId]);
        this.#cache.update<types.ListFileResult>(list => {
            list = list ?? [];
            return list.filter(file => file.fileId !== params.fileId);
        }, ['fileList']);
        /** Check with the latest list to decide if content cache should be cleared. */
        const fileList = await this.#cache.getAsync(this.#listFileAsync.bind(this), ['fileList']);
        if (fileList.find(file => file.contentId === contentId) === undefined) {
            this.#cache.delete(['fileContent', contentId]);
        }
    }

    async #listFileAsync(): Promise<types.ListFileResult> {
        if (this.#rpcClient === undefined) {
            throw new rpc.RequestError(-1, "client not connected");
        }
        const result = await this.#rpcClient.makeRequestAsync<void, types.ListFileResult>(
            'listFile', undefined);
        if (!Array.isArray(result)) {
            throw new rpc.RequestError(-1, "Invalid response, result should be an array");
        }
        for (const item of result) {
            if (typeof item.fileId !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, fileId should be a string");
            }
            if (typeof item.contentId !== 'string') {
                throw new rpc.RequestError(-1, "Invalid response, contentId should be a string");
            }
            if (typeof item.fileMetadata !== 'object' || item.fileMetadata === null) {
                throw new rpc.RequestError(-1, "Invalid response, fileMetadata should be an object");
            }
        }
        return result;
    }

    async listFileAsync(): Promise<types.ListFileResult> {
        return await this.#cache.getAsync(this.#listFileAsync.bind(this), ['fileList']);
    }
}
