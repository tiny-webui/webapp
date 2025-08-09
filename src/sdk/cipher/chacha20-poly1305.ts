import { sodium } from './sodium';
import { Counter } from './counter';

export const KEY_SIZE = sodium.crypto_aead_chacha20poly1305_IETF_KEYBYTES
export const NONCE_SIZE = sodium.crypto_aead_chacha20poly1305_IETF_NPUBBYTES;
export const TAG_SIZE = sodium.crypto_aead_chacha20poly1305_IETF_ABYTES;

export class Encryptor {
    #key: Uint8Array;
    #counter: Counter;

    constructor(key: Uint8Array) {
        this.#key = key;
        this.#counter = new Counter(NONCE_SIZE);
    }

    encrypt(plainText: Uint8Array) {
        /** Increment first so it starts with 1. */
        this.#counter.increment();
        const nonce = this.#counter.bytes;
        const output = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
            plainText, null, null, nonce, this.#key, null);
        const cipherText = new Uint8Array(nonce.length + output.length);
        cipherText.set(nonce, 0);
        cipherText.set(output, this.#counter.size);
        return cipherText;
    }
};

export class Decryptor {
    #key: Uint8Array;
    #counter: Counter;

    constructor(key: Uint8Array) {
        this.#key = key;
        this.#counter = new Counter(NONCE_SIZE);
    }

    decrypt(cipherText: Uint8Array) {
        if (cipherText.length < NONCE_SIZE + TAG_SIZE) {
            throw new Error('Cipher text too short');
        }
        const nonce = cipherText.slice(0, NONCE_SIZE);
        const incomingCounter = new Counter(nonce);
        if (incomingCounter.compare(this.#counter) <= 0) {
            throw new Error('Replay message detected');
        }
        const output = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
            null, cipherText.slice(NONCE_SIZE), null, nonce, this.#key, null);
        this.#counter = incomingCounter;
        return output;
    }
};
