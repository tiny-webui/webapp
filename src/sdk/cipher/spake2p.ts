import { sodium, crypto_kdf_hkdf_sha256_expand } from './sodium';
import { IAuthenticationPeer } from './i-authentication-peer';
import { HandshakeMessage, HandshakeMessageType } from './handshake-message';
import { Scalar, Point, getCofactor } from './ed25519';
import { StepChecker } from './step-checker';
import { Decryptor, Encryptor } from './chacha20-poly1305';

/** 
 * This value is not used. It is a constant inside libsodium.
 * But we label it here for clarity.
 */
// const ARGON2ID_LANES = 1;
const ARGON2ID_MEM_COST_BYTES = 64 * 1024 * 1024;
const ARGON2ID_ITERATIONS = 3;
const M_BYTES = new Uint8Array([
    0xd0, 0x48, 0x03, 0x2c, 0x6e, 0xa0, 0xb6, 0xd6, 
    0x97, 0xdd, 0xc2, 0xe8, 0x6b, 0xda, 0x85, 0xa3, 
    0x3a, 0xda, 0xc9, 0x20, 0xf1, 0xbf, 0x18, 0xe1, 
    0xb0, 0xc6, 0xd1, 0x66, 0xa5, 0xce, 0xcd, 0xaf
]);
const N_BYTES = new Uint8Array([
    0xd3, 0xbf, 0xb5, 0x18, 0xf4, 0x4f, 0x34, 0x30, 
    0xf2, 0x9d, 0x0c, 0x92, 0xaf, 0x50, 0x38, 0x65, 
    0xa1, 0xed, 0x32, 0x81, 0xdc, 0x69, 0xb3, 0x5d, 
    0xd8, 0x68, 0xba, 0x85, 0xf8, 0x86, 0xc4, 0xab
]);
const HASH_CONTEXT = "TUI";
const ID_VERIFIER = "tui-server";

export const W0_SIZE = Scalar.SIZE;
export const L_SIZE = Point.SIZE;
export const SALT_SIZE = sodium.crypto_pwhash_argon2id_SALTBYTES;

export interface RegistrationResult {
    w0: Uint8Array;
    L: Uint8Array;
    salt: Uint8Array;
};

function deriveW0W1(
    username: string, password: string, salt: Uint8Array
) : { w0: Scalar, w1: Scalar } {
    /** len(password) | password | len(username) | username | len(ID_VERIFIER) | ID_VERIFIER */
    const usernameBytes = new TextEncoder().encode(username);
    const passwordBytes = new TextEncoder().encode(password);
    const idVerifierBytes = new TextEncoder().encode(ID_VERIFIER);
    const keyMaterial = new Uint8Array(
        2 + passwordBytes.length + 2 + usernameBytes.length + 2 + idVerifierBytes.length)
    const keyMaterialView = new DataView(keyMaterial.buffer);
    let offset = 0;
    keyMaterialView.setUint16(offset, passwordBytes.length, true);
    offset += 2;
    keyMaterial.set(passwordBytes, offset);
    offset += passwordBytes.length;
    keyMaterialView.setUint16(offset, usernameBytes.length, true);
    offset += 2;
    keyMaterial.set(usernameBytes, offset);
    offset += usernameBytes.length;
    keyMaterialView.setUint16(offset, idVerifierBytes.length, true);
    offset += 2;
    keyMaterial.set(idVerifierBytes, offset);
    offset += idVerifierBytes.length;

    const key = sodium.crypto_pwhash(
        Scalar.SIZE * 2, 
        keyMaterial, 
        salt, 
        ARGON2ID_ITERATIONS, 
        ARGON2ID_MEM_COST_BYTES, 
        sodium.crypto_pwhash_ALG_ARGON2ID13);
    const w0Bytes = key.slice(0, Scalar.SIZE);
    const w1Bytes = key.slice(Scalar.SIZE, Scalar.SIZE * 2);
    return { 
        w0: new Scalar(w0Bytes),
        w1: new Scalar(w1Bytes)
    };
}

function getTranscriptHash(
    context: string,
    idProver: string,
    idVerifier: string,
    X: Point,
    Y: Point,
    Z: Point,
    V: Point,
    w0: Scalar
): Uint8Array {
    const contextBytes = (new TextEncoder()).encode(context);
    const idProverBytes = (new TextEncoder()).encode(idProver);
    const idVerifierBytes = (new TextEncoder()).encode(idVerifier);
    const transcript = new Uint8Array(
        contextBytes.length + 
        idProverBytes.length +
        idVerifierBytes.length +
        M_BYTES.length +
        N_BYTES.length +
        X.dump().length +
        Y.dump().length +
        X.dump().length +
        V.dump().length +
        w0.dump().length);
    let offset = 0;
    transcript.set(contextBytes, offset);
    offset += contextBytes.length;
    transcript.set(idProverBytes, offset);
    offset += idProverBytes.length;
    transcript.set(idVerifierBytes, offset);
    offset += idVerifierBytes.length;
    transcript.set(M_BYTES, offset);
    offset += M_BYTES.length;
    transcript.set(N_BYTES, offset);
    offset += N_BYTES.length;
    transcript.set(X.dump(), offset);
    offset += X.dump().length;
    transcript.set(Y.dump(), offset);
    offset += Y.dump().length;
    transcript.set(Z.dump(), offset);
    offset += Z.dump().length;
    transcript.set(V.dump(), offset);
    offset += V.dump().length;
    transcript.set(w0.dump(), offset);
    offset += w0.dump().length;
    return sodium.crypto_generichash(sodium.crypto_generichash_BYTES, transcript);
}

export function register(username: string, password: string): RegistrationResult {
    const salt = sodium.randombytes_buf(SALT_SIZE);
    const { w0, w1 } = deriveW0W1(username, password, salt);
    const L = w1.getPubKey();
    return {
        w0: w0.dump(),
        L: L.dump(),
        salt: salt
    };
}

enum ClientStep {
    INIT,
    RETRIEVE_SALT,
    SHARE_P,
    CONFIRM_P
};

export class Client extends IAuthenticationPeer {
    #username: string;
    #password: string;
    #firstMessageAdditionalElements: Map<HandshakeMessageType, Uint8Array>;
    #stepChecker = new StepChecker<ClientStep>(ClientStep.INIT);
    #w0: Scalar | undefined = undefined;
    #w1: Scalar | undefined = undefined;
    #x: Scalar | undefined = undefined;
    #X: Point | undefined = undefined;
    #clientKey: Uint8Array | undefined = undefined;
    #serverKey: Uint8Array | undefined = undefined;

    constructor(
        username: string,
        password: string,
        additionalElements: Map<HandshakeMessageType, Uint8Array>
    ) {
        super();
        this.#username = username;
        this.#password = password;
        for (const type of additionalElements.keys()) {
            if (type === HandshakeMessageType.KEY_INDEX || type === HandshakeMessageType.CIPHER_MESSAGE) {
                throw new Error("Invalid additional element type");
            }
        }
        this.#firstMessageAdditionalElements = new Map(additionalElements);
    }

    getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined {
        switch (this.#stepChecker.getCurrentStep()) {
            case ClientStep.INIT:
                if (peerMessage !== undefined) {
                    throw new Error("Unexpected peer message");
                }
                return this.#retrieveSalt();
            case ClientStep.RETRIEVE_SALT:
                if (peerMessage === undefined) {
                    throw new Error("Missing peer message");
                }
                return this.#getShareP(peerMessage);
            case ClientStep.SHARE_P:
                if (peerMessage === undefined) {
                    throw new Error("Missing peer message");
                }
                return this.#getConfirmP(peerMessage);
            default:
                throw new Error("Invalid step in Client handshake");
        }
    }

    isHandshakeComplete(): boolean {
        return this.#stepChecker.getCurrentStep() === ClientStep.CONFIRM_P;
    }

    getClientKey(): Uint8Array {
        this.#stepChecker.checkStep(ClientStep.CONFIRM_P, ClientStep.CONFIRM_P).confirm();
        if (this.#clientKey === undefined) {
            throw new Error("Handshake not complete");
        }
        return this.#clientKey;
    }

    getServerKey(): Uint8Array {
        this.#stepChecker.checkStep(ClientStep.CONFIRM_P, ClientStep.CONFIRM_P).confirm();
        if (this.#serverKey === undefined) {
            throw new Error("Handshake not complete");
        }
        return this.#serverKey;
    }

    #retrieveSalt(): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ClientStep.INIT, ClientStep.RETRIEVE_SALT);

        const keyIndex = (new TextEncoder()).encode(this.#username);
        this.#firstMessageAdditionalElements.set(HandshakeMessageType.KEY_INDEX, keyIndex);
        const resultMessage = new HandshakeMessage();
        for (const [type, value] of this.#firstMessageAdditionalElements) {
            resultMessage.setElement(type, value);
        }

        marker.confirm();
        return resultMessage;
    }

    #getShareP(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ClientStep.RETRIEVE_SALT, ClientStep.SHARE_P);

        const serverMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (serverMessage === undefined) {
            throw new Error("Missing server message");
        }
        if (serverMessage.length !== SALT_SIZE) {
            throw new Error("Invalid server message length");
        }
        const salt = serverMessage;
        const { w0, w1 } = deriveW0W1(this.#username, this.#password, salt);
        this.#password = '';
        this.#w0 = w0;
        this.#w1 = w1;
        this.#x = Scalar.generate();
        const M = new Point(M_BYTES);
        this.#X = this.#x.getPubKey().add(this.#w0.mulPoint(M));
        const shareP = this.#X.dump();
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, shareP);

        marker.confirm();
        return resultMessage;
    }

    #getConfirmP(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ClientStep.SHARE_P, ClientStep.CONFIRM_P);

        const serverMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (serverMessage === undefined) {
            throw new Error("Missing server message");
        }
        if (serverMessage.length < Point.SIZE) {
            throw new Error("Invalid server message length");
        }

        const Y = new Point(serverMessage.slice(0, Point.SIZE));
        const h = getCofactor();
        const N = new Point(N_BYTES);
        if (this.#w0 === undefined || this.#w1 === undefined || this.#x === undefined) {
            throw new Error("Internal error: missing w0, w1 or x");
        }
        const Z = h.mulPoint(this.#x.mulPoint(Y.sub(this.#w0.mulPoint(N))));
        const V = h.mulPoint(this.#w1.mulPoint(Y.sub(this.#w0.mulPoint(N))));

        if (this.#X === undefined) {
            throw new Error("Internal error: missing X");
        }
        const prk = getTranscriptHash(
            HASH_CONTEXT, this.#username, ID_VERIFIER, this.#X, Y, Z, V, this.#w0);

        this.#clientKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "client key", prk);
        this.#serverKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "server key", prk);
        const confirmPKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "confirmP key", prk);
        const confirmVKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "confirmV key", prk);
        
        const decryptor = new Decryptor(confirmVKey);
        const confirmV = serverMessage.slice(Point.SIZE);
        const decryptedShareP = decryptor.decrypt(confirmV);
        if (decryptedShareP.length !== Point.SIZE) {
            throw new Error("Invalid decrypted shareP length");
        }
        const decryptedX = new Point(decryptedShareP);
        if (!decryptedX.equal(this.#X)) {
            throw new Error("ShareP ConfirmV mismatch");
        }

        const encryptor = new Encryptor(confirmPKey);
        const confirmP = encryptor.encrypt(Y.dump());
        
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, confirmP);

        marker.confirm();
        return resultMessage;
    }
};

enum ServerStep {
    INIT,
    RETRIEVE_SALT,
    SHARE_V_CONFIRM_V,
    CONFIRM_P
};

export class Server extends IAuthenticationPeer {
    #username: string | undefined = undefined;
    #getUserRegistration: (username: string) => RegistrationResult;
    #registrationResult: RegistrationResult | undefined = undefined;
    #stepChecker = new StepChecker<ServerStep>(ServerStep.INIT);
    #Y: Point | undefined = undefined;
    #clientKey: Uint8Array | undefined = undefined;
    #serverKey: Uint8Array | undefined = undefined;
    #confirmPKey: Uint8Array | undefined = undefined;

    constructor(getUserRegistration: (username: string) => RegistrationResult) {
        super();
        this.#getUserRegistration = getUserRegistration;
    }

    getNextMessage(peerMessage?: HandshakeMessage): HandshakeMessage | undefined {
        switch (this.#stepChecker.getCurrentStep()) {
            case ServerStep.INIT:
                if (peerMessage === undefined) {
                    throw new Error("Missing peer message");
                }
                return this.#retriveSalt(peerMessage);
            case ServerStep.RETRIEVE_SALT:
                if (peerMessage === undefined) {
                    throw new Error("Missing peer message");
                }
                return this.#getShareVConfirmV(peerMessage);
            case ServerStep.SHARE_V_CONFIRM_V:
                if (peerMessage === undefined) {
                    throw new Error("Missing peer message");
                }
                this.#takeConfirmP(peerMessage);
                return undefined;
            default:
                throw new Error("Invalid step in Server handshake");
        }
    }

    isHandshakeComplete(): boolean {
        return this.#stepChecker.getCurrentStep() === ServerStep.CONFIRM_P;
    }

    getClientKey(): Uint8Array {
        this.#stepChecker.checkStep(ServerStep.CONFIRM_P, ServerStep.CONFIRM_P).confirm();
        if (this.#clientKey === undefined) {
            throw new Error("Handshake not complete");
        }
        return this.#clientKey;
    }

    getServerKey(): Uint8Array {
        this.#stepChecker.checkStep(ServerStep.CONFIRM_P, ServerStep.CONFIRM_P).confirm();
        if (this.#serverKey === undefined) {
            throw new Error("Handshake not complete");
        }
        return this.#serverKey;
    }

    #retriveSalt(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ServerStep.INIT, ServerStep.RETRIEVE_SALT);

        const keyIndex = handshakeMessage.getElement(HandshakeMessageType.KEY_INDEX);
        if (keyIndex === undefined) {
            throw new Error("Missing key index");
        }
        this.#username = (new TextDecoder()).decode(keyIndex);
        const registration = this.#getUserRegistration(this.#username);
        this.#registrationResult = {
            w0: new Uint8Array(registration.w0),
            L: new Uint8Array(registration.L),
            salt: new Uint8Array(registration.salt),
        };
        const salt = this.#registrationResult.salt;
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, salt);

        marker.confirm();
        return resultMessage;
    }

    #getShareVConfirmV(handshakeMessage: HandshakeMessage): HandshakeMessage {
        const marker = this.#stepChecker.checkStep(ServerStep.RETRIEVE_SALT, ServerStep.SHARE_V_CONFIRM_V);

        const clientMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (clientMessage === undefined) {
            throw new Error("Missing client message");
        }
        if (clientMessage.length !== Point.SIZE) {
            throw new Error("Invalid client message length");
        }

        const X = new Point(clientMessage);
        const y = Scalar.generate();
        const N = new Point(N_BYTES);
        if (this.#registrationResult === undefined) {
            throw new Error("Internal error: missing registration result");
        }
        const w0 = new Scalar(this.#registrationResult.w0);
        this.#Y = y.getPubKey().add(w0.mulPoint(N));
        const h = getCofactor();
        const M = new Point(M_BYTES);
        const L = new Point(this.#registrationResult.L);
        const Z = h.mulPoint(y.mulPoint(X.sub(w0.mulPoint(M))));
        const V = h.mulPoint(y.mulPoint(L));

        if (this.#username === undefined) {
            throw new Error("Internal error: missing username");
        }
        const prk = getTranscriptHash(
            HASH_CONTEXT, this.#username, ID_VERIFIER, X, this.#Y, Z, V, w0);
        this.#clientKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "client key", prk);
        this.#serverKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "server key", prk);
        this.#confirmPKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "confirmP key", prk);
        const confirmVKey = crypto_kdf_hkdf_sha256_expand(IAuthenticationPeer.KEY_SIZE, "confirmV key", prk);
        
        const encryptor = new Encryptor(confirmVKey);
        const confirmV = encryptor.encrypt(X.dump());
        const shareV = this.#Y.dump();
        const cipherMessage = new Uint8Array(shareV.length + confirmV.length);
        cipherMessage.set(shareV, 0);
        cipherMessage.set(confirmV, shareV.length);
        const resultMessage = new HandshakeMessage();
        resultMessage.setElement(HandshakeMessageType.CIPHER_MESSAGE, cipherMessage);

        marker.confirm();
        return resultMessage;
    }

    #takeConfirmP(handshakeMessage: HandshakeMessage) {
        const marker = this.#stepChecker.checkStep(ServerStep.SHARE_V_CONFIRM_V, ServerStep.CONFIRM_P);
    
        const clientMessage = handshakeMessage.getElement(HandshakeMessageType.CIPHER_MESSAGE);
        if (clientMessage === undefined) {
            throw new Error("Missing client message");
        }
        if (this.#confirmPKey === undefined) {
            throw new Error("Internal error: missing confirmP key");
        }
        const decryptor = new Decryptor(this.#confirmPKey);
        const decryptedYBytes = decryptor.decrypt(clientMessage);
        if (decryptedYBytes.length !== Point.SIZE) {
            throw new Error("Invalid decrypted shareV length");
        }
        const Y = new Point(decryptedYBytes);
        if (this.#Y === undefined) {
            throw new Error("Internal error: missing Y");
        }
        if (!Y.equal(this.#Y)) {
            throw new Error("Invalid confirm P");
        }

        marker.confirm();
    }
};
