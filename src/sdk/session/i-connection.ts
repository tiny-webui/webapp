export abstract class IConnection {
    abstract connectAsync(): Promise<void>;
    abstract close(): void;
    abstract isClosed(): boolean;
    abstract send(data: Uint8Array): void;
    abstract receiveAsync(): Promise<Uint8Array|undefined>;
};
