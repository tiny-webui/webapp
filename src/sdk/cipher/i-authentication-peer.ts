import { HandshakeMessage } from "./handshake-message";

export const KEY_SIZE = 32;

export interface IAuthenticationPeer {
    getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined;
    isHandshakeComplete(): boolean;
    getClientKey(): Uint8Array;
    getServerKey(): Uint8Array;
};
