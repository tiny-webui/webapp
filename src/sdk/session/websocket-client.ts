import { IConnection } from "./i-connection";
import { isSecureContext } from "./secure-context";

export class Connection extends IConnection {
    static readonly #KEEP_ALIVE_INTERNAL_MS = 10_000;

    #url: string;
    #ws: WebSocket | undefined;
    #messageQueue: Uint8Array[] = [];
    #messagePromiseResolve: ((value: Uint8Array|undefined) => void) | undefined;
    #messagePromiseReject: ((reason: unknown) => void) | undefined;
    #error: Event | undefined = undefined;
    #keepAliveTimer: ReturnType<typeof setTimeout> | undefined = undefined;

    /**
     * @param url The URL without ws:// or wss:// prefix
     */
    constructor(url: string) {
        super();
        if (isSecureContext()) {
            this.#url = `wss://${url}`;
        } else {
            this.#url = `ws://${url}`;
        }
    }

    async connectAsync(): Promise<void> {
        if (this.#ws !== undefined) {
            throw new Error("Connection is already open");
        }
        this.#ws = new WebSocket(this.#url);
        this.#ws.binaryType = 'arraybuffer';
        await new Promise<void>((resolve, reject) => {
            this.#ws!.onopen = () => {
                resolve();
            };
            this.#ws!.onerror = (error) => {
                this.#ws = undefined;
                reject(error);
            };
        });
        this.#setHandlers();
        this.#scheduleKeepAlive();
    }

    #setHandlers() {
        if (this.#ws === undefined) {
            return;
        }
        this.#ws.onclose = () => {
            clearTimeout(this.#keepAliveTimer);
            this.#clearHandlers();
            this.#ws = undefined;
            if (this.#messagePromiseResolve) {
                const resolve = this.#messagePromiseResolve;
                this.#messagePromiseResolve = undefined;
                this.#messagePromiseReject = undefined;
                resolve(undefined);
            }
        };
        this.#ws.onerror = (error) => {
            if (this.#messagePromiseReject) {
                const reject = this.#messagePromiseReject;
                this.#messagePromiseResolve = undefined;
                this.#messagePromiseReject = undefined;
                reject(error);
            } else {
                this.#error = error;
            }
        };
        this.#ws.onmessage = (event) => {
            let data = event.data;
            if (typeof data === 'string') {
                /** Only use binary data */
                return;
            }
            if (Array.isArray(data)) {
                data = Buffer.concat(data);
            }
            if (this.#messagePromiseResolve) {
                const resolve = this.#messagePromiseResolve;
                this.#messagePromiseResolve = undefined;
                this.#messagePromiseReject = undefined;
                resolve(new Uint8Array(data));
            } else {
                this.#messageQueue.push(new Uint8Array(data));
            }
        };
    }

    #clearHandlers() {
        if (this.#ws === undefined) {
            return;
        }
        this.#ws.onopen = null;
        this.#ws.onclose = null;
        this.#ws.onerror = null;
        this.#ws.onmessage = null;
    }

    close(): void {
        clearTimeout(this.#keepAliveTimer);
        this.#clearHandlers();
        this.#ws?.close();
        this.#ws = undefined;
        if (this.#messagePromiseResolve) {
            const resolve = this.#messagePromiseResolve;
            this.#messagePromiseResolve = undefined;
            this.#messagePromiseReject = undefined;
            resolve(undefined);
        }
    }

    isClosed(): boolean {
        return this.#ws === undefined;
    }

    send(data: Uint8Array): void {
        if (this.#ws === undefined) {
            throw new Error("Connection is closed");
        }
        this.#ws.send(data);
    }

    async receiveAsync(): Promise<Uint8Array | undefined> {
        if (this.#messageQueue.length > 0) {
            return this.#messageQueue.shift();
        }
        if (this.#error) {
            const error = this.#error;
            this.#error = undefined;
            throw error;
        }
        if (this.#ws === undefined) {
            return undefined;
        }
        return new Promise<Uint8Array | undefined>((resolve, reject) => {
            this.#messagePromiseResolve = resolve;
            this.#messagePromiseReject = reject;
        });
    }

    #scheduleKeepAlive() {
        this.#keepAliveTimer = setTimeout(() => {
            this.#keepAliveTimer = undefined;
            if (this.#ws === undefined) {
                return;
            }
            this.#scheduleKeepAlive();
            /**
             * Use text message for keepalive. As they will be silently discarded.
             * This is only for avoiding idling. Not for detecting broken connection.
             * Thus, it is unidirectional. Do not expect the server to respond.
             */
            this.#ws.send('ka');
        }, Connection.#KEEP_ALIVE_INTERNAL_MS);
    }
};
