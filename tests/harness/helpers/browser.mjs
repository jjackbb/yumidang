// Real browser helpers: separate contexts per member, the dev server, and UI login with the test code.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT } from './env.mjs';
import { TEST_CODE } from './sessions.mjs';

const require = createRequire(import.meta.url);
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const EXECUTABLE = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';

export async function launchBrowser() {
  const { chromium } = require(PLAYWRIGHT);
  return chromium.launch({ headless: process.env.HARNESS_HEADED !== '1', executablePath: EXECUTABLE });
}

/** Uses HARNESS_APP_URL when given, otherwise starts Vite on a free fixed port for this run. */
export async function ensureAppServer() {
  if (process.env.HARNESS_APP_URL) return { url: process.env.HARNESS_APP_URL, stop: () => {} };
  const port = Number(process.env.HARNESS_APP_PORT || 4320);
  const child = spawn('npx', ['vite', '--config', 'frontend/vite.config.ts', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', detached: false });
  const url = `http://127.0.0.1:${port}/`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) return { url, stop: () => child.kill() }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error('vite dev server did not start');
}

export async function newMemberPage(browser, appUrl, label) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(String(error.message || error).slice(0, 200)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200)); });
  await page.goto(appUrl);
  return { label, context, page, consoleErrors };
}

export async function uiLogin(member, phone) {
  const { page } = member;
  await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '로그인', exact: true });
  await dialog.locator('#auth-phone').fill(phone);
  await dialog.getByRole('button', { name: '인증번호 요청', exact: true }).click();
  await dialog.locator('#auth-otp').fill(TEST_CODE);
  await dialog.getByRole('button', { name: 'Supabase에서 인증 확인', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor({ state: 'detached' });
}

/** Runs a Supabase call inside the page with that member's own browser session (never returns tokens). */
export function inPage(member, fn, arg) {
  return member.page.evaluate(async ({ source, arg }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase.ts');
    const run = new Function('supabase', 'arg', `return (${source})(supabase, arg);`);
    return run(getSupabaseClient(), arg);
  }, { source: fn.toString(), arg });
}

export const pageUserId = member => inPage(member, async supabase => (await supabase.auth.getUser()).data.user?.id || null);

export function seoulInputValue(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
