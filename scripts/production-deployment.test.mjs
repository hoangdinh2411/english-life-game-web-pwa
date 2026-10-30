import assert from 'node:assert/strict';
import test from 'node:test';
import { requireHttpsProductionUrl, validateProductionEnvironment } from './deployment-safety.mjs';
import { validateAssetManifest } from './production-asset-pack.mjs';

const validEnvironment = () => ({
  DEPLOYMENT_TARGET: 'production',
  RELEASE_COMMIT_SHA: 'a'.repeat(40),
  DATABASE_URL: 'postgresql://db.example.com/game',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-that-is-long-enough',
  PRODUCTION_CONTENT_API_URL: 'https://api.example.com/api/v1',
  API_ORIGIN: 'https://api.example.com',
  CLIENT_ORIGIN: 'https://game.example.com',
  RENDER_API_KEY: 'render-key',
  RENDER_API_SERVICE_ID: 'api-service',
  RENDER_CLIENT_SERVICE_ID: 'client-service',
});

test('production validation fails closed for the wrong target, missing secrets and local URLs', () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment(), DEPLOYMENT_TARGET: 'staging' }), /exactly production/);
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment(), SUPABASE_SERVICE_ROLE_KEY: '' }), /required/);
  assert.throws(() => requireHttpsProductionUrl('API_ORIGIN', 'http://localhost:3000'), /non-local HTTPS/);
});

test('production validation rejects service-role exposure through Vite variables', () => {
  const environment = validEnvironment();
  assert.throws(() => validateProductionEnvironment({ ...environment, VITE_LEAKED_KEY: environment.SUPABASE_SERVICE_ROLE_KEY }),
    /must never be exposed/);
  assert.deepEqual(validateProductionEnvironment(environment), { target: 'production', releaseCommitSha: 'a'.repeat(40) });
});

test('asset manifest validation rejects malformed input before any network or mutation', async () => {
  await assert.rejects(validateAssetManifest('unused', { schemaVersion: 2, maps: {} }), /Malformed production asset manifest/);
});

