import { IConnection } from "../session/i-connection";
import * as IRpc from "../types/Rpc";

export class RequestError extends Error {
    code: number;
    constructor(code: number, message: string) {
        super(message);
        this.code = code;
    }
};

type PendingRequest = {
    timeoutHandle: ReturnType<typeof setTimeout>;
    resolve: (value: unknown) => void;
    reject: (error: RequestError) => void;
};

type PendingStreamRequest = {
    timeoutHandle?: ReturnType<typeof setTimeout>;
    resolve?: () => void;
    messageQueue: Array<{value: unknown, end?: boolean}>;
    error?: RequestError;
};

export class Client {
    #connection: IConnection;
    #onDisconnect: (() => void) | undefined;
    #onCriticalError: ((error: unknown) => void);
    #idSeed: number = 0;
    #textEncoder = new TextEncoder();
    #textDecoder = new TextDecoder('utf-8');
    #pendingRequests: Map<number, PendingRequest> = new Map();
    #pendingStreamRequests: Map<number, PendingStreamRequest> = new Map();

    constructor(
        connection: IConnection, 
        onDisconnect: () => void,
        onCriticalError: (error: unknown) => void
    ) {
        this.#connection = connection;
        this.#onDisconnect = onDisconnect;
        this.#onCriticalError = onCriticalError;
    }

    async connectAsync(): Promise<void> {
        await this.#connection.connectAsync();
        /** Fire message handling loop */
        this.#handleMessagesAsync();
    }

    close(): void {
        this.#connection.close();
    }

    async makeRequestAsync<TRequest, TResponse>(method: string, params: TRequest, timeoutMs = 30000): Promise<TResponse> {
        const id = await this.#sendRequest(method, params);
        return new Promise<TResponse>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.#pendingRequests.delete(id);
                reject(new RequestError(-1, "Request timeout"));
            }, timeoutMs);
            this.#pendingRequests.set(id, { 
                timeoutHandle,
                resolve: resolve as (v: unknown) => void,
                reject
            });
        });
    }

    async * makeStreamRequestAsync<TRequest, TSegment, TFinalResponse>(
        method: string,
        params: TRequest,
        timeoutMs: number = 30000
    ) : AsyncGenerator<TSegment, TFinalResponse, void> {
        const id = await this.#sendRequest(method, params);
        const request: PendingStreamRequest = {
            messageQueue: []
        };
        this.#pendingStreamRequests.set(id, request);
        while (true) {
            request.timeoutHandle = setTimeout(() => {
                this.#pendingStreamRequests.delete(id);
                request.error = new RequestError(-1, "Request timeout");
                request.resolve?.();
            }, timeoutMs);
            await new Promise<void>((resolve) => {
                request.resolve = resolve;
            });
            let response: {value: unknown, end?:boolean} | undefined = undefined;
            while ((response = request.messageQueue.shift()) !== undefined) {
                if (response.end === true) {
                    return response.value as TFinalResponse;
                } else {
                    yield response.value as TSegment;
                }
            }
            if (request.error !== undefined) {
                throw request.error;
            }
        }
    }

    async #sendRequest<TRequest>(method: string, params: TRequest): Promise<number> {
        if (this.#connection.isClosed()) {
            /** Try reconnect */
            await this.connectAsync();
        }
        const id = this.#idSeed++;
        if (this.#idSeed === Number.MAX_SAFE_INTEGER) {
            this.#idSeed = 0;
        }
        const request: IRpc.Request = {
            id,
            method,
            params
        };
        const requestData = this.#textEncoder.encode(JSON.stringify(request));
        this.#connection.send(requestData);
        return id;
    }

    async #handleMessagesAsync(): Promise<void> {
        try {
            while (true) {
                const data = await this.#connection.receiveAsync();
                if (data === undefined) {
                    this.#onDisconnect?.();
                    break;
                }
                let response: IRpc.Response | IRpc.ErrorResponse | IRpc.StreamEndResponse;
                try {
                    response = JSON.parse(this.#textDecoder.decode(data));
                } catch {
                    /** ignore invalid message */
                    continue;
                }
                if (!('id' in response) || (!(Number.isInteger(response.id)))) {
                    /** ignore invalid message */
                    continue;
                }
                const id = response.id;
                {
                    const request = this.#pendingRequests.get(id);
                    if (request !== undefined) {
                        this.#pendingRequests.delete(id);
                        clearTimeout(request.timeoutHandle);
                        if ('error' in response) {
                            request.reject(new RequestError(
                                response.error.code ?? -1,
                                response.error.message ?? "Unknown error"));
                        } else if ('result' in response) {
                            request.resolve(response.result);
                        } else {
                            request.reject(new RequestError(-1, "Invalid response"));
                        }
                        continue;
                    }
                }
                {
                    const request = this.#pendingStreamRequests.get(id);
                    if (request !== undefined) {
                        clearTimeout(request.timeoutHandle);
                        if ('error' in response) {
                            this.#pendingStreamRequests.delete(id);
                            request.error = new RequestError(
                                response.error.code ?? -1,
                                response.error.message ?? "Unknown error");
                            request.resolve?.();
                        } else if ('result' in response) {
                            if ('end' in response && response.end === true) {
                                this.#pendingStreamRequests.delete(id);
                                request.messageQueue.push({value: response.result, end: true});
                                request.resolve?.();
                            } else {
                                request.messageQueue.push({value: response.result});
                                request.resolve?.();
                            }
                        } else {
                            this.#pendingStreamRequests.delete(id);
                            request.error = new RequestError(-1, "Invalid response");
                            request.resolve?.();
                        }
                        continue;
                    }
                }
            }
        } catch (error) {
            this.#onCriticalError?.(error);
        }
    }
};
