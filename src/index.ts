await import('dotenv').then(res => res.config());

import DiscordBot from './DiscordBot.js';
import loadCommands from './loadCommands.js';

const token = process.env.TOKEN;
const appId = process.env.APP_ID;

if (!token) {
	throw new Error('Missing TOKEN environment variable.');
}
if (!appId) {
	throw new Error('Missing APP_ID environment variable.');
}

const commands = await loadCommands();
const bot = new DiscordBot(commands, { token, appId });
await bot.start();
