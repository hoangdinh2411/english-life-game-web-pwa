const origin = process.env.API_ORIGIN;
if (!origin) throw new Error('API_ORIGIN is required.');
const url = new URL('/api/v1/health', origin.endsWith('/') ? origin : `${origin}/`);
if (url.protocol !== 'https:') throw new Error('API_ORIGIN must use HTTPS.');
const response = await fetch(url, { signal: globalThis.AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Staging health check failed (${response.status}).`);
const body = await response.json();
if (body.status !== 'ok') throw new Error(`Unexpected staging health response: ${JSON.stringify(body)}`);
console.log(JSON.stringify({ url: url.href, status: 'ok' }));
