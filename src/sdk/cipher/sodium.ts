import _sodium from 'libsodium-wrappers-sumo';

/** Let's hope this works in browsers */
await _sodium.ready;

export const sodium = _sodium;

/**
 * These functions are missing in the libsodium.js binding.
 * So we need to implement them before the binding gets fixed.
 * See:
 * https://github.com/jedisct1/libsodium.js/issues/335
 */

export const crypto_kdf_hkdf_sha256_KEYBYTES = 32;

/**
 * @warning This implementation limits the salt length to 32 bytes.
 *     This is not required by HKDF. But a limitation of the crypto_auth_hmacsha256 function.
 * 
 * @param salt 
 * @param ikm 
 * @returns 
 */
export function crypto_kdf_hkdf_sha256_extract(
    salt: Uint8Array,
    ikm: Uint8Array
): Uint8Array {
    return sodium.crypto_auth_hmacsha256(ikm, salt);
}

export function crypto_kdf_hkdf_sha256_expand(
    length: number,
    ctx: Uint8Array | string,
    prk: Uint8Array
): Uint8Array {
    if (typeof ctx === "string") {
        ctx = new TextEncoder().encode(ctx);
    }
    if (prk.length !== crypto_kdf_hkdf_sha256_KEYBYTES) {
        throw new Error(`Invalid prk length: expected ${crypto_kdf_hkdf_sha256_KEYBYTES}, got ${prk.length}`);
    }
    const hashLen = sodium.crypto_auth_hmacsha256_BYTES;
    const maxOutLen = 255 * hashLen; // HKDF can produce at most 255 * HashLen bytes
    if (length > maxOutLen) {
        throw new Error(`Output length too large: maximum is ${maxOutLen}, got ${length}`);
    }

    const out = new Uint8Array(length);
    let counter = 1;
    let previousBlock = new Uint8Array(0);
    for (let i = 0; i < length; i += hashLen) {
        /** For each block: T(i) = HMAC(PRK, T(i-1) || info || counter) */ 
        const blockInput = new Uint8Array(previousBlock.length + ctx.length + 1);
        blockInput.set(previousBlock, 0);
        blockInput.set(ctx, previousBlock.length);
        blockInput[previousBlock.length + ctx.length] = counter;
        const block = sodium.crypto_auth_hmacsha256(blockInput, prk);
        const bytesToCopy = Math.min(hashLen, length - i);
        out.set(block.subarray(0, bytesToCopy), i);
        previousBlock = Uint8Array.from(block);
        counter++;
    }
    
    return out;
}
