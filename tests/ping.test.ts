import './setup.ts';
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { ChatInputCommandInteraction } from 'discord.js';

const { default: pingCommand } = await import('../src/commands/ping.js');

describe('ping command', () => {
	it('has correct slash command name and description', () => {
		assert.equal(pingCommand.data.name, 'ping');
		assert.equal(pingCommand.data.description, 'Replies with Pong!');
	});

	it('replies with "Pong!" when executed', async () => {
		const replyMock = mock.fn(async (_content: string) => ({}));
		const interaction = {
			reply: replyMock,
		} as unknown as ChatInputCommandInteraction;

		await pingCommand.execute(interaction);

		assert.equal(replyMock.mock.callCount(), 1);
		assert.deepEqual(replyMock.mock.calls[0]?.arguments, ['Pong!']);
	});
});
