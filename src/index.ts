await import('dotenv').then(res => res.config());

import path from 'path';
import { fileURLToPath } from 'url';
import DiscordBot from './DiscordBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TOKEN;
const appId = process.env.APP_ID;
const commandsPath = path.join(__dirname, 'commands');

const bot = new DiscordBot({ token, appId }, commandsPath);
await bot.start();
