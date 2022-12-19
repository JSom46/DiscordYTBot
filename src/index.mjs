await import('dotenv').then(res => res.config());
import { Client, Events, GatewayIntentBits } from 'discord.js';

import loadCommands from './loadCommands.mjs';
import deployCommands from "./deployCommands.mjs";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Log in to Discord with your client's token
await client.login(process.env.TOKEN);

// load and deploy commands
client.commands = await loadCommands();
await deployCommands(client.commands);

// listen for interaction
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});
