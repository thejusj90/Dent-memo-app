import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('docs/consent/app.js', 'utf8');
const sw = readFileSync('docs/consent/sw.js', 'utf8');
const manifest = JSON.parse(readFileSync('docs/consent/manifest.webmanifest', 'utf8'));
const vercel = JSON.parse(readFileSync('docs/consent/vercel.json', 'utf8'));

test('Consent is configured as an installable offline-first PWA', () => {
  assert.equal(manifest.display, 'standalone');
  assert.match(app, /indexedDB\.open/);
  assert.match(app, /AES-GCM/);
  assert.match(app, /serviceWorker.*register/);
  assert.match(sw, /offline\.html/);
  assert.match(sw, /supabase\.co/);
});

test('signed consent is queued locally before cloud sync', () => {
  const queuePos = app.indexOf('await queueBundle');
  const syncPos = app.indexOf('if(online())syncAll()', queuePos);
  assert.ok(queuePos > 0, 'queueBundle must be used during submit');
  assert.ok(syncPos > queuePos, 'sync must occur after durable local queueing');
  assert.match(app, /dm-consent-documents/);
  assert.match(app, /dm_consents/);
  assert.match(app, /consent-email/);
});

test('offline clinical payload is not stored in localStorage', () => {
  const localStorageUses = [...app.matchAll(/localStorage\.(?:getItem|setItem)\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(localStorageUses.length > 0);
  assert.ok(localStorageUses.every(x => x.includes('dm_consent_device_id')));
  assert.match(app, /dbPut\('pending'/);
});

test('cloud clinical APIs are deliberately excluded from service-worker caching', () => {
  assert.match(sw, /if\(url\.hostname\.endsWith\('supabase\.co'\)\) return/);
});

test('Vercel root serves the offline-first Consent app', () => {
  assert.deepEqual(vercel.rewrites?.[0], { source: '/', destination: '/offline.html' });
});
