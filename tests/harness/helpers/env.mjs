// Harness environment guard. Only the designated project may receive remote requests.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ALLOWED_REF = 'bndguguarijmghnkenvt';
export const ALLOWED_URL = `https://${ALLOWED_REF}.supabase.co`;
// Blocklist fixtures only: these strings are compared, never used as a request target.
export const FORBIDDEN_REFS = ['fiaxchvyywpqbwbcuzfz', 'sdfyostmwedvonwmmnej'];

export class HarnessRefusal extends Error {}

/** Throws before any network use unless URL/key point at the allowed project with a publishable key. */
export function assertTarget(url, key) {
  if (!url || !key) throw new HarnessRefusal('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing (.env.local)');
  if (FORBIDDEN_REFS.some(ref => url.includes(ref))) throw new HarnessRefusal('forbidden Supabase project ref in target URL');
  if (url !== ALLOWED_URL) throw new HarnessRefusal(`target URL is not ${ALLOWED_URL}`);
  if (!key.startsWith('sb_publishable_')) throw new HarnessRefusal('only a publishable key may be used by the harness');
  return { url, key };
}

let cached;
export function loadEnv() {
  if (cached) return cached;
  config({ path: path.join(ROOT, '.env.local'), quiet: true });
  cached = assertTarget(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return cached;
}
