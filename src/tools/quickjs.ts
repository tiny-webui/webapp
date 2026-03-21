import { getQuickJS } from "@tootallnate/quickjs-emscripten";
import { BaseTool } from "./base";

const qjs = await getQuickJS();

export interface QuickJSToolContext {
    files: Array<{
        name: string;
        content: string;
    }>;
};

export class QuickJSTool extends BaseTool {
    get name(): string {
        return 'quickjs';
    }

    get description(): string {
        return 'Execute a JavaScript script using QuickJS (ES2023 compatible, no Node.js APIs). The specified file content is pre-loaded into a const fileContent string variable. The last expression\'s value will be returned as the output.';
    }

    get paramSchema(): unknown {
        return {
            type: 'object',
            properties: {
                file: {
                    type: "string",
                    description: 'The name of the context file to process (as returned by list_files). Its content will be in the variable fileContent.'
                },
                script: {
                    type: 'string',
                    description: 'The JavaScript code to execute. The file content is already available as the string variable fileContent. The last expression\'s value will be returned as the output.'
                }
            },
            required: ['file', 'script'],
        }
    }

    async callAsync(params: unknown, context: unknown): Promise<string> {
        const ctx = context as QuickJSToolContext;
        if (!Array.isArray(ctx.files)) {
            throw new Error('Invalid context: files array is required.');
        }
        for (const file of ctx.files) {
            if (typeof file.name !== 'string' || typeof file.content !== 'string') {
                throw new Error('Invalid context: each file must have a name and content string.');
            }
        }

        /** parameter errors should be returned to the caller as valid result */
        if (typeof params !== 'object' || params === null) {
            return '[Tool Error] Invalid parameters: expected an object.';
        }
        if (!('file' in params) || typeof params.file !== 'string') {
            return '[Tool Error] Invalid parameters: file is required and must be a string.';
        }
        if (!('script' in params) || typeof params.script !== 'string') {
            return '[Tool Error] Invalid parameters: script is required and must be a string.';
        }
        const file = ctx.files.find(f => f.name === params.file);
        if (!file) {
            return `[Tool Error] File not found: ${params.file}`;
        }

        const vm = qjs.newContext();
        const fileContent = vm.newString(file.content);
        vm.setProp(vm.global, 'fileContent', fileContent);
        fileContent.dispose();
        const result = vm.evalCode(params.script);
        if (result.error) {
            const error = vm.dump(result.error);
            result.error.dispose();
            vm.dispose();
            return `[QuickJS Error] ${error.name}: ${error.message}`;
        } else {
            const output = vm.dump(result.value);
            result.value.dispose();
            vm.dispose();
            if (typeof output === 'object') {
                return JSON.stringify(output);
            } else {
                return `${output}`;
            }
        }
    }
}
