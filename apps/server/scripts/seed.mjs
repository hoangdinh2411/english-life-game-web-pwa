import 'reflect-metadata';
import './load-env.mjs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../dist/infrastructure/database/database.service.js';
import { loadSeedContent } from '../dist/infrastructure/content/seed-content.js';
import { seedContent } from '../dist/infrastructure/content/seed.repository.js';
import { SpeechProfileService } from '../dist/modules/speech/speech-profile.service.js';
import { FixedSpeechService } from '../dist/modules/speech/fixed-speech.service.js';
import { PostgresSpeechCacheRepository } from '../dist/modules/speech/speech-cache.repository.js';
import { SupabaseSpeechAudioStorage } from '../dist/modules/speech/speech-audio.storage.js';
import { AzureSpeechProvider } from '../dist/modules/speech/azure-speech.provider.js';
import { AzureFixedSpeechGenerator } from '../dist/modules/speech/azure-fixed-speech.generator.js';
import { prewarmTaxOfficeSpeech } from '../dist/modules/speech/tax-office-speech-prewarm.js';

const database = new DatabaseService(new ConfigService(process.env));
try {
  const content = await loadSeedContent(resolve('../../content'));
  await database.transaction(client => seedContent(client, content));
  process.stdout.write(`Seeded ${content.npcs.length} NPCs, ${content.moods.length} moods, ${content.quests.length} quests, ${content.shops.length} shop items and ${content.dialogues.reduce((count, file) => count + file.nodes.length, 0)} dialogue nodes.\n`);
  const speechConfigured = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .every(name => process.env[name]?.trim());
  if (speechConfigured) {
    const profiles = new SpeechProfileService(database);
    const config = new ConfigService(process.env);
    const fixed = new FixedSpeechService(new PostgresSpeechCacheRepository(database),
      new SupabaseSpeechAudioStorage(config), new AzureFixedSpeechGenerator(new AzureSpeechProvider(config)));
    const count = await prewarmTaxOfficeSpeech(content, profiles, fixed);
    process.stdout.write(`Pre-generated ${count} fixed tax-office speech entries.\n`);
  } else {
    process.stdout.write('Skipped fixed tax-office speech pre-generation because Azure or Supabase Storage is not configured.\n');
  }
} finally { await database.onApplicationShutdown(); }
