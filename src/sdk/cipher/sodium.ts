import _sodium from 'libsodium-wrappers';

/** Let's hope this works in browsers */
await _sodium.ready;

export const sodium = _sodium;
