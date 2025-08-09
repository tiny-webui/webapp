import { Client } from "../../../../src/sdk/cipher/ecdhe-psk";
import * as readline from 'readline';
import { HandshakeMessage, HandshakeMessageType } from "../../../../src/sdk/cipher/handshake-message";

async function readlineFromConsole(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/** This is the client side */

const keyIndex = new Uint8Array([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
]);

const psk = new Uint8Array([
    0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
    0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F
]);

const additionalData: Map<HandshakeMessageType, Uint8Array> = new Map();
additionalData.set(HandshakeMessageType.PROTOCOL_TYPE, new Uint8Array([0x01, 0x02, 0x03]));

const client = new Client(psk, keyIndex, additionalData);

let serverMessage: HandshakeMessage | undefined = undefined;
while(true) {
    /** The client starts the handshake. */
    const clientMessage = client.getNextMessage(serverMessage);
    if (clientMessage !== undefined) {
        console.log(`Client message:\n${Buffer.from(clientMessage.serialize()).toString('base64url')}`);
    }
    if (client.isHandshakeComplete()) {
        break;
    }
    const serverMessageBase64 = await readlineFromConsole("Enter server message (base64url): ");
    const serverMessageBytes = Buffer.from(serverMessageBase64, 'base64url');
    serverMessage = new HandshakeMessage(serverMessageBytes);
}

console.log('Client key:', Buffer.from(client.getClientKey()).toString('hex'));
console.log('Server key:', Buffer.from(client.getServerKey()).toString('hex'));
