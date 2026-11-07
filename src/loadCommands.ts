import { Collection } from "discord.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Command } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function(commandsPath: string = path.join(__dirname, 'commands')): Promise<Collection<string, Command>> {
    const commands = new Collection<string, Command>();
    const files = (await fs.readdir(commandsPath)).filter(
        file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')
    );

    console.log('loading commands');

    for(const file of files){
        const { default: command } = (await import(`./commands/${file}`)) as { default?: Command };

        if(command?.data === undefined || command?.execute === undefined){
            console.warn(`${file} does not contain valid command`);
            continue;
        }

        console.log(`${file} command loaded successfully`);
        commands.set(command.data.name, command);
    }

    return commands;
};
