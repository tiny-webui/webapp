import * as spake2p from "./cipher/spake2p";
import { Tlv } from "./cipher/tlv";

enum RegistrationTlvType {
    Username = 0,
    Salt = 1,
    w0 = 2,
    L = 3,
    PublicMetadata = 4,
}

export function register(params :{
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
