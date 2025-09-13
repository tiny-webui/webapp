import { ErrorCode } from '../types/Rpc';
import { RequestError } from './rpc';

export class ResourceCache {
    #cache: Map<string, unknown> = new Map();

    async getAsync<T, Args extends unknown[]>(
        getter: (...args: Args) => Promise<T>, 
        resourceKey: string[], 
        ...args: Args
    ): Promise<T> {
        const key = this.#getKey(resourceKey);
        let value: T|undefined;
        try {
            value = await getter(...args);
            this.#cache.set(key, value);
            return value;
        } catch (error) {
            if (error instanceof RequestError && error.code === ErrorCode.NOT_MODIFIED) {
                value = this.#cache.get(key) as T|undefined;
                if (value === undefined) {
                    throw new RequestError(-1, 'Cache error');
                }
                return value;
            } else {
                throw error;
            }
        }
    }

    update<T>(
        updater: (value: T | undefined) => T,
        resourceKey: string[]
    ): void {
        const key = this.#getKey(resourceKey);
        const value = this.#cache.get(key) as T;
        this.#cache.set(key, updater(value));
    }

    delete(resourceKey: string[]) {
        const key = this.#getKey(resourceKey);
        this.#cache.delete(key);
    }

    #getKey(resourceKey: string[]): string {
        /** Avoid collision by escaping the segments */
        return JSON.stringify(resourceKey);
    }
}

export class PagedResourceCache<T> {
    /**
     * undefined: item not fetched
     * null: item fetched but not exists
     */
    #cache: (T|undefined|null)[] = [];

    async getAsync<Args extends unknown[]>(
        getter: (offset: number, quantity: number, ...args: Args) => Promise<T[]>,
        offset: number,
        quantity: number,
        ...args: Args
    ) {
        let result: T[];
        try {
            try {
                result = await getter(offset, quantity, ...args);
                if (offset === 0) {
                    /** The whole list changed, clear the cache */
                    this.#cache = [];
                }
                for (let i = 0; i < result.length; i++) {
                    this.#cache[offset + i] = result[i];
                }
                for (let i = result.length; i < quantity; i++) {
                    this.#cache[offset + i] = null;
                }
                return result;
            } catch (error) {
                if (error instanceof RequestError && error.code === ErrorCode.NOT_MODIFIED) {
                    /**
                     * This only happens when fetching from the head.
                     * And it means the whole list did not change since you last fetch the head.
                     * There can be items not fetched from the remote though. 
                     * Fetch any undefined segments in the requested range 
                     */
                    let missingStart: number|undefined = undefined;
                    for (let i = 0; i < quantity; i++) {
                        if (this.#cache[offset + i] === undefined && missingStart === undefined) {
                            missingStart = i;
                        } else if (missingStart !== undefined && (this.#cache[offset+i] !== undefined || i == quantity - 1)) {
                            const segment = await getter(offset + missingStart, i - missingStart, ...args);
                            for (let j = 0; j < segment.length; j++) {
                                this.#cache[offset + missingStart + j] = segment[j];
                            }
                            let endOfData = false;
                            for (let j = segment.length; j < (i - missingStart); j++) {
                                this.#cache[offset + missingStart + j] = null;
                                endOfData = true;
                            }
                            if (endOfData) {
                                break;
                            }
                            missingStart = undefined;
                        }
                    }
                    const result: T[] = [];
                    for (let i = 0; i < quantity; i++) {
                        const item = this.#cache[offset + i];
                        if (item !== undefined && item !== null) {
                            result.push(item);
                        }
                    }
                    return result;
                } else {
                    throw error;
                }
            }
        } catch (error) {
            if (error instanceof RequestError && error.code === ErrorCode.CONFLICT) {
                /**
                 * The cache is invalidated.
                 * This will happen on consecutive reads (not starting with 0) if the whole list changed.
                 */
                this.#cache = [];
            }
            throw error
        }
    }

    update(
        filter: (item: T) => boolean,
        updater: (item: T|undefined) => T
    ): void {
        const index = this.#cache.findIndex(item => item !== undefined && item !== null && filter(item));
        this.#cache[index] = updater(this.#cache[index] ?? undefined);
    }

    unshift(item: T): void {
        this.#cache.unshift(item);
    }

    delete(filter: (item: T) => boolean): void {
        this.#cache = this.#cache.filter(item=>item === undefined || item === null || !filter(item));
    }
}
