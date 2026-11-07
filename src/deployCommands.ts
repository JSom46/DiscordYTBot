import { Collection, REST, Routes } from 'discord.js';
import type { Command, DiscordCredentials } from './types.js';

// and deploy your commands!
export default async function(
    commands: Collection<string, Command>,
    credentials?: DiscordCredentials
): Promise<void> {
    // extract data from commands
    const commandsData = [];

    for(const command of commands.values()){
        commandsData.push(command.data);
    }

    if (credentials?.token === undefined) {
        throw new Error('Missing TOKEN environment variable.');
    }

    if (credentials?.appId === undefined) {
        throw new Error('Missing APP_ID environment variable.');
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(credentials.token);

	console.log(`refreshing ${commandsData.length} application (/) command(s)`);

	// The put method is used to fully refresh all commands in the guild with the current set
	const data = (await rest.put(
		Routes.applicationCommands(credentials.appId),
		{ body: commandsData }
	)) as unknown[];

	console.log(`reloaded ${data.length} application (/) command(s)`);
};
