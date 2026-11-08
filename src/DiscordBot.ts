import { Client, Collection, Events, GatewayIntentBits, REST, Routes, type Interaction } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Command, DiscordCredentials } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class DiscordBot {
	private readonly client: Client;
	private readonly commands: Collection<string, Command>;
	private readonly commandsPath: string;
	private readonly credentials: DiscordCredentials;

	constructor(credentials?: Partial<DiscordCredentials>, commandsPath: string = path.join(__dirname, 'commands')) {
		if (!credentials?.token) {
			throw new Error('Missing TOKEN environment variable.');
		}
		if (!credentials?.appId) {
			throw new Error('Missing APP_ID environment variable.');
		}

		this.commands = new Collection<string, Command>();
		this.commandsPath = commandsPath;
		this.credentials = { token: credentials.token, appId: credentials.appId };
		this.client = new Client({ intents: [GatewayIntentBits.Guilds] });

		this.client.on(Events.InteractionCreate, interaction => this.handleInteraction(interaction));
	}

	public async start(): Promise<void> {
		await this.client.login(this.credentials.token);
		await this.loadCommands();
		await this.deployCommands();
	}

	private async loadCommands(): Promise<void> {
		const files = (await fs.readdir(this.commandsPath)).filter(
			file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')
		);

		console.log('loading commands');

		for (const file of files) {
			const filePath = path.join(this.commandsPath, file);
			const { default: command } = (await import(filePath)) as { default?: Command };

			if (command?.data === undefined || command?.execute === undefined) {
				console.warn(`${file} does not contain valid command`);
				continue;
			}

			console.log(`${file} command loaded successfully`);
			this.commands.set(command.data.name, command);
		}
	}

	private async deployCommands(): Promise<void> {
		const commandsData = [];

		for (const command of this.commands.values()) {
			commandsData.push(command.data);
		}

		const rest = new REST().setToken(this.credentials.token);

		console.log(`refreshing ${commandsData.length} application (/) command(s)`);

		const data = (await rest.put(
			Routes.applicationCommands(this.credentials.appId),
			{ body: commandsData }
		)) as unknown[];

		console.log(`reloaded ${data.length} application (/) command(s)`);
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
