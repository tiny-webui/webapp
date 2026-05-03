export abstract class BaseTool {
    abstract get name(): string;
    abstract get description(): string;
    abstract get paramSchema(): unknown;
    abstract callAsync(params: unknown, context: unknown): Promise<string>;
};
