export function isSecureContext(): boolean {
    if (typeof window !== 'undefined' && window.location) {
        return window.location.protocol === 'https:';
    }
    return false;
}
