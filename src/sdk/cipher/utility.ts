export function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
        throw new TypeError("Both arguments must be Uint8Array");
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
