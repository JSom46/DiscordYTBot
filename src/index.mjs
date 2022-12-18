'use strict'

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import ytdl from 'ytdl-core';
// TypeScript: import ytdl from 'ytdl-core'; with --esModuleInterop
// TypeScript: import * as ytdl from 'ytdl-core'; with --allowSyntheticDefaultImports
// TypeScript: import ytdl = require('ytdl-core'); with neither of the above

const videoStream = ytdl('https://www.youtube.com/watch?v=OiuYl0oeDDE', {
  filter: format => format.container === 'mp4' && format.hasVideo === false && format.hasAudio === true
})
  .pipe(fs.createWriteStream(path.join(__dirname, '../output', 'video.mp3')));
