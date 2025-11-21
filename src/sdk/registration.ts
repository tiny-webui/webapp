import * as spake2p from "./cipher/spake2p";
import { Tlv } from "./cipher/tlv";

enum RegistrationTlvType {
    Username = 0,
    Salt = 1,
    w0 = 2,
    L = 3,
    PublicMetadata = 4,
}

export function getRegistrationString(params :{
    username: string;
    password: string;
    publicMetadata?: { [key: string]: unknown };
}): string {
    /** @todo Run this in another thread? This will keep the CPU busy for a short while. */
    const { w0, L, salt } = spake2p.register(params.username, params.password);
    const tlv = new Tlv<RegistrationTlvType>(1);
    tlv.setElement(RegistrationTlvType.Username, new TextEncoder().encode(params.username));
    tlv.setElement(RegistrationTlvType.Salt, salt);
    tlv.setElement(RegistrationTlvType.w0, w0);
    tlv.setElement(RegistrationTlvType.L, L);
    if (params.publicMetadata !== undefined) {
        tlv.setElement(RegistrationTlvType.PublicMetadata, new TextEncoder().encode(JSON.stringify(params.publicMetadata)));
    }
    return Buffer.from(tlv.serialize()).toString('base64');
}

export function parseRegistrationString(regStr: string): {
    username: string;
    salt: Uint8Array;
    w0: Uint8Array;
    L: Uint8Array;
    publicMetadata?: { [key: string]: unknown };
} {
    const tlv = new Tlv<RegistrationTlvType>(1, 4, Buffer.from(regStr, 'base64'));
    const usernameBytes = tlv.getElement(RegistrationTlvType.Username);
    if (usernameBytes === undefined) {
        throw new Error("Invalid registration string: missing username");
    }
    const username = new TextDecoder().decode(usernameBytes);
    const salt = tlv.getElement(RegistrationTlvType.Salt);
    if (salt === undefined) {
        throw new Error("Invalid registration string: missing salt");
    }
    const w0 = tlv.getElement(RegistrationTlvType.w0);
    if (w0 === undefined) {
        throw new Error("Invalid registration string: missing w0");
    }
    const L = tlv.getElement(RegistrationTlvType.L);
    if (L === undefined) {
        throw new Error("Invalid registration string: missing L");
    }
    const publicMetadataBytes = tlv.getElement(RegistrationTlvType.PublicMetadata);
    let publicMetadata: { [key: string]: unknown } | undefined = undefined;
    if (publicMetadataBytes !== undefined) {
        const jsonStr = new TextDecoder().decode(publicMetadataBytes);
        publicMetadata = JSON.parse(jsonStr);
    }
    return {
        username,
        salt,
        w0,
        L,
        publicMetadata
    };
}
