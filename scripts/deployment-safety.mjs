const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function requireProductionConfirmation(environment, expectedSha) {
  if (environment !== 'production') throw new Error('DEPLOYMENT_TARGET must be exactly production.');
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '')) throw new Error('RELEASE_COMMIT_SHA must be a full lowercase Git SHA.');
}

export function requireHttpsProductionUrl(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (url.protocol !== 'https:' || localHosts.has(url.hostname)) throw new Error(`${name} must use non-local HTTPS.`);
  return url;
}

export function validateProductionEnvironment(environment = process.env) {
  requireProductionConfirmation(environment.DEPLOYMENT_TARGET, environment.RELEASE_COMMIT_SHA);
  for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'PRODUCTION_CONTENT_API_URL', 'API_ORIGIN', 'CLIENT_ORIGIN', 'RENDER_API_KEY', 'RENDER_API_SERVICE_ID',
    'RENDER_CLIENT_SERVICE_ID']) {
    if (!environment[name]) throw new Error(`${name} is required.`);
  }
  for (const name of ['SUPABASE_URL', 'PRODUCTION_CONTENT_API_URL', 'API_ORIGIN', 'CLIENT_ORIGIN']) {
    requireHttpsProductionUrl(name, environment[name]);
  }
  if (environment.SUPABASE_PUBLISHABLE_KEY === environment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase publishable and service-role keys must be different.');
  }
  if ((environment.SUPABASE_SERVICE_ROLE_KEY ?? '').length < 32) throw new Error('SUPABASE_SERVICE_ROLE_KEY is unexpectedly short.');
  for (const [name, value] of Object.entries(environment)) {
    if (name.startsWith('VITE_') && value === environment.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(`Service-role credentials must never be exposed through ${name}.`);
    }
  }
  return { target: 'production', releaseCommitSha: environment.RELEASE_COMMIT_SHA };
}

