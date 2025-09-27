export function objectsAreEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== typeof b) {
        return false;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        const aKeys = Object.keys(a as Record<string, unknown>);
        const bKeys = Object.keys(b as Record<string, unknown>);
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        for (const key of aKeys) {
            if (!bKeys.includes(key)) {
                return false;
            }
            if (!objectsAreEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
                return false;
            }
        }
    }
    if (a !== b) {
        return false;
    }
    return true;
}

export function tryGetProperty(obj: unknown, key: string, type: 'string'): string | undefined;
export function tryGetProperty(obj: unknown, key: string, type: 'number'): number | undefined;
export function tryGetProperty(obj: unknown, key: string, type: 'boolean'): boolean | undefined;
export function tryGetProperty(obj: unknown, key: string, type: 'object'): Record<string, unknown> | undefined;
export function tryGetProperty(
    obj: unknown,
    key: string,
    type: 'string' | 'number' | 'boolean' | 'object'
): unknown {
    if (typeof obj !== 'object' || obj === null) {
        return undefined;
    }
    const value = (obj as Record<string, unknown>)[key];
    switch (type) {
        case 'object':
            return (value !== null && typeof value === 'object') ? value as Record<string, unknown> : undefined;
        default:
            return typeof value === type ? value : undefined;
    }
}