import { TUIClient } from "@/sdk/tui-client"

export class TUIClientSingleton {
    static #instance: TUIClient | undefined = undefined;
    static get(): TUIClient {
        if (!this.#instance) {
            throw new Error("TUIClient instance is not created.")
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
