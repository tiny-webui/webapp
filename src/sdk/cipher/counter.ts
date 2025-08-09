export class Counter {
    #bytes: Uint8Array;

    constructor(params: number | Uint8Array) {
        if (params instanceof Uint8Array) {
            this.#bytes = params;
        } else {
            this.#bytes = new Uint8Array(params);
            this.#bytes.fill(0);
        }
    }

    increment() {
        for (let i = 0; i < this.#bytes.length; i++) {
            this.#bytes[i]++;
            if (this.#bytes[i] !== 0) {
                return;
            }
        }
        throw new Error('Counter overflow');
    }

    compare(other: Counter): number {
        if (this.#bytes.length !== other.#bytes.length) {
            throw new Error('Counter size mismatch');
        }
        for (let i = this.#bytes.length - 1; i >= 0; i--) {
            if (this.#bytes[i] < other.#bytes[i]) {
                return -1;
            }
            if (this.#bytes[i] > other.#bytes[i]) {
                return 1;
            }
        }
        return 0;
    }

    get bytes(): Uint8Array {
        return this.#bytes;
    }

    get size(): number {
        return this.#bytes.length;
    }
};