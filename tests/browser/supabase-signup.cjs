// Live release check for user flow 1. Uses only the project configured in .env.local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

dotenv.config({ path: path.resolve('.env.local') });

const appUrl = process.env.CHECK_URL || 'http://127.0.0.1:4187/';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const livePhoneA = process.env.LIVE_SIGNUP_PHONE_A;
const livePhoneB = process.env.LIVE_SIGNUP_PHONE_B;
const unregisteredPhone = process.env.LIVE_UNREGISTERED_PHONE;
const testOtp = process.env.TEST_PHONE_OTP;
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const expectedProjectUrl = 'https://bndguguarijmghnkenvt.supabase.co';

assert.equal(supabaseUrl, expectedProjectUrl, 'unexpected Supabase project');
assert.match(publishableKey || '', /^sb_publishable_/, 'missing publishable key');
assert.match(livePhoneA || '', /^010000000(?:0[1-9]|1\d|20)$/, 'set LIVE_SIGNUP_PHONE_A to an unused configured test number');
assert.match(livePhoneB || '', /^010000000(?:0[1-9]|1\d|20)$/, 'set LIVE_SIGNUP_PHONE_B to a different unused configured test number');
assert.match(unregisteredPhone || '', /^010000000(?:0[1-9]|1\d|20)$/, 'set LIVE_UNREGISTERED_PHONE to an unused configured test number');
assert.match(testOtp || '', /^\d{6}$/, 'set TEST_PHONE_OTP to the configured six-digit code');
assert.notEqual(livePhoneA, livePhoneB, 'live test numbers must differ');
assert.notEqual(unregisteredPhone, livePhoneA, 'unregistered login number must differ from signup numbers');
assert.notEqual(unregisteredPhone, livePhoneB, 'unregistered login number must differ from signup numbers');

function apiHeaders(accessToken) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function sessionFrom(page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed?.access_token && parsed?.user?.id) return parsed;
    }
    return null;
  });
}

async function openSignup(page, { exerciseUnknownLogin = false } = {}) {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
  const loginDialog = page.getByRole('dialog', { name: '로그인', exact: true });
  await loginDialog.locator('#auth-phone').waitFor();
  assert.equal(await loginDialog.getByRole('button', { name: '회원가입', exact: true }).isVisible(), true);
  if (exerciseUnknownLogin) {
    await loginDialog.locator('#auth-phone').fill(unregisteredPhone);
    await loginDialog.getByRole('button', { name: '인증번호 요청', exact: true }).click();
    await loginDialog.getByRole('alert').waitFor();
    assert.match(await loginDialog.getByRole('alert').innerText(), /가입된 휴대폰 번호가 아니에요/);
  }
  await loginDialog.getByRole('button', { name: '회원가입', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '회원가입', exact: true });
  await dialog.getByText('전체 약관에 동의합니다', { exact: true }).click();
  await dialog.getByRole('button', { name: '동의하고 다음으로', exact: true }).click();
  return dialog;
}

async function loginExisting(page, phone) {
  await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '로그인', exact: true });
  await dialog.locator('#auth-phone').fill(phone);
  await dialog.getByRole('button', { name: '인증번호 요청', exact: true }).click();
  await dialog.getByRole('status').waitFor();
  await dialog.locator('#auth-otp').fill(testOtp);
  await dialog.getByRole('button', { name: '인증하고 로그인', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
}

async function requestAndVerify(page, phone, { exerciseErrors = false } = {}) {
  const dialog = page.getByRole('dialog', { name: '회원가입', exact: true });
  await dialog.locator('#auth-phone').fill(phone);
  await dialog.getByRole('button', { name: '인증번호 요청', exact: true }).click();
  await dialog.getByRole('status').waitFor();
  assert.match(await dialog.getByRole('status').innerText(), /Supabase가 인증번호 요청/);

  let rerequest = 'NOT_RUN';
  if (exerciseErrors) {
    await dialog.locator('#auth-otp').fill('000000');
    await dialog.getByRole('button', { name: '인증하고 가입 계속하기', exact: true }).click();
    const alert = dialog.getByRole('alert');
    await alert.waitFor();
    const invalidMessage = await alert.innerText();
    assert.match(invalidMessage, /인증번호가 (맞지 않아요|만료됐어요)/);

    await dialog.getByRole('button', { name: '재요청', exact: true }).click();
    const success = dialog.getByRole('status');
    const limited = dialog.getByRole('alert');
    await Promise.race([success.waitFor(), limited.waitFor()]);
    if (await limited.isVisible().catch(() => false)) {
      assert.match(await limited.innerText(), /요청이 너무 많아요/);
      rerequest = 'RATE_LIMIT_GUIDANCE_PASS';
    } else {
      assert.match(await success.innerText(), /Supabase가 인증번호 요청/);
      rerequest = 'REQUEST_ACCEPTED_PASS';
    }
  }

  await dialog.locator('#auth-otp').fill(testOtp);
  await dialog.getByRole('button', { name: '인증하고 가입 계속하기', exact: true }).click();
  await dialog.locator('#auth-real-name').waitFor();
  return rerequest;
}

async function saveProfile(page, realName, birthDate) {
  const dialog = page.getByRole('dialog', { name: '회원가입', exact: true });
  await dialog.locator('#auth-real-name').fill(realName);
  await dialog.locator('#auth-birth').fill(birthDate);
  assert.equal(await dialog.getByText(`화면 표시: ${birthDate === '2001-09-16' ? '25살' : '30살'}`, { exact: true }).isVisible(), true);
  await dialog.getByRole('button', { name: '기본 프로필 저장하고 가입 완료', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
}

(async () => {
  const evidence = {
    projectUrl: supabaseUrl,
    checks: [],
    notRun: ['유효했던 OTP가 시간 경과로 만료되는 경계 시각 대기 확인'],
  };
  const browser = await chromium.launch({ executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const contextA = await browser.newContext({ timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const pageA = await contextA.newPage();
  pageA.setDefaultTimeout(15_000);
  const pageErrors = [];
  pageA.on('pageerror', error => pageErrors.push(error.message));

  try {
    await openSignup(pageA, { exerciseUnknownLogin: true });
    evidence.checks.push('기본 로그인 화면과 하단 회원가입 진입, 미가입 번호 로그인 차단');
    evidence.rerequest = await requestAndVerify(pageA, livePhoneA, { exerciseErrors: true });
    evidence.checks.push('실제 OTP 요청, 잘못된 OTP에 대한 만료/오류 안내, 환경변수로 주입한 테스트 OTP 확인');

    let failInsertOnce = true;
    await pageA.route('**/rest/v1/profiles*', async route => {
      if (failInsertOnce && route.request().method() === 'POST') {
        failInsertOnce = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'forced profile insert failure' }) });
        return;
      }
      await route.continue();
    });
    const dialogA = pageA.getByRole('dialog', { name: '회원가입', exact: true });
    await dialogA.locator('#auth-real-name').fill('실제가입A');
    await dialogA.locator('#auth-birth').fill('2001-09-16');
    await dialogA.getByRole('button', { name: '기본 프로필 저장하고 가입 완료', exact: true }).click();
    await dialogA.getByRole('alert').waitFor();
    assert.match(await dialogA.getByRole('alert').innerText(), /기본 프로필을 저장하지 못했어요/);
    assert.equal(await dialogA.locator('#auth-real-name').inputValue(), '실제가입A');
    assert.equal(await dialogA.locator('#auth-birth').inputValue(), '2001-09-16');
    evidence.checks.push('프로필 저장 실패 시 입력과 인증 세션 유지');

    await pageA.unroute('**/rest/v1/profiles*');
    await pageA.reload({ waitUntil: 'networkidle' });
    const resumed = pageA.getByRole('dialog', { name: '회원가입', exact: true });
    await resumed.locator('#auth-real-name').waitFor();
    assert.equal(await resumed.getByText(/휴대폰 확인은 완료됐어요/).isVisible(), true);
    evidence.checks.push('새로고침 후 미완성 프로필 단계 자동 복구');

    const incompleteSession = await sessionFrom(pageA);
    assert.ok(incompleteSession, 'incomplete user session missing');
    const forgedInsert = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...apiHeaders(incompleteSession.access_token), Prefer: 'return=representation' },
      body: JSON.stringify({
        id: incompleteSession.user.id,
        real_name: '시각위조',
        birth_date: '2001-09-16',
        avatar_url: null,
        bio: null,
        created_at: '2000-01-01T00:00:00Z',
      }),
    });
    assert.ok(forgedInsert.status >= 400, `created_at insert was not rejected: ${forgedInsert.status}`);
    evidence.checks.push('클라이언트의 created_at 위조 INSERT 거부');

    await saveProfile(pageA, '실제가입A', '2001-09-16');
    await pageA.locator('header').getByText('실제가입A · 25살', { exact: true }).waitFor();
    await pageA.reload({ waitUntil: 'networkidle' });
    await pageA.locator('header').getByText('실제가입A · 25살', { exact: true }).waitFor();
    evidence.checks.push('프로필 저장, 만 나이 25살 표시, 새로고침 세션 복구');

    const sessionA = await sessionFrom(pageA);
    assert.ok(sessionA, 'user A session missing');

    const contextB = await browser.newContext({ timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
    const pageB = await contextB.newPage();
    pageB.setDefaultTimeout(15_000);
    try {
      await openSignup(pageB);
      await requestAndVerify(pageB, livePhoneB);
      await saveProfile(pageB, '실제가입B', '1996-09-16');
      await pageB.locator('header').getByText('실제가입B · 30살', { exact: true }).waitFor();
      const sessionB = await sessionFrom(pageB);
      assert.ok(sessionB, 'user B session missing');
      evidence.checks.push('두 번째 실제 사용자 가입');

      const select = 'id,real_name,birth_date,created_at,updated_at';
      const ownResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionA.user.id}&select=${select}`, { headers: apiHeaders(sessionA.access_token) });
      assert.equal(ownResponse.status, 200);
      const ownRows = await ownResponse.json();
      assert.equal(ownRows.length, 1);

      const otherResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionB.user.id}&select=${select}`, { headers: apiHeaders(sessionA.access_token) });
      assert.equal(otherResponse.status, 200);
      assert.deepEqual(await otherResponse.json(), []);

      const blockedUpdate = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionB.user.id}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(sessionA.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({ real_name: '침범시도' }),
      });
      assert.equal(blockedUpdate.status, 200);
      assert.deepEqual(await blockedUpdate.json(), []);

      const verifyB = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionB.user.id}&select=real_name`, { headers: apiHeaders(sessionB.access_token) });
      assert.equal((await verifyB.json())[0].real_name, '실제가입B');

      const anonResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, { headers: { apikey: publishableKey } });
      const anonBody = await anonResponse.text();
      assert.ok(anonResponse.status >= 400 || anonBody === '[]', `anonymous read exposed rows: ${anonResponse.status} ${anonBody}`);
      evidence.checks.push('RLS A/B: 본인 조회, 타인 조회 0행, 타인 수정 0행, anon 비공개');

      await new Promise(resolve => setTimeout(resolve, 1100));
      const ownUpdate = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionA.user.id}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(sessionA.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({ real_name: '실제가입A수정' }),
      });
      assert.equal(ownUpdate.status, 200);
      const updatedRows = await ownUpdate.json();
      assert.equal(updatedRows.length, 1);
      assert.ok(Date.parse(updatedRows[0].updated_at) > Date.parse(ownRows[0].updated_at), 'updated_at trigger did not advance');

      const forgedTimestampUpdate = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sessionA.user.id}`, {
        method: 'PATCH',
        headers: { ...apiHeaders(sessionA.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({ created_at: '2000-01-01T00:00:00Z', updated_at: '2000-01-01T00:00:00Z' }),
      });
      assert.ok(forgedTimestampUpdate.status >= 400, `timestamp update was not rejected: ${forgedTimestampUpdate.status}`);
      await pageA.reload({ waitUntil: 'networkidle' });
      await pageA.locator('header').getByText('실제가입A수정 · 25살', { exact: true }).waitFor();
      evidence.checks.push('본인 입력 열 수정 허용, DB updated_at 트리거, 시스템 시각 위조 UPDATE 거부, 화면 재조회');

      await pageA.goto(new URL('/me', appUrl).toString(), { waitUntil: 'networkidle' });
      await pageA.getByTitle('로그아웃').click();
      await pageA.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor();
      await loginExisting(pageA, livePhoneA);
      await pageA.locator('header').getByText('실제가입A수정 · 25살', { exact: true }).waitFor();
      evidence.checks.push('실제 로그아웃 후 기존 회원 OTP 로그인과 프로필 복구');
    } finally {
      await contextB.close();
    }

    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ status: 'PASS', ...evidence }, null, 2));
  } finally {
    await contextA.close();
    await browser.close();
  }
})().catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', message: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
});
