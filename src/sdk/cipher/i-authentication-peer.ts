import { HandshakeMessage } from "./handshake-message";

export abstract class IAuthenticationPeer {
    static KEY_SIZE = 32;
    abstract getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined;
    abstract isHandshakeComplete(): boolean;
    abstract getClientKey(): Uint8Array;
    abstract getServerKey(): Uint8Array;
};
