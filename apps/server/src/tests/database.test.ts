import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../infrastructure/database/database.service';

test('missing database configuration fails closed without preventing shutdown', async () => {
  const database = new DatabaseService(new ConfigService({}));
  assert.throws(() => database.query('SELECT 1'), /Database is not configured/);
  await assert.rejects(database.transaction(async () => undefined), /Database is not configured/);
  await database.onApplicationShutdown();
});
