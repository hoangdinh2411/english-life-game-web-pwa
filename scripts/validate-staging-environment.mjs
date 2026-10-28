const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLIENT_ORIGIN',
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}

const urls = ['DATABASE_URL', 'SUPABASE_URL', 'CLIENT_ORIGIN'];
for (const name of urls) {
  const value = process.env[name];
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error(`${name} must not point to localhost.`);
  if (url.protocol !== 'https:' && name !== 'DATABASE_URL') throw new Error(`${name} must use HTTPS.`);
}

if (process.env.SUPABASE_PUBLISHABLE_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase publishable and service-role keys must be different.');
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY.length < 32) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is unexpectedly short.');
}

console.log(JSON.stringify({ validated: required }));
