import { Client } from "../../../../src/sdk/cipher/spake2p";
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

const username = 'username';
const password = 'password';

const additionalData: Map<HandshakeMessageType, Uint8Array> = new Map();
additionalData.set(HandshakeMessageType.PROTOCOL_TYPE, new Uint8Array([0x01, 0x02, 0x03]));

const client = new Client(username, password, additionalData);

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
