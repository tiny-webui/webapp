import * as SecureSession from '../../../../src/sdk/session/secure-session';
import * as WebSocketClient from '../../../../src/sdk/session/websocket-client';

const username = 'username';
const password = 'password';
const address = '127.0.0.1';
const port = 12345;

const webSocketConnection = new WebSocketClient.Connection(address, port);
const connection = new SecureSession.Connection(webSocketConnection, username, password);

await connection.connectAsync();
console.log('Secure session connected');

connection.close();

await connection.connectAsync();
console.log('Secure session reconnected');

connection.close();
