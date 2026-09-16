// Environment, target ref, required settings and baseline checks. No data is written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { assertTarget, HarnessRefusal, loadEnv, ROOT, ALLOWED_URL } from './helpers/env.mjs';
import { anonClient, testAuth } from './helpers/sessions.mjs';
import { standalone } from './helpers/runner.mjs';

export async function preflight(ctx, feature) {
  await feature.step('target guard refuses forbidden/other projects before any request', 'LOCAL', async () => {
    for (const bad of ['https://fiaxchvyywpqbwbcuzfz.supabase.co', 'https://sdfyostmwedvonwmmnej.supabase.co', 'https://example.supabase.co'])
      assert.throws(() => assertTarget(bad, 'sb_publishable_x'), HarnessRefusal);
    assert.throws(() => assertTarget(ALLOWED_URL, 'sb_secret_x'), HarnessRefusal);
  });
  await feature.step('.env.local points at bndguguarijmghnkenvt with a publishable key', 'LOCAL', async () => {
    loadEnv();
    return { url: ALLOWED_URL, keyKind: 'publishable' };
  });
  await feature.step('no service-role/secret key referenced by browser code', 'LOCAL', async () => {
    const hits = execSync("grep -rlE 'sb_secret_|service_role|SERVICE_ROLE' src || true", { cwd: ROOT }).toString().trim();
    assert.equal(hits, '', `browser source mentions secret keys: ${hits}`);
  });
  await feature.step('git state recorded', 'LOCAL', async () => ({
    head: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
    changedFiles: execSync('git status --short', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean).length,
  }));
  await feature.step('Supabase Auth reachable on the allowed project', 'REMOTE', async () => {
    const { url, key } = loadEnv();
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
    assert.equal(response.status, 200);
  });
  await feature.step('test-phone-auth active (request step answers 200, no user created)', 'REMOTE', async () => {
    const result = await testAuth('request', '01092709999', { mode: 'login' });
    assert.equal(result.status, 200, `test-phone-auth HTTP ${result.status}: expired or disabled — do not extend automatically`);
  });
  await feature.step('local migrations are named with remote versions', 'LOCAL', async () => {
    const files = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(name => name.endsWith('.sql'));
    assert.ok(files.every(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)), 'unversioned migration file present');
    return { localMigrations: files.length };
  });
}

standalone(import.meta.url, 'preflight', preflight);
