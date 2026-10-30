import { requireHttpsProductionUrl } from './deployment-safety.mjs';

const apiOrigin = requireHttpsProductionUrl('API_ORIGIN', process.env.API_ORIGIN).origin;
const clientOrigin = requireHttpsProductionUrl('CLIENT_ORIGIN', process.env.CLIENT_ORIGIN).origin;
const supabaseOrigin = requireHttpsProductionUrl('SUPABASE_URL', process.env.SUPABASE_URL).origin;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.PRODUCTION_SMOKE_EMAIL;
const password = process.env.PRODUCTION_SMOKE_PASSWORD;
if (!publishableKey || !email || !password) throw new Error('Production smoke credentials are required.');

const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: globalThis.AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Smoke request failed for ${new URL(url).pathname} (${response.status}).`);
  return response;
};

const health = await request(`${apiOrigin}/api/v1/health`);
if ((await health.json()).status !== 'ok') throw new Error('Production health response is not healthy.');
const practice = await request(`${clientOrigin}/practice`);
if (!(practice.headers.get('content-type') ?? '').includes('text/html') || !(await practice.text()).includes('<div id="root">')) {
  throw new Error('Production /practice did not return the client shell.');
}

const auth = await request(`${supabaseOrigin}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const token = (await auth.json()).access_token;
if (!token) throw new Error('Production smoke authentication returned no access token.');
const authorization = { Authorization: `Bearer ${token}` };
await request(`${apiOrigin}/api/v1/life/catalog`, { headers: authorization });

for (const pageId of ['move', 'interact', 'goals', 'practice', 'menu']) {
  const response = await request(`${apiOrigin}/api/v1/tutorial/speech/${pageId}`, { headers: authorization });
  const { url } = await response.json();
  const audio = await request(url);
  const mime = audio.headers.get('content-type') ?? '';
  const bytes = (await audio.arrayBuffer()).byteLength;
  if (!mime.startsWith('audio/') || bytes === 0) throw new Error(`Tutorial audio ${pageId} is invalid.`);
}
console.log(JSON.stringify({ health: 'ok', practiceShell: 'ok', authenticatedCatalog: 'ok', tutorialAudioPages: 5 }));

