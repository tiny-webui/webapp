import { sodium } from "./sodium";

export class PriKey {
    static SIZE = sodium.crypto_core_ed25519_SCALARBYTES;
    static KEY_MATERIAL_SIZE = sodium.crypto_core_ed25519_NONREDUCEDSCALARBYTES;

    static generate(): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_random());
    }

    static reduce(bn: Uint8Array): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_reduce(bn));
    }

    #bytes: Uint8Array;

    constructor(key: Uint8Array) {
        this.#bytes = key;
    }

    dump(): Uint8Array {
        return this.#bytes;
    }

    getPubKey(): PubKey {
        return new PubKey(sodium.crypto_scalarmult_ed25519_base_noclamp(this.#bytes));
    };

    complement(): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_complement(this.#bytes));
    };

    inverse(): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_invert(this.#bytes));
    };

    negate(): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_negate(this.#bytes));
    };

    add(other: PriKey): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_add(this.#bytes, other.#bytes));
    };

    sub(other: PriKey): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_sub(this.#bytes, other.#bytes));
    }

    mul(other: PriKey): PriKey {
        return new PriKey(sodium.crypto_core_ed25519_scalar_mul(this.#bytes, other.#bytes));
    };

    mulPubKey(other: PubKey): PubKey {
        return new PubKey(sodium.crypto_scalarmult_ed25519_noclamp(this.#bytes, other.dump()));
    };

    mulPoint = this.mulPubKey;
};

export class PubKey {
    static SIZE = sodium.crypto_core_ed25519_BYTES;

    static generate(): PubKey {
        while(true) {
            const bytes = sodium.crypto_core_ed25519_random();
            if (sodium.crypto_core_ed25519_is_valid_point(bytes)) {
                return new PubKey(bytes);
            }
        }
    };

    #bytes: Uint8Array;

    constructor(key: Uint8Array) {
        this.#bytes = key;
    }

    dump(): Uint8Array {
        return this.#bytes;
    }

    add(other: PubKey): PubKey {
        return new PubKey(sodium.crypto_core_ed25519_add(this.#bytes, other.#bytes));
    }

    sub(other: PubKey): PubKey {
        return new PubKey(sodium.crypto_core_ed25519_sub(this.#bytes, other.#bytes));
    }

    equal(other: PubKey): boolean {
        return sodium.memcmp(this.#bytes, other.#bytes);
    }
};

export { PriKey as Scalar };
export { PubKey as Point };

const cofactorBytes = new Uint8Array([
    0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

export function getCofactor(): PriKey {
    return new PriKey(cofactorBytes);
}
