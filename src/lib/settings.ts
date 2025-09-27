import { TUIClientSingleton } from "./tui-client-singleton";

class LocalSettingsClass {
    #getItem(key: string) : unknown {
        const valueStr = localStorage.getItem(key);
        if (valueStr === null) {
            return undefined;
        }
        return JSON.parse(valueStr);
    }
    #setItem(key: string, value: unknown) : void {
        localStorage.setItem(key, JSON.stringify(value));
    }

    get darkMode(): boolean {
        return this.#getItem("darkMode") as boolean ?? false;
    }

    set darkMode(value: boolean) {
        if (typeof value !== "boolean") {
            throw new Error("darkMode must be a boolean.");
        }
        this.#setItem("darkMode", value);
    }
};

class UserSettingsClass {
    #settings: {
        defaultModelId?: string;
    } = {};
    async fetchAsync(): Promise<void> {
        const result = await TUIClientSingleton.get().getMetadataAsync({
            keys: ['settings'],
            path: ['user']
        });
        this.#settings = result.settings ?? {}
    }
    async saveAsync(): Promise<void> {
        await TUIClientSingleton.get().setMetadataAsync({
            path: ['user'],
            entries: {
                settings: this.#settings
            }
        });
    }

    get defaultModelId(): string | undefined {
        return this.#settings.defaultModelId;
    }

    set defaultModelId(value: string | undefined) {
        if (value !== undefined && typeof value !== "string") {
            throw new Error("defaultModelId must be a string or undefined.");
        }
        this.#settings.defaultModelId = value;
    }
};

class GlobalSettingsClass {
    #settings: {
        titleGenerationModelId?: string;
    } = {};
    async fetchAsync(): Promise<void> {
        const result = await TUIClientSingleton.get().getMetadataAsync({
            path: ['global'],
            keys: ['settings']
        });
        this.#settings = result.settings ?? {}
    }
    async saveAsync(): Promise<void> {
        await TUIClientSingleton.get().setMetadataAsync({
            path: ['global'],
            entries: {
                settings: this.#settings
            }
        });
    }

    get titleGenerationModelId(): string | undefined {
        return this.#settings.titleGenerationModelId;
    }

    set titleGenerationModelId(value: string | undefined) {
        if (value !== undefined && typeof value !== "string") {
            throw new Error("titleGenerationModelId must be a string or undefined.");
        }
        this.#settings.titleGenerationModelId = value;
    }
};

export const LocalSettings = new LocalSettingsClass();
export const UserSettings = new UserSettingsClass();
export const GlobalSettings = new GlobalSettingsClass();
