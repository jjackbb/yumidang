import { fileURLToPath } from 'node:url';
import { createRun, FEATURES } from './report.mjs';
import { persona, PERSONAS } from './sessions.mjs';

export function createContext(run = createRun()) {
  const members = {};
  const ctx = {
    run,
    shared: {},
    /** Memoized persona session (A/B/C). Protected values are registered with the evidence guard. */
    async member(name) {
      if (!members[name]) {
        run.guard.protect(PERSONAS[name].realName, PERSONAS[name].birthDate, PERSONAS[name].phone);
        members[name] = await persona(name);
      }
      return members[name];
    },
    async signOutAll() {
      for (const member of Object.values(members)) await member.sdk.auth.signOut({ scope: 'local' }).catch(() => {});
    },
  };
  return ctx;
}

export async function runFeature(ctx, key, body) {
  const feature = ctx.run.feature(key);
  const rerun = FEATURES.find(([name]) => name === key)?.[2];
  console.log(`\n▶ ${key} (run ${ctx.run.runId})`);
  try {
    await body(feature);
    feature.finish('pass');
    return true;
  } catch (error) {
    feature.finish('fail', `${String(error.message).slice(0, 300)} — 재실행: ${rerun}`);
    return false;
  }
}

/** Lets each feature file run alone: `node tests/harness/feature-03-posts.mjs`. */
export async function standalone(metaUrl, key, body) {
  if (process.argv[1] !== fileURLToPath(metaUrl)) return;
  const ctx = createContext();
  const ok = await runFeature(ctx, key, feature => body(ctx, feature));
  await ctx.signOutAll();
  console.log(ok ? `\n${key}: PASS` : `\n${key}: FAIL`);
  // Realtime sockets keep the event loop alive; exit explicitly.
  process.exit(ok ? 0 : 1);
}
