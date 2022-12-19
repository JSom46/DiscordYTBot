import { Collection } from "discord.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function(commandsPath = path.join(__dirname, 'commands')){
    const commands = new Collection();
    const files = await fs.readdir(commandsPath);

    console.log('loading commands');

    for(const file of files){
        const { default: command } = await import(`./commands/${file}`);

        if(command.data === undefined || command.execute === undefined){
            console.warn(`${file} does not contain valid command`);
            continue;
        }

        console.log(`${file} command loaded successfully`);
        commands.set(command.data.name, command);
    }

    return commands;
};
