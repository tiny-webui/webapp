import { BaseTool } from "./base";

export interface ListFilesToolContext {
    files: Array<{
        name: string;
        content: string;
    }>;
};

export class ListFilesTool extends BaseTool {
    get name(): string {
        return 'list_files';
    }

    get description(): string {
        return 'List all available context files. Return a JSON array of objects with name and length for each file the user provided.';
    }

    get paramSchema(): unknown {
        return {
            type: 'object',
            properties: {},
            required: [],
        };
    }

    async callAsync(params: unknown, context: unknown): Promise<string> {
        const ctx = context as ListFilesToolContext;
        if (!Array.isArray(ctx.files)) {
            throw new Error('Invalid context: files array is required.');
        }
        for (const file of ctx.files) {
            if (typeof file.name !== 'string' || typeof file.content !== 'string') {
                throw new Error('Invalid context: each file must have a name and content string.');
            }
        }
        const result = ctx.files.map(file => ({
            name: file.name,
            length: file.content.length,
        }));
        return JSON.stringify(result);
    }
};
