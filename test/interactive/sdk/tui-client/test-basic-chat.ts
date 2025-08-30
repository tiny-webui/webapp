import { exit } from "process";
import { TUIClient } from "../../../../src/sdk/tui-client";
import fs from 'fs';
import readline from "readline";

const username = 'username';
const password = 'password';
const url = '127.0.0.1:12345';

if (process.argv.length < 3) {
    console.log('Please specify the credential file');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(process.argv[2]).toString());

const client = new TUIClient(url, (error) => {
    console.error(`Connection closed: ${error}`);
    process.exit(1);
}, () => {
    console.warn('Was under attack');
});

await client.connectAsync(username, password);

const modelList = await client.getModelListAsync({});

console.log(`Got model list of len ${modelList.length}`);

const modelId = modelList[0]?.id ?? await client.newModelAsync({
    providerName: 'AzureOpenAI',
    providerParams: config
});

console.log(`using model ${modelId}`);

const chatList = await client.getChatListAsync({start:0, quantity: 50});

console.log(`Got chat list of len ${chatList.length}`);

const chatId = await client.newChatAsync();

console.log(`using chat ${chatId}`);

const lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let parentId = undefined;
while(true)
{
    const userMessage = await new Promise<string>((resolve) => {
        lineReader.question('User: \n', (input) => {
            resolve(input);
        })
    });
    console.log("")

    const stream = client.chatCompletionAsync({
        id: chatId,
        modelId: modelId,
        parent: parentId,
        userMessage: {
            role: 'user',
            content:[{
                type: 'text',
                data: userMessage
            }]
        }
    });

    console.log("Assistant: ");
    let result = undefined;
    while(!(result = await stream.next()).done){
        const chunk = result.value;
        process.stdout.write(chunk);
    }
    console.log("\n");
    /** The chat info */
    if (result === undefined) {
        console.error("No result received from chat completion.");
        exit(1);
    }
    const info = result.value;
    parentId = info.assistantMessageId;
}

