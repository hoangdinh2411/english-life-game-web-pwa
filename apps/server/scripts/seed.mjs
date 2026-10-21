import 'reflect-metadata';
import './load-env.mjs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../dist/infrastructure/database/database.service.js';
import { loadSeedContent } from '../dist/infrastructure/content/seed-content.js';
import { seedContent } from '../dist/infrastructure/content/seed.repository.js';

const database = new DatabaseService(new ConfigService(process.env));
try {
  const content = await loadSeedContent(resolve('../../content'));
  await database.transaction(client => seedContent(client, content));
  process.stdout.write(`Seeded ${content.npcs.length} NPCs, ${content.moods.length} moods, ${content.quests.length} quests, ${content.shops.length} shop items and ${content.dialogues.reduce((count, file) => count + file.nodes.length, 0)} dialogue nodes.\n`);
} finally { await database.onApplicationShutdown(); }
