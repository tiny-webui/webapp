import { Tlv } from './tlv';

export enum HandshakeMessageType
{
    PROTOCOL_TYPE = 0,
    CIPHER_MESSAGE = 1,
    KEY_INDEX = 2,
};

const TYPE_SIZE = 1;
const LENGTH_SIZE = 4;

export class HandshakeMessage extends Tlv<HandshakeMessageType>
{
    constructor(data?: Uint8Array)
    {
        super(TYPE_SIZE, LENGTH_SIZE, data);
    }
};
