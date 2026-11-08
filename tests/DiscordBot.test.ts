import { clearVirtualModules, registerVirtualModule } from './setup.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
	Client,
	Events,
	REST,
	Routes,
	type Interaction,
} from 'discord.js';
import fs from 'fs/promises';
import type { DiscordCredentials } from '../src/types.js';

const { default: DiscordBot } = await import('../src/DiscordBot.js');

describe('DiscordBot', () => {
	const credentials: DiscordCredentials = {
		token: 'bot-secret-token',
		appId: 'bot-app-id',
	};

	beforeEach(() => {
		mock.method(console, 'log', () => {});
		mock.method(console, 'warn', () => {});
		mock.method(console, 'error', () => {});
	});

	afterEach(() => {
		clearVirtualModules();
		mock.restoreAll();
	});

	it('throws an error when credentials are undefined', () => {
		assert.throws(
			() => new DiscordBot(undefined),
			{
				name: 'Error',
				message: 'Missing TOKEN environment variable.',
			}
		);
	});

	it('throws an error when token is missing', () => {
		assert.throws(
			() => new DiscordBot({ token: undefined, appId: 'bot-app-id' }),
			{
				name: 'Error',
				message: 'Missing TOKEN environment variable.',
			}
		);
	});

	it('throws an error when appId is missing', () => {
		assert.throws(
			() => new DiscordBot({ token: 'bot-secret-token', appId: undefined }),
			{
				name: 'Error',
				message: 'Missing APP_ID environment variable.',
			}
		);
	});

	it('registers an InteractionCreate listener on the client upon construction', () => {
		const onMock = mock.method(Client.prototype, 'on');

		new DiscordBot(credentials);

		const interactionListeners = onMock.mock.calls.filter(
			call => call.arguments[0] === Events.InteractionCreate
		);
		assert.equal(interactionListeners.length, 1);
		assert.equal(typeof interactionListeners[0]?.arguments[1], 'function');
	});

	it('logs in the client, loads commands from default path (including subdirectories), and deploys them via REST API on start()', async () => {
		const callOrder: string[] = [];

		registerVirtualModule(
			'./commands/first.ts',
			'export default { data: { name: "first" }, execute: async () => {} };'
		);
		registerVirtualModule(
			'./commands/music/second.js',
			'export default { data: { name: "second" }, execute: async () => {} };'
		);

		const readdirMock = mock.method(fs, 'readdir', async () => {
			callOrder.push('load');
			return ['first.ts', 'music', 'music/second.js'] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
		});
		const loginMock = mock.method(Client.prototype, 'login', async (token?: string) => {
			callOrder.push('login');
			return token ?? '';
		});
		const setTokenMock = mock.method(REST.prototype, 'setToken', function (this: REST) {
			return this;
		});
		const putMock = mock.method(REST.prototype, 'put', async () => {
			callOrder.push('deploy');
			return [{}, {}];
		});

		const bot = new DiscordBot(credentials);

		await bot.start();

		assert.equal(loginMock.mock.callCount(), 1);
		assert.deepEqual(loginMock.mock.calls[0]?.arguments, ['bot-secret-token']);

		assert.equal(readdirMock.mock.callCount(), 1);
		const calledPath = String(readdirMock.mock.calls[0]?.arguments[0]);
		assert.equal(path.basename(calledPath), 'commands');
		assert.deepEqual(readdirMock.mock.calls[0]?.arguments[1], { recursive: true });

		assert.equal(setTokenMock.mock.callCount(), 1);
		assert.deepEqual(setTokenMock.mock.calls[0]?.arguments, ['bot-secret-token']);

		assert.equal(putMock.mock.callCount(), 1);
		assert.deepEqual(putMock.mock.calls[0]?.arguments, [
			Routes.applicationCommands('bot-app-id'),
			{ body: [{ name: 'first' }, { name: 'second' }] },
		]);

		assert.deepEqual(callOrder, ['login', 'load', 'deploy']);
	});

	it('reads from custom commandsPath, filters out non-command and .d.ts files, and skips invalid command modules', async () => {
		registerVirtualModule(
			'./commands/missingData.js',
			'export default { execute: async () => {} };'
		);
		registerVirtualModule(
			'./commands/sub/missingExecute.ts',
			'export default { data: { name: "broken" } };'
		);
		registerVirtualModule(
			'./commands/noDefault.js',
			'export const somethingElse = 42;'
		);
		registerVirtualModule(
			'./commands/sub/validCmd.ts',
			'export default { data: { name: "valid" }, execute: async () => {} };'
		);

		const readdirMock = mock.method(fs, 'readdir', async () => [
			'missingData.js',
			'sub',
			'sub/missingExecute.ts',
			'noDefault.js',
			'sub/validCmd.ts',
			'types.d.ts',
			'README.md',
			'config.json',
		] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
		mock.method(Client.prototype, 'login', async () => 'token');
		mock.method(REST.prototype, 'setToken', function (this: REST) {
			return this;
		});
		const putMock = mock.method(REST.prototype, 'put', async () => [{}]);
		const warnMock = mock.method(console, 'warn', () => {});

		const bot = new DiscordBot(credentials, '/custom/commands/path');
		await bot.start();

		assert.equal(readdirMock.mock.callCount(), 1);
		assert.deepEqual(readdirMock.mock.calls[0]?.arguments, ['/custom/commands/path', { recursive: true }]);

		assert.equal(warnMock.mock.callCount(), 3);
		assert.deepEqual(warnMock.mock.calls[0]?.arguments, ['missingData.js does not contain valid command']);
		assert.deepEqual(warnMock.mock.calls[1]?.arguments, ['sub/missingExecute.ts does not contain valid command']);
		assert.deepEqual(warnMock.mock.calls[2]?.arguments, ['noDefault.js does not contain valid command']);

		assert.equal(putMock.mock.callCount(), 1);
		assert.deepEqual(putMock.mock.calls[0]?.arguments, [
			Routes.applicationCommands('bot-app-id'),
			{ body: [{ name: 'valid' }] },
		]);
	});

	it('ignores interactions that are not chat input commands', async () => {
		let registeredHandler: ((interaction: Interaction) => Promise<void>) | undefined;
		mock.method(Client.prototype, 'on', function (this: Client, event: string, listener: (...args: any[]) => any) {
			if (event === Events.InteractionCreate) {
				registeredHandler = listener;
			}
			return this;
		});

		let executed = false;
		registerVirtualModule(
			'./commands/ping.ts',
			'export default { data: { name: "ping" }, execute: async (interaction) => { interaction.markExecuted(); } };'
		);
		mock.method(fs, 'readdir', async () => ['ping.ts'] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
		mock.method(Client.prototype, 'login', async () => 'token');
		mock.method(REST.prototype, 'setToken', function (this: REST) {
			return this;
		});
		mock.method(REST.prototype, 'put', async () => [{}]);

		const bot = new DiscordBot(credentials);
		await bot.start();
		assert.ok(registeredHandler);

		const nonChatInteraction = {
			isChatInputCommand: () => false,
			commandName: 'ping',
			markExecuted: () => {
				executed = true;
			},
		} as unknown as Interaction;

		await registeredHandler(nonChatInteraction);

		assert.equal(executed, false);
	});

	it('logs an error when receiving an unknown command name', async () => {
		let registeredHandler: ((interaction: Interaction) => Promise<void>) | undefined;
		mock.method(Client.prototype, 'on', function (this: Client, event: string, listener: (...args: any[]) => any) {
			if (event === Events.InteractionCreate) {
				registeredHandler = listener;
			}
			return this;
		});
		const errorMock = mock.method(console, 'error', () => {});

		new DiscordBot(credentials);
		assert.ok(registeredHandler);

		const unknownInteraction = {
			isChatInputCommand: () => true,
			commandName: 'nonexistent',
		} as unknown as Interaction;

		await registeredHandler(unknownInteraction);

		assert.equal(errorMock.mock.callCount(), 1);
		assert.deepEqual(errorMock.mock.calls[0]?.arguments, [
			'No command matching nonexistent was found.',
		]);
	});

	it('executes the matching command when a valid chat input interaction arrives', async () => {
		let registeredHandler: ((interaction: Interaction) => Promise<void>) | undefined;
		mock.method(Client.prototype, 'on', function (this: Client, event: string, listener: (...args: any[]) => any) {
			if (event === Events.InteractionCreate) {
				registeredHandler = listener;
			}
			return this;
		});

		registerVirtualModule(
			'./commands/ping.ts',
			'export default { data: { name: "ping" }, execute: async (interaction) => { await interaction.reply("Pong!"); } };'
		);
		mock.method(fs, 'readdir', async () => ['ping.ts'] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
		mock.method(Client.prototype, 'login', async () => 'token');
		mock.method(REST.prototype, 'setToken', function (this: REST) {
			return this;
		});
		mock.method(REST.prototype, 'put', async () => [{}]);

		const bot = new DiscordBot(credentials);
		await bot.start();
		assert.ok(registeredHandler);

		const replyMock = mock.fn(async (_msg: string) => ({}));
		const validInteraction = {
			isChatInputCommand: () => true,
			commandName: 'ping',
			reply: replyMock,
		} as unknown as Interaction;

		await registeredHandler(validInteraction);

		assert.equal(replyMock.mock.callCount(), 1);
		assert.deepEqual(replyMock.mock.calls[0]?.arguments, ['Pong!']);
	});

	it('logs the error and replies with an ephemeral error message when command execution throws', async () => {
		let registeredHandler: ((interaction: Interaction) => Promise<void>) | undefined;
		mock.method(Client.prototype, 'on', function (this: Client, event: string, listener: (...args: any[]) => any) {
			if (event === Events.InteractionCreate) {
				registeredHandler = listener;
			}
			return this;
		});
		const errorMock = mock.method(console, 'error', () => {});

		registerVirtualModule(
			'./commands/failing.ts',
			'export default { data: { name: "failing" }, execute: async () => { throw new Error("Database connection failed"); } };'
		);
		mock.method(fs, 'readdir', async () => ['failing.ts'] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
		mock.method(Client.prototype, 'login', async () => 'token');
		mock.method(REST.prototype, 'setToken', function (this: REST) {
			return this;
		});
		mock.method(REST.prototype, 'put', async () => [{}]);

		const bot = new DiscordBot(credentials);
		await bot.start();
		assert.ok(registeredHandler);

		const replyMock = mock.fn(async () => ({}));
		const failingInteraction = {
			isChatInputCommand: () => true,
			commandName: 'failing',
			reply: replyMock,
		} as unknown as Interaction;

		await registeredHandler(failingInteraction);

		assert.equal(errorMock.mock.callCount(), 1);
		const loggedError = errorMock.mock.calls[0]?.arguments[0] as Error;
		assert.equal(loggedError?.message, 'Database connection failed');

		assert.equal(replyMock.mock.callCount(), 1);
		assert.deepEqual(replyMock.mock.calls[0]?.arguments, [
			{ content: 'There was an error while executing this command!', ephemeral: true },
		]);
	});
});
