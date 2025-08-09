import { sodium, crypto_kdf_hkdf_sha256_extract, crypto_kdf_hkdf_sha256_expand } from './sodium';
import { HandshakeMessage, HandshakeMessageType } from './handshake-message';
import { StepChecker } from './step-checker';
import { Encryptor, Decryptor } from './chacha20-poly1305';
import { areUint8ArraysEqual } from './utility';
import { KEY_SIZE, IAuthenticationPeer } from './i-authentication-peer';

export const PSK_SIZE = 32;
export const PUBKEY_SIZE = sodium.crypto_kx_PUBLICKEYBYTES;
export const PRIVATEKEY_SIZE = sodium.crypto_kx_SECRETKEYBYTES;
export const NONCE_SIZE = sodium.crypto_scalarmult_BYTES;
export const HASH_SIZE = sodium.crypto_generichash_BYTES;

enum ClientStep {
    INIT,
    CLIENT_MESSAGE,
    SERVER_MESSAGE,
    SERVER_CONFIRMATION,
};

function getTranscriptHash(
    clientMessage: HandshakeMessage,
    serverMessage: HandshakeMessage
) : Uint8Array {
    const clientBytes = clientMessage.serialize();
    const serverBytes = serverMessage.serialize();
    const transcript = new Uint8Array(clientBytes.length + serverBytes.length);
    transcript.set(clientBytes);
    transcript.set(serverBytes, clientBytes.length);
    return sodium.crypto_generichash(HASH_SIZE, transcript);
}

export class Client implements IAuthenticationPeer {
    #psk: Uint8Array;
    #firstMessageAdditionalElements: Map<HandshakeMessageType, Uint8Array> = new Map();
    #priKey: Uint8Array | undefined = undefined;
    #clientMessage: HandshakeMessage | undefined = undefined;
    #transcriptHash: Uint8Array | undefined = undefined;
    #stepChecker: StepChecker<ClientStep> = new StepChecker(ClientStep.INIT);
    #serverConfirmKey: Uint8Array | undefined = undefined;
    #clientKey: Uint8Array | undefined = undefined;
    #serverKey: Uint8Array | undefined = undefined;
    #numCalls = 0;

    constructor(
        psk: Uint8Array,
        keyIndex: Uint8Array,
        additionalElements: Map<HandshakeMessageType, Uint8Array>
    ) {
        this.#psk = psk;
        this.#firstMessageAdditionalElements.set(HandshakeMessageType.KEY_INDEX, keyIndex);
        for (const [type, value] of additionalElements) {
            if (type === HandshakeMessageType.KEY_INDEX || type === HandshakeMessageType.CIPHER_MESSAGE) {
                throw new Error(`Invalid additional element type: ${type}`);
            }
            this.#firstMessageAdditionalElements.set(type, value);
        }
    }

    getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined {
        switch (this.#numCalls++) {
            case 0:
                if (peerMessage !== undefined) {
                    throw new Error('Peer message is not expected');
                }
                return this.#getClientMessage();
            case 1:
                if (peerMessage === undefined) {
                    throw new Error('Peer message is required');
                }
                return this.#takeServerMessage(peerMessage);
            case 2:
                if (peerMessage === undefined) {
                    throw new Error('Peer message is required');
                }
                this.#takeServerConfirmation(peerMessage);
                return undefined;
        }
        throw new Error('Exceeding max call count');
    }

    isHandshakeComplete(): boolean {
        return this.#stepChecker.getCurrentStep() === ClientStep.SERVER_CONFIRMATION;
    }

    getClientKey(): Uint8Array {
        this.#stepChecker.checkStep(ClientStep.SERVER_CONFIRMATION, ClientStep.SERVER_CONFIRMATION).confirm();
        if (this.#clientKey === undefined) {
            throw new Error("Client key is not initialized");
        }
        return this.#clientKey;
    }

    getServerKey(): Uint8Array {
        this.#stepChecker.checkStep(ClientStep.SERVER_CONFIRMATION, ClientStep.SERVER_CONFIRMATION).confirm();
        if (this.#serverKey === undefined) {
            throw new Error("Server key is not initialized");
        }
        return this.#serverKey;
    }

    #getClientMessage(): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ClientStep.INIT, ClientStep.CLIENT_MESSAGE);
        const keyPair = sodium.crypto_kx_keypair()
        this.#priKey = keyPair.privateKey;
        const nonce = sodium.randombytes_buf(NONCE_SIZE);
        const clientMessage = new Uint8Array(keyPair.publicKey.length + nonce.length);
        clientMessage.set(keyPair.publicKey);
        clientMessage.set(nonce, keyPair.publicKey.length);
        this.#firstMessageAdditionalElements.set(HandshakeMessageType.CIPHER_MESSAGE, clientMessage);
        this.#clientMessage = new HandshakeMessage();
        for (const [type, value] of this.#firstMessageAdditionalElements) {
            this.#clientMessage.setElement(type, value);
        }
        marker.confirm();
        return this.#clientMessage;
    }

    #takeServerMessage(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ClientStep.CLIENT_MESSAGE, ClientStep.SERVER_MESSAGE);
        const serverMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (serverMessage === undefined) {
            throw new Error("Server message is missing cipher message");
        }
        if (serverMessage.length !== PUBKEY_SIZE + NONCE_SIZE) {
            throw new Error(`Invalid server message length: expected ${PUBKEY_SIZE + NONCE_SIZE}, got ${serverMessage.length}`);
        }
        const serverPubKey = serverMessage.slice(0, PUBKEY_SIZE);
        /** server nonce is used to calculate the transcript hash. */
        if (this.#priKey === undefined) {
            throw new Error("Private key is not initialized");
        }
        const Z = sodium.crypto_scalarmult(this.#priKey, serverPubKey);
        if (this.#clientMessage === undefined) {
            throw new Error("Client message is not initialized");
        }

        this.#transcriptHash = getTranscriptHash(this.#clientMessage, handshakeMessage);
        const keyMaterial = new Uint8Array(Z.length + this.#psk.length);
        keyMaterial.set(Z);
        keyMaterial.set(this.#psk, Z.length);
        const prk = crypto_kdf_hkdf_sha256_extract(this.#transcriptHash, keyMaterial);
        const clientConfirmKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "client confirm key", prk);
        this.#serverConfirmKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "server confirm key", prk);
        this.#clientKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "client key", prk);
        this.#serverKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "server key", prk);
        
        const encryptor = new Encryptor(clientConfirmKey);
        const clientConfirmMessage = encryptor.encrypt(this.#transcriptHash);

        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, clientConfirmMessage);

        marker.confirm();
    
        return resultMessage;
    }

    #takeServerConfirmation(handshakeMessage: HandshakeMessage) {
        const marker = this.#stepChecker.checkStep(ClientStep.SERVER_MESSAGE, ClientStep.SERVER_CONFIRMATION);

        const serverConfirmMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (serverConfirmMessage === undefined) {
            throw new Error("Server confirmation message is missing cipher message");
        }
        if (this.#serverConfirmKey === undefined) {
            throw new Error("Server confirm key is not initialized");
        }
        const decryptor = new Decryptor(this.#serverConfirmKey);
        const decryptedHash = decryptor.decrypt(serverConfirmMessage);
        if (this.#transcriptHash === undefined) {
            throw new Error("Transcript hash is not initialized");
        }
        if (!areUint8ArraysEqual(decryptedHash, this.#transcriptHash)) {
            throw new Error("Server confirmation message does not match transcript hash");
        }

        marker.confirm();
    }
};

enum ServerStep {
    INIT,
    CLIENT_MESSAGE,
    CLIENT_CONFIRMATION,
};

export class Server implements IAuthenticationPeer {
    #getPsk: (keyIndex: Uint8Array) => Uint8Array;
    #clientConfirmKey: Uint8Array | undefined = undefined;
    #serverConfirmKey: Uint8Array | undefined = undefined;
    #clientKey: Uint8Array | undefined = undefined;
    #serverKey: Uint8Array | undefined = undefined;
    #transcriptHash: Uint8Array | undefined = undefined;
    #stepChecker: StepChecker<ServerStep> = new StepChecker(ServerStep.INIT);
    #numCalls = 0;

    constructor(getPsk: (keyIndex: Uint8Array) => Uint8Array) {
        this.#getPsk = getPsk;
    }

    getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined {
        switch (this.#numCalls++) {
            case 0:
                if (peerMessage === undefined) {
                    throw new Error('Peer message is required');
                }
                return this.#takeClientMessage(peerMessage);
            case 1:
                if (peerMessage === undefined) {
                    throw new Error('Peer message is required');
                }
                return this.#takeClientConfirmation(peerMessage);
        }
        throw new Error('Exceeding max call count');
    }

    isHandshakeComplete(): boolean {
        return this.#stepChecker.getCurrentStep() === ServerStep.CLIENT_CONFIRMATION;
    }

    getClientKey(): Uint8Array {
        this.#stepChecker.checkStep(ServerStep.CLIENT_CONFIRMATION, ServerStep.CLIENT_CONFIRMATION).confirm();
        if (this.#clientKey === undefined) {
            throw new Error("Client key is not initialized");
        }
        return this.#clientKey;
    }

    getServerKey(): Uint8Array {
        this.#stepChecker.checkStep(ServerStep.CLIENT_CONFIRMATION, ServerStep.CLIENT_CONFIRMATION).confirm();
        if (this.#serverKey === undefined) {
            throw new Error("Server key is not initialized");
        }
        return this.#serverKey;
    }

    #takeClientMessage(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ServerStep.INIT, ServerStep.CLIENT_MESSAGE);

        const keyIndex = handshakeMessage.getElement(HandshakeMessageType.KEY_INDEX);
        if (keyIndex === undefined) {
            throw new Error("Client message is missing key index");
        }
        const psk = this.#getPsk(keyIndex);
        if (psk.length !== PSK_SIZE) {
            throw new Error(`Invalid PSK length: expected ${PSK_SIZE}, got ${psk.length}`);
        }
        const clientMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (clientMessage === undefined) {
            throw new Error("Client message is missing cipher message");
        }
        if (clientMessage.length !== PUBKEY_SIZE + NONCE_SIZE) {
            throw new Error(`Invalid client message length: expected ${PUBKEY_SIZE + NONCE_SIZE}, got ${clientMessage.length}`);
        }

        const keyPair = sodium.crypto_kx_keypair();
        const nonce = sodium.randombytes_buf(NONCE_SIZE);
        const serverMessage = new Uint8Array(keyPair.publicKey.length + nonce.length);
        serverMessage.set(keyPair.publicKey);
        serverMessage.set(nonce, keyPair.publicKey.length);
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, serverMessage);

        const clientPubKey = clientMessage.slice(0, PUBKEY_SIZE);
        const Z = sodium.crypto_scalarmult(keyPair.privateKey, clientPubKey);
        this.#transcriptHash = getTranscriptHash(handshakeMessage, resultMessage);
        const keyMaterial = new Uint8Array(Z.length + psk.length);
        keyMaterial.set(Z);
        keyMaterial.set(psk, Z.length);
        const prk = crypto_kdf_hkdf_sha256_extract(this.#transcriptHash, keyMaterial);
        this.#clientConfirmKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "client confirm key", prk);
        this.#serverConfirmKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "server confirm key", prk);
        this.#clientKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "client key", prk);
        this.#serverKey = crypto_kdf_hkdf_sha256_expand(KEY_SIZE, "server key", prk);

        marker.confirm();

        return resultMessage;
    }

    #takeClientConfirmation(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ServerStep.CLIENT_MESSAGE, ServerStep.CLIENT_CONFIRMATION);

        const clientConfirmMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (clientConfirmMessage === undefined) {
            throw new Error("Client confirmation message is missing cipher message");
        }
        if (this.#clientConfirmKey === undefined) {
            throw new Error("Client confirm key is not initialized");
        }
        const decryptor = new Decryptor(this.#clientConfirmKey);
        const decryptedHash = decryptor.decrypt(clientConfirmMessage);
        if (this.#transcriptHash === undefined) {
            throw new Error("Transcript hash is not initialized");
        }
        if (!areUint8ArraysEqual(decryptedHash, this.#transcriptHash)) {
            throw new Error("Client confirmation message does not match transcript hash");
        }

        if (this.#serverConfirmKey === undefined) {
            throw new Error("Server confirm key is not initialized");
        }
        const encryptor = new Encryptor(this.#serverConfirmKey);
        const serverConfirmMessage = encryptor.encrypt(this.#transcriptHash);
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, serverConfirmMessage);

        marker.confirm();

        return resultMessage;
    }
};
