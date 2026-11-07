import { Client, Collection, Events, GatewayIntentBits, type Interaction } from 'discord.js';
import deployCommands from './deployCommands.js';
import type { Command, DiscordCredentials } from './types.js';

export default class DiscordBot {
	private readonly client: Client;
	private readonly commands: Collection<string, Command>;
	private readonly credentials: DiscordCredentials;

	constructor(commands: Collection<string, Command>, credentials: DiscordCredentials) {
		this.commands = commands;
		this.credentials = credentials;
		this.client = new Client({ intents: [GatewayIntentBits.Guilds] });

		this.client.on(Events.InteractionCreate, interaction => this.handleInteraction(interaction));
	}

	public async start(): Promise<void> {
		await this.client.login(this.credentials.token);
		await deployCommands(this.commands, this.credentials);
	}

	private async handleInteraction(interaction: Interaction): Promise<void> {
		if (!interaction.isChatInputCommand()) return;

		const command = this.commands.get(interaction.commandName);

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
	}
}
