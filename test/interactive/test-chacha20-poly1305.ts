import { Encryptor, Decryptor } from '../../src/sdk/cipher/chacha20-poly1305';
import * as readline from 'readline';

const CLIENT_KEY = new Uint8Array([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f
]);

const SERVER_KEY = new Uint8Array([
    0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f,
    0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f
]);

const encryptor = new Encryptor(CLIENT_KEY);
const message = "Hello, this is a test message!";
const cipherText = encryptor.encrypt(new TextEncoder().encode(message));
console.log(`Encrypted message (base64):\n${Buffer.from(cipherText).toString('base64')}`);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\nEnter encrypted message from server (base64):");
const input = await new Promise<string>((resolve) => {
    rl.question('> ', (answer) => {
        resolve(answer);
        rl.close();
    });
});

const serverCipherData = Uint8Array.from(Buffer.from(input.trim(), 'base64'));
const decryptor = new Decryptor(SERVER_KEY);
const serverPlainData = decryptor.decrypt(serverCipherData);
const serverPlainText = new TextDecoder().decode(serverPlainData);
if (serverPlainText !== message) {
    throw new Error("Decrypted message does not match original message!");
}

