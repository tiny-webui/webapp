import { TUIClient } from "@/sdk/tui-client"

export class TUIClientSingleton {
    static #instance: TUIClient | undefined = undefined;
    static get(): TUIClient {
        if (!this.#instance) {
            if (typeof window !== undefined && window.location.pathname !== '/auth/sign-in') {
                window.location.replace('/auth/sign-in');
            }
            throw new Error("TUIClient instance does not exist.");
        }
        return this.#instance;
    }
    static create(
        ...args: ConstructorParameters<typeof TUIClient>
    ): TUIClient {
        if (this.#instance) {
            throw new Error("TUIClient instance already exists.")
        }
        this.#instance = new TUIClient(...args);
        return this.#instance;
    }
    static exists(): boolean {
        return this.#instance !== undefined;
    }
}
