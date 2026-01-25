import { IConnection } from "./i-connection";
import { Encryptor, Decryptor } from "../cipher/chacha20-poly1305";
import * as spake2p from "../cipher/spake2p";
import * as ecdhePsk from "../cipher/ecdhe-psk";
import { IAuthenticationPeer } from "../cipher/i-authentication-peer";
import { HandshakeMessage, HandshakeMessageType } from "../cipher/handshake-message";
import * as IServer from "../types/IServer";
import { isSecureContext } from "./secure-context";
import { sodium } from "../cipher/sodium";
import { Zstd } from "@hpcc-js/wasm-zstd";

const zstd = await Zstd.load();

enum ProtocolType {
    Password = 0,
    Psk = 1,
};

enum CompressionType {
    None =0,
    Zstd = 1,
};

export class Connection extends IConnection {
    #connection: IConnection;
    #username: string | undefined;
    #password: string | undefined;
    #resumptionKeyIndex: Uint8Array | undefined = undefined;
    #resumptionKey: Uint8Array | undefined = undefined;
    #encryptor: Encryptor | undefined = undefined;
    #decryptor: Decryptor | undefined = undefined;
    #wasUnderAttack: (() => void)|undefined = undefined;
    #turnOffEncryption: boolean = false;

    constructor(
        connection: IConnection,
        username: string,
        password: string,
        wasUnderAttack: (() => void)|undefined = undefined) {
        super();
        this.#connection = connection;
        this.#username = username;
        this.#password = password;
        this.#wasUnderAttack = wasUnderAttack;
    }

    async connectAsync(): Promise<void> {
        await this.#connection.connectAsync();
        /** Handshake */
        let peer: IAuthenticationPeer | undefined = undefined;
        if (this.#username !== undefined && this.#password !== undefined) {
            const username = this.#username;
            const password = this.#password;
            this.#username = undefined;
            this.#password = undefined;
            const additionalElements = new Map<HandshakeMessageType, Uint8Array>(); 
            additionalElements.set(HandshakeMessageType.PROTOCOL_TYPE, new Uint8Array([ProtocolType.Password]));
            peer = new spake2p.Client(username, password, additionalElements);
        } else if (this.#resumptionKeyIndex !== undefined && this.#resumptionKey !== undefined) {
            const resumptionKeyIndex = this.#resumptionKeyIndex;
            const resumptionKey = this.#resumptionKey;
            this.#resumptionKeyIndex = undefined;
            this.#resumptionKey = undefined;
            const additionalElements = new Map<HandshakeMessageType, Uint8Array>();
            additionalElements.set(HandshakeMessageType.PROTOCOL_TYPE, new Uint8Array([ProtocolType.Psk]));
            peer = new ecdhePsk.Client(resumptionKey, resumptionKeyIndex, additionalElements);
        }
        if (peer === undefined) {
            throw new Error("No credential provided");
        }
        let peerMessage: HandshakeMessage | undefined = undefined;
        while (true) {
            const message = peer.getNextMessage(peerMessage);
            if (message !== undefined) {
                this.#connection.send(message.serialize());
            }
            if (peer.isHandshakeComplete()) {
                break;
            }
            const peerData = await this.#connection.receiveAsync();
            if (peerData === undefined) {
                throw new Error("Connection closed");
            }
            peerMessage = new HandshakeMessage(peerData);
        }
        this.#encryptor = new Encryptor(peer.getClientKey());
        this.#decryptor = new Decryptor(peer.getServerKey());
        /** Exchange session options and resumption key */
        /** Turn off encryption if already encrypted with TLS */
        this.#turnOffEncryption = isSecureContext();
        const negotiationRequest: IServer.ProtocolNegotiationRequest = {
            turnOffEncryption: this.#turnOffEncryption
        }
        const encryptedNegotiationRequest = this.#encryptor.encrypt(new TextEncoder().encode(JSON.stringify(negotiationRequest)));
        this.#connection.send(encryptedNegotiationRequest);
        const encryptedNegotiationResponse = await this.#connection.receiveAsync();
        if (encryptedNegotiationResponse === undefined) {
            throw new Error("Connection closed");
        }
        const negotiationResponse: IServer.ProtocolNegotiationResponse = JSON.parse(
            new TextDecoder().decode(this.#decryptor.decrypt(encryptedNegotiationResponse)));
        if (typeof negotiationResponse.sessionResumptionKey !== 'string') {
            throw new Error("Invalid server response");
        }
        const resumptionKey = sodium.from_base64(
            negotiationResponse.sessionResumptionKey,
            sodium.base64_variants.URLSAFE_NO_PADDING);
        if (resumptionKey.length !== ecdhePsk.PSK_SIZE) {
            throw new Error("Invalid server response");
        }
        this.#resumptionKey = resumptionKey;
        if (typeof negotiationResponse.sessionResumptionKeyIndex !== 'string') {
            throw new Error("Invalid server response");
        }
        /** This is just a string. */
        const resumptionKeyIndex = new TextEncoder().encode(negotiationResponse.sessionResumptionKeyIndex);
        this.#resumptionKeyIndex = resumptionKeyIndex;
        if (negotiationResponse.wasUnderAttack === true && this.#wasUnderAttack) {
            this.#wasUnderAttack();
        }
    }

    close(): void {
        this.#encryptor = undefined;
        this.#decryptor = undefined;
        this.#connection.close();
    }

    isClosed(): boolean {
        return this.#connection.isClosed();
    }

    send(data: Uint8Array): void {
        data = this.#compressData(data);
        if (!this.#turnOffEncryption) {
            if (this.#encryptor === undefined) {
                throw new Error("Encryption not established");
            }
            data = this.#encryptor.encrypt(data);
        }
        this.#connection.send(data);
    }

    async receiveAsync(): Promise<Uint8Array | undefined> {
        let data = await this.#connection.receiveAsync();
        if (data === undefined) {
            return undefined;
        }
        if (!this.#turnOffEncryption) {
            if (this.#decryptor === undefined) {
                throw new Error("Decryption not established");
            }
            data = this.#decryptor.decrypt(data);
        }
        data = this.#decompressData(data);
        return data;
    }

    #compressData(data: Uint8Array): Uint8Array {
        if (data.length < 100) {
            /** Not worth it */
            return this.#formCompressedData(data, CompressionType.None);
        }
        const compressed = zstd.compress(data, 3);
        if (compressed.length + 1 >= data.length) {
            /** Compression not effective */
            return this.#formCompressedData(data, CompressionType.None);
        }
        return this.#formCompressedData(compressed, CompressionType.Zstd);
    }

    #formCompressedData(data: Uint8Array, type: CompressionType): Uint8Array {
        const result = new Uint8Array(1 + data.length);
        result[0] = type;
        result.set(data, 1);
        return result;
    }

    #decompressData(data: Uint8Array): Uint8Array {
        const type = data[0];
        const compressedData = data.subarray(1);
        switch (type) {
            case CompressionType.None:
                return compressedData;
            case CompressionType.Zstd:
                return zstd.decompress(compressedData);
            default:
                throw new Error("Unknown compression type");
        }
    }
}

