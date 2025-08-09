import { Tlv } from '../../../../src/sdk/cipher/tlv';

describe('Tlv', () => {
    describe('constructor', () => {
        test('should create instance with default length size', () => {
            const tlv = new Tlv(2);
            expect(tlv).toBeInstanceOf(Tlv);
        });

        test('should create instance with custom length size', () => {
            const tlv = new Tlv(2, 2);
            expect(tlv).toBeInstanceOf(Tlv);
        });
    });

    describe('setElement and getElement', () => {
        test('should set and get element', () => {
            const tlv = new Tlv<number>(2, 4);
            const value = new Uint8Array([1, 2, 3, 4]);
            
            tlv.setElement(5, value);
            const retrieved = tlv.getElement(5);
            
            expect(retrieved).toEqual(value);
        });

        test('should return undefined for non-existent element', () => {
            const tlv = new Tlv<number>(2, 4);
            
            const retrieved = tlv.getElement(99);
            
            expect(retrieved).toBeUndefined();
        });

        test('should overwrite existing element', () => {
            const tlv = new Tlv<number>(2, 4);
            const value1 = new Uint8Array([1, 2, 3]);
            const value2 = new Uint8Array([4, 5, 6, 7]);
            
            tlv.setElement(5, value1);
            tlv.setElement(5, value2);
            
            expect(tlv.getElement(5)).toEqual(value2);
        });
    });

    describe('serialize', () => {
        test('should serialize single element correctly', () => {
            const tlv = new Tlv<number>(2, 4);
            const value = new Uint8Array([0xAA, 0xBB, 0xCC]);
            tlv.setElement(0x1234, value);
            
            const serialized = tlv.serialize();
            
            // Expected: type (2 bytes, little-endian) + length (4 bytes, little-endian) + value (3 bytes)
            const expected = new Uint8Array([
                0x34, 0x12, // type 0x1234 in little-endian
                0x03, 0x00, 0x00, 0x00, // length 3 in little-endian
                0xAA, 0xBB, 0xCC // value
            ]);
            
            expect(serialized).toEqual(expected);
        });

        test('should serialize multiple elements in ascending order', () => {
            const tlv = new Tlv<number>(1, 2);
            const value1 = new Uint8Array([0x11]);
            const value2 = new Uint8Array([0x22, 0x33]);
            const value3 = new Uint8Array([0x44, 0x55, 0x66]);
            
            // Add in non-ascending order to test sorting
            tlv.setElement(3, value3);
            tlv.setElement(1, value1);
            tlv.setElement(2, value2);
            
            const serialized = tlv.serialize();
            
            // Expected: elements sorted by type (1, 2, 3)
            const expected = new Uint8Array([
                // Element type 1
                0x01, // type 1
                0x01, 0x00, // length 1 in little-endian
                0x11, // value
                
                // Element type 2
                0x02, // type 2
                0x02, 0x00, // length 2 in little-endian
                0x22, 0x33, // value
                
                // Element type 3
                0x03, // type 3
                0x03, 0x00, // length 3 in little-endian
                0x44, 0x55, 0x66 // value
            ]);
            
            expect(serialized).toEqual(expected);
        });

        test('should serialize empty TLV as empty array', () => {
            const tlv = new Tlv<number>(2, 4);
            
            const serialized = tlv.serialize();
            
            expect(serialized).toEqual(new Uint8Array(0));
        });

        test('should handle zero-length values', () => {
            const tlv = new Tlv<number>(1, 1);
            const emptyValue = new Uint8Array(0);
            tlv.setElement(5, emptyValue);
            
            const serialized = tlv.serialize();
            
            const expected = new Uint8Array([
                0x05, // type 5
                0x00, // length 0
                // no value bytes
            ]);
            
            expect(serialized).toEqual(expected);
        });
    });

    describe('parse', () => {
        test('should parse single element correctly', () => {
            const data = new Uint8Array([
                0x34, 0x12, // type 0x1234 in little-endian
                0x03, 0x00, 0x00, 0x00, // length 3 in little-endian
                0xAA, 0xBB, 0xCC // value
            ]);
            
            const tlv = new Tlv<number>(2, 4, data);
            
            const retrieved = tlv.getElement(0x1234);
            expect(retrieved).toEqual(new Uint8Array([0xAA, 0xBB, 0xCC]));
        });

        test('should parse multiple elements correctly', () => {
            const data = new Uint8Array([
                // Element type 1
                0x01, // type 1
                0x01, 0x00, // length 1 in little-endian
                0x11, // value
                
                // Element type 2
                0x02, // type 2
                0x02, 0x00, // length 2 in little-endian
                0x22, 0x33, // value
                
                // Element type 3
                0x03, // type 3
                0x03, 0x00, // length 3 in little-endian
                0x44, 0x55, 0x66 // value
            ]);
            
            const tlv = new Tlv<number>(1, 2, data);
            
            expect(tlv.getElement(1)).toEqual(new Uint8Array([0x11]));
            expect(tlv.getElement(2)).toEqual(new Uint8Array([0x22, 0x33]));
            expect(tlv.getElement(3)).toEqual(new Uint8Array([0x44, 0x55, 0x66]));
        });

        test('should parse empty data as empty TLV', () => {
            const data = new Uint8Array(0);

            const tlv = new Tlv<number>(2, 4, data);

            expect(tlv.getElement(1)).toBeUndefined();
            expect(tlv.serialize()).toEqual(new Uint8Array(0));
        });

        test('should handle zero-length values', () => {
            const data = new Uint8Array([
                0x05, // type 5
                0x00, // length 0
                // no value bytes
            ]);

            const tlv = new Tlv<number>(1, 1, data);

            const retrieved = tlv.getElement(5);
            expect(retrieved).toEqual(new Uint8Array(0));
        });

        test('should throw error for insufficient data for type and length', () => {
            const data = new Uint8Array([0x01]); // Only 1 byte, need 2+4=6 bytes minimum
            
            expect(() => {
                new Tlv<number>(2, 4, data);
            }).toThrow('Invalid TLV data: not enough data for type and length');
        });

        test('should throw error for insufficient data for value', () => {
            const data = new Uint8Array([
                0x01, // type (need 2 bytes)
                0x02, // partial type
                0x05, 0x00, 0x00, 0x00, // length 5
                0x11, 0x22 // only 2 bytes of value, need 5
            ]);
            
            expect(() => {
                new Tlv<number>(2, 4, data);
            }).toThrow('Invalid TLV data: not enough data for value');
        });
    });

    describe('round-trip serialization/parsing', () => {
        test('should maintain data integrity through serialize/parse cycle', () => {
            const originalTlv = new Tlv<number>(2, 4);
            originalTlv.setElement(1, new Uint8Array([0x11, 0x22]));
            originalTlv.setElement(100, new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]));
            originalTlv.setElement(50, new Uint8Array([])); // empty value
            
            const serialized = originalTlv.serialize();
            const parsedTlv = new Tlv<number>(2, 4, serialized);

            expect(parsedTlv.getElement(1)).toEqual(new Uint8Array([0x11, 0x22]));
            expect(parsedTlv.getElement(100)).toEqual(new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]));
            expect(parsedTlv.getElement(50)).toEqual(new Uint8Array([]));
        });

        test('should handle different enum and length sizes', () => {
            const originalTlv = new Tlv<number>(1, 1);
            originalTlv.setElement(255, new Uint8Array([0x01, 0x02, 0x03]));
            
            const serialized = originalTlv.serialize();
            const parsedTlv = new Tlv<number>(1, 1, serialized);

            expect(parsedTlv.getElement(255)).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
        });
    });

    describe('edge cases', () => {
        test('should handle large type values', () => {
            const tlv = new Tlv<number>(4, 4);
            const largeType = 0xFFFFFFFF;
            const value = new Uint8Array([0x01, 0x02]);
            
            tlv.setElement(largeType, value);
            const serialized = tlv.serialize();
            const parsed = new Tlv<number>(4, 4, serialized);

            expect(parsed.getElement(largeType)).toEqual(value);
        });

        test('should handle large values', () => {
            const tlv = new Tlv<number>(2, 4);
            const largeValue = new Uint8Array(1000).fill(0xAB);
            
            tlv.setElement(1, largeValue);
            const serialized = tlv.serialize();
            const parsed = new Tlv<number>(2, 4, serialized);

            expect(parsed.getElement(1)).toEqual(largeValue);
        });
    });
});
