import { IConnection } from "./i-connection";
import WebSocket from 'isomorphic-ws';
import { isSecureContext } from "./secure-context";

export class Connection extends IConnection {
    #url: string;
    #ws: WebSocket | undefined;
    #messageQueue: Uint8Array[] = [];
    #messagePromiseResolve: ((value: Uint8Array|undefined) => void) | undefined;
    #messagePromiseReject: ((reason: unknown) => void) | undefined;
    #error: Error | undefined;

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
        await new Promise<void>((resolve, reject) => {
            this.#ws?.on('open', () => {
                resolve();
            });
            this.#ws?.on('error', (error) => {
                this.#ws = undefined;
                reject(error);
            });
        });
        this.#setHandlers();
    }

    #setHandlers() {
        this.#ws?.on('close', () => {
            this.#clearHandlers();
            this.#ws = undefined;
            if (this.#messagePromiseResolve) {
                const resolve = this.#messagePromiseResolve;
                this.#messagePromiseResolve = undefined;
                this.#messagePromiseReject = undefined;
                resolve(undefined);
            }
        });
        this.#ws?.on('error', (error) => {
            if (this.#messagePromiseReject) {
                const reject = this.#messagePromiseReject;
                this.#messagePromiseResolve = undefined;
                this.#messagePromiseReject = undefined;
                reject(error);
            } else {
                this.#error = error;
            }
        });
        this.#ws?.on('message', (data, isBinary) => {
            if (!isBinary) {
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
        });
    }

    #clearHandlers() {
        this.#ws?.removeAllListeners('close');
        this.#ws?.removeAllListeners('error');
        this.#ws?.removeAllListeners('message');
    }

    close(): void {
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
};
