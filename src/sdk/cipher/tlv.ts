

/**
 * Elements are serialized in ascending order of their type.
 * The type and length values are serialized in little-endian format.
 */

export class Tlv<E extends number> {
    #elements: Map<E, Uint8Array>;
    #enumSize: number;
    #lengthSize: number;

    constructor(enumSize: number, lengthSize: number = 4, data?: Uint8Array) {
        this.#elements = new Map<E, Uint8Array>();
        this.#enumSize = enumSize;
        this.#lengthSize = lengthSize;
        if (data === undefined) {
            return;
        }

        let offset = 0;
        while (offset < data.length) {
            if (offset + enumSize + lengthSize > data.length) {
                throw new Error("Invalid TLV data: not enough data for type and length");
            }

            let typeValue = 0;
            for (let i = 0; i < enumSize; i++) {
                typeValue = (typeValue | (data[offset + i] << (i * 8))) >>> 0;
            }
            offset += enumSize;

            let valueLength = 0;
            for (let i = 0; i < lengthSize; i++) {
                valueLength = (valueLength | (data[offset + i] << (i * 8))) >>> 0;
            }
            offset += lengthSize;

            if (offset + valueLength > data.length) {
                throw new Error("Invalid TLV data: not enough data for value");
            }
            const value = data.slice(offset, offset + valueLength);

            this.#elements.set(typeValue as E, value);
            offset += valueLength;
        }
    }

    setElement(type: E, value: Uint8Array) {
        this.#elements.set(type, value);
    }

    getElement(type: E): Uint8Array | undefined {
        return this.#elements.get(type);
    }

    serialize(): Uint8Array {
        let totalSize = 0;
        for (const [, value] of this.#elements) {
            totalSize += this.#enumSize + this.#lengthSize + value.length;
        }

        const result = new Uint8Array(totalSize);
        let offset = 0;
        const sortedEntries = Array.from(this.#elements.entries()).sort((a, b) => a[0] - b[0]);
        for (const [type, value] of sortedEntries) {
            for (let i = 0; i < this.#enumSize; i++) {
                result[offset + i] = (type >>> (i * 8)) & 0xFF;
            }
            offset += this.#enumSize;

            const length = value.length;
            for (let i = 0; i < this.#lengthSize; i++) {
                result[offset + i] = (length >>> (i * 8)) & 0xFF;
            }
            offset += this.#lengthSize;

            result.set(value, offset);
            offset += value.length;
        }
        return result;
    }
};
