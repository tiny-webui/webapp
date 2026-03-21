import { QuickJSTool, QuickJSToolContext } from "../../../src/tools/quickjs";

let tool: QuickJSTool;

beforeAll(() => {
    tool = new QuickJSTool();
});

function makeContext(files: QuickJSToolContext['files']): QuickJSToolContext {
    return { files };
}

describe('QuickJSTool metadata', () => {
    test('name is quickjs', () => {
        expect(tool.name).toBe('quickjs');
    });

    test('description is a non-empty string', () => {
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
    });

    test('paramSchema requires file and script', () => {
        const schema = tool.paramSchema as {
            type: string;
            properties: Record<string, unknown>;
            required: string[];
        };
        expect(schema.type).toBe('object');
        expect(schema.properties).toHaveProperty('file');
        expect(schema.properties).toHaveProperty('script');
        expect(schema.required).toEqual(expect.arrayContaining(['file', 'script']));
    });
});

describe('QuickJSTool context validation', () => {
    test('throws when context.files is not an array', async () => {
        await expect(
            tool.callAsync({ file: 'a.txt', script: '1' }, { files: 'bad' })
        ).rejects.toThrow('files array is required');
    });

    test('throws when a file entry is missing name', async () => {
        await expect(
            tool.callAsync({ file: 'a.txt', script: '1' }, { files: [{ content: 'x' }] })
        ).rejects.toThrow('each file must have a name and content string');
    });

    test('throws when a file entry is missing content', async () => {
        await expect(
            tool.callAsync({ file: 'a.txt', script: '1' }, { files: [{ name: 'a.txt' }] })
        ).rejects.toThrow('each file must have a name and content string');
    });
});

describe('QuickJSTool parameter validation', () => {
    const ctx = makeContext([{ name: 'a.txt', content: 'hello' }]);

    test('returns error for null params', async () => {
        const result = await tool.callAsync(null, ctx);
        expect(result).toContain('[Tool Error]');
        expect(result).toContain('Invalid parameters');
    });

    test('returns error for non-object params', async () => {
        const result = await tool.callAsync('bad', ctx);
        expect(result).toContain('[Tool Error]');
    });

    test('returns error when file param is missing', async () => {
        const result = await tool.callAsync({ script: '1' }, ctx);
        expect(result).toContain('[Tool Error]');
        expect(result).toContain('file is required');
    });

    test('returns error when file param is not a string', async () => {
        const result = await tool.callAsync({ file: 123, script: '1' }, ctx);
        expect(result).toContain('[Tool Error]');
        expect(result).toContain('file is required');
    });

    test('returns error when script param is missing', async () => {
        const result = await tool.callAsync({ file: 'a.txt' }, ctx);
        expect(result).toContain('[Tool Error]');
        expect(result).toContain('script is required');
    });

    test('returns error when script param is not a string', async () => {
        const result = await tool.callAsync({ file: 'a.txt', script: 42 }, ctx);
        expect(result).toContain('[Tool Error]');
        expect(result).toContain('script is required');
    });

    test('returns error when file is not found in context', async () => {
        const result = await tool.callAsync({ file: 'missing.txt', script: '1' }, ctx);
        expect(result).toContain('[Tool Error] File not found: missing.txt');
    });
});

describe('QuickJSTool script execution', () => {
    const ctx = makeContext([
        { name: 'data.txt', content: 'Hello, world!' },
        { name: 'nums.txt', content: '1\n2\n3' },
    ]);

    test('script can read fileContent variable', async () => {
        const result = await tool.callAsync(
            { file: 'data.txt', script: 'fileContent' },
            ctx
        );
        expect(result).toBe('Hello, world!');
    });

    test('script returns numeric result', async () => {
        const result = await tool.callAsync(
            { file: 'data.txt', script: '2 + 3' },
            ctx
        );
        expect(result).toBe(5);
    });

    test('script can process file content', async () => {
        const result = await tool.callAsync(
            { file: 'nums.txt', script: 'fileContent.split("\\n").map(Number).reduce((a, b) => a + b, 0)' },
            ctx
        );
        expect(result).toBe(6);
    });

    test('script returns undefined for statements without return value', async () => {
        const result = await tool.callAsync(
            { file: 'data.txt', script: 'var x = 1;' },
            ctx
        );
        expect(result).toBeUndefined();
    });

    test('script can use string methods on fileContent', async () => {
        const result = await tool.callAsync(
            { file: 'data.txt', script: 'fileContent.length' },
            ctx
        );
        expect(result).toBe(13);
    });

    test('script can use JSON.parse and JSON.stringify', async () => {
        const jsonCtx = makeContext([{ name: 'j.json', content: '{"a":1,"b":2}' }]);
        const result = await tool.callAsync(
            { file: 'j.json', script: 'JSON.stringify(JSON.parse(fileContent))' },
            jsonCtx
        );
        expect(result).toBe('{"a":1,"b":2}');
    });

    test('selects correct file from multiple files', async () => {
        const result = await tool.callAsync(
            { file: 'nums.txt', script: 'fileContent' },
            ctx
        );
        expect(result).toBe('1\n2\n3');
    });
});

describe('QuickJSTool error handling', () => {
    const ctx = makeContext([{ name: 'a.txt', content: '' }]);

    test('returns QuickJS error for syntax errors', async () => {
        const result = await tool.callAsync(
            { file: 'a.txt', script: 'function(' },
            ctx
        );
        expect(result).toContain('[QuickJS Error]');
    });

    test('returns QuickJS error for runtime exceptions', async () => {
        const result = await tool.callAsync(
            { file: 'a.txt', script: 'throw new Error("boom")' },
            ctx
        );
        expect(result).toContain('[QuickJS Error]');
    });

    test('returns QuickJS error for reference errors', async () => {
        const result = await tool.callAsync(
            { file: 'a.txt', script: 'undefinedVar.prop' },
            ctx
        );
        expect(result).toContain('[QuickJS Error]');
    });
});
