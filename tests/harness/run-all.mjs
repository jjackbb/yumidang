// One command: preflight → features 1–9 (remote API, publishable key + member sessions) → A/B/C browser full cycle.
// Stops at the first failing stage and leaves the resume command in docs/backend-implementation/STATE.md.
import { createContext, runFeature } from './helpers/runner.mjs';
import { preflight } from './preflight.mjs';
import { feature01 } from './feature-01-auth.mjs';
import { feature02 } from './feature-02-login.mjs';
import { feature03 } from './feature-03-posts.mjs';
import { feature04 } from './feature-04-profile.mjs';
import { feature05 } from './feature-05-requests.mjs';
import { feature06 } from './feature-06-chat.mjs';
import { feature07 } from './feature-07-match.mjs';
import { feature08 } from './feature-08-completion.mjs';
import { feature09 } from './feature-09-reviews.mjs';
import { fullCycle } from './full-cycle.mjs';

const stages = [
  ['preflight', preflight], ['feature-01-auth', feature01], ['feature-02-login', feature02], ['feature-03-posts', feature03],
  ['feature-04-profile', feature04], ['feature-05-requests', feature05], ['feature-06-chat', feature06], ['feature-07-match', feature07],
  ['feature-08-completion', feature08], ['feature-09-reviews', feature09], ['full-cycle', fullCycle],
];
const only = process.env.HARNESS_SKIP_BROWSER === '1' ? stages.filter(([key]) => key !== 'full-cycle') : stages;

const ctx = createContext();
console.log(`harness run ${ctx.run.runId}`);
let failed = null;
for (const [key, body] of only) {
  const ok = await runFeature(ctx, key, feature => body(ctx, feature));
  if (!ok) { failed = key; break; }
}
if (process.env.HARNESS_SKIP_BROWSER === '1' && !failed) {
  const feature = ctx.run.feature('full-cycle');
  feature.notRun('A/B/C two-browser cycle', 'BROWSER', 'HARNESS_SKIP_BROWSER=1');
  feature.finish('not_run');
}
await ctx.signOutAll();
console.log(failed ? `\nHARNESS FAIL at ${failed} — see docs/backend-implementation/STATE.md` : `\nHARNESS PASS (${ctx.run.runId})`);
process.exit(failed ? 1 : 0);
