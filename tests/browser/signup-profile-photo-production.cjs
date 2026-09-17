const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

dotenv.config({ path: path.resolve('.env.local') });

const appUrl = process.env.CHECK_URL || 'https://yumidang.vercel.app/';
const phone = process.env.LIVE_PROFILE_PHONE;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const executablePath = process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const expectedProjectUrl = 'https://bndguguarijmghnkenvt.supabase.co';

assert.equal(new URL(appUrl).origin, 'https://yumidang.vercel.app', 'production smoke must target yumidang');
assert.equal(supabaseUrl, expectedProjectUrl, 'unexpected Supabase project');
assert.match(publishableKey || '', /^sb_publishable_/, 'missing publishable key');
assert.match(phone || '', /^0199\d{7}$/, 'LIVE_PROFILE_PHONE must be a disposable 0199 test number');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARAwMjDAGCAYAKkQCBf3W5ikAAAAASUVORK5CYII=', 'base64');
const sessionFrom = page => page.evaluate(() => {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    const value = JSON.parse(localStorage.getItem(key));
    if (value?.access_token && value?.refresh_token && value?.user?.id) return value;
  }
  return null;
});

async function sdkFor(session) {
  const sdk = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sdk.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  assert.equal(error, null, 'test session must load in the verification client');
  return sdk;
}

async function waitForObject(sdk, objectPath, expected) {
  const separator = objectPath.indexOf('/');
  const folder = objectPath.slice(0, separator);
  const file = objectPath.slice(separator + 1);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const listed = await sdk.storage.from('profile-images').list(folder, { search: file, limit: 10 });
    assert.equal(listed.error, null, 'authenticated object listing must succeed');
    const exists = listed.data.some(item => item.name === file);
    if (exists === expected) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.fail(`profile object did not become ${expected ? 'present' : 'absent'}`);
}

(async () => {
  const precheck = await fetch(`${supabaseUrl}/functions/v1/test-phone-auth`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', phone, code: '123456', mode: 'login' }),
  });
  assert.equal(precheck.status, 404, 'disposable phone must be unused before the signup smoke');

  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  let uploadCalls = 0;
  let signupRpcCalls = 0;
  let forcedUploadFailure = false;
  let forcedRpcFailure = false;

  await context.route(`${supabaseUrl}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.startsWith('/storage/v1/object/profile-images/')) {
      uploadCalls += 1;
      if (!forcedUploadFailure) {
        forcedUploadFailure = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'controlled upload failure' }) });
        return;
      }
    }
    if (request.method() === 'POST' && url.pathname === '/rest/v1/rpc/complete_signup_with_avatar') {
      signupRpcCalls += 1;
      if (!forcedRpcFailure) {
        forcedRpcFailure = true;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'CONTROLLED_RPC_FAILURE', message: 'controlled RPC failure' }) });
        return;
      }
    }
    await route.continue();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: '로그인', exact: true });
    await dialog.getByRole('button', { name: '회원가입', exact: true }).click();
    dialog = page.getByRole('dialog', { name: '회원가입', exact: true });
    await dialog.getByText('전체 약관에 동의합니다', { exact: true }).click();
    await dialog.getByRole('button', { name: '동의하고 다음으로', exact: true }).click();
    await dialog.locator('#auth-phone').fill(phone);
    await dialog.getByRole('button', { name: '인증번호 요청', exact: true }).click();
    await dialog.getByRole('button', { name: '테스트 OTP 입력', exact: true }).click();
    await dialog.getByRole('button', { name: 'Supabase에서 인증 확인', exact: true }).click();
    await dialog.locator('#auth-real-name').waitFor();

    const submit = dialog.getByRole('button', { name: '사진과 기본 프로필 저장하고 가입 완료', exact: true });
    assert.equal(await submit.isDisabled(), true, 'signup must be disabled without a photo');

    await dialog.locator('#auth-profile-photo').setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    assert.match(await dialog.getByRole('alert').innerText(), /JPG, JPEG, PNG/);
    await dialog.locator('#auth-profile-photo').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken image') });
    await dialog.getByRole('alert').filter({ hasText: '사진을 읽지 못했어요' }).waitFor();

    await dialog.locator('#auth-profile-photo').setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: png });
    const preview = dialog.getByAltText('선택한 프로필 사진 미리보기');
    await preview.waitFor();
    const firstPreview = await preview.getAttribute('src');
    await dialog.locator('#auth-profile-photo').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(previous => {
      const image = document.querySelector('img[alt="선택한 프로필 사진 미리보기"]');
      return image?.getAttribute('src') && image.getAttribute('src') !== previous;
    }, firstPreview);

    await dialog.locator('#auth-real-name').fill('배포검증');
    await dialog.getByRole('button', { name: '여성', exact: true }).click();
    await dialog.locator('#auth-birth').fill('2000-09-17');

    await submit.click();
    await dialog.getByRole('alert').filter({ hasText: '사진 업로드에 실패했어요' }).waitFor();
    assert.equal(uploadCalls, 1);
    assert.equal(signupRpcCalls, 0, 'signup RPC must not run after upload failure');

    await submit.click();
    await dialog.getByRole('alert').filter({ hasText: '사진 경로를 프로필에 저장하지 못했어요' }).waitFor();
    assert.equal(uploadCalls, 2);
    assert.equal(signupRpcCalls, 1);

    const incompleteSession = await sessionFrom(page);
    assert.ok(incompleteSession, 'authenticated incomplete session must remain after RPC failure');
    const sdk = await sdkFor(incompleteSession);
    const beforeRetry = await sdk.from('profiles').select('id').eq('id', incompleteSession.user.id).maybeSingle();
    assert.equal(beforeRetry.error, null);
    assert.equal(beforeRetry.data, null, 'failed completion must not create a profile');

    await submit.click();
    const completeMessage = dialog.getByText('회원가입이 완료됐어요.', { exact: true });
    await Promise.race([
      completeMessage.waitFor(),
      dialog.waitFor({ state: 'detached' }),
    ]);
    assert.equal(uploadCalls, 2, 'RPC retry must reuse the successful uploaded path');
    assert.equal(signupRpcCalls, 2);

    const profile = await sdk.from('profiles').select('id,avatar_url').eq('id', incompleteSession.user.id).single();
    assert.equal(profile.error, null);
    assert.match(profile.data.avatar_url, new RegExp(`^${incompleteSession.user.id}/[0-9a-f-]{36}\\.jpg$`));
    const firstPath = profile.data.avatar_url;

    if (await completeMessage.isVisible().catch(() => false))
      await dialog.getByRole('button', { name: '유미당 시작하기', exact: true }).click();
    await page.locator('#nav-tab-me').click();
    const myAvatar = page.locator('[data-my-avatar]');
    await page.waitForFunction(() => document.querySelector('[data-my-avatar]')?.getAttribute('src')?.includes('/storage/v1/object/sign/profile-images/'));
    assert.notEqual(await myAvatar.getAttribute('src'), firstPath, 'raw private path must never be rendered');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-tab-me').click();
    await page.waitForFunction(() => document.querySelector('[data-my-avatar]')?.getAttribute('src')?.includes('/storage/v1/object/sign/profile-images/'));

    await page.getByRole('button', { name: '프로필 사진 변경', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '프로필 편집', exact: true });
    await editor.getByLabel('프로필 사진 파일 선택').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
    await editor.getByAltText('선택한 사진 미리보기').waitFor();
    await editor.getByRole('button', { name: '이 사진으로 저장', exact: true }).click();
    await editor.getByRole('status').filter({ hasText: '사진을 저장했어요' }).waitFor();

    const changed = await sdk.from('profiles').select('avatar_url').eq('id', incompleteSession.user.id).single();
    assert.equal(changed.error, null);
    assert.match(changed.data.avatar_url, new RegExp(`^${incompleteSession.user.id}/[0-9a-f-]{36}\\.jpg$`));
    assert.notEqual(changed.data.avatar_url, firstPath, 'replacement must use a new object path');
    await waitForObject(sdk, firstPath, false);
    await waitForObject(sdk, changed.data.avatar_url, true);
    assert.ok((await createClient(supabaseUrl, publishableKey).storage.from('profile-images').download(changed.data.avatar_url)).error, 'anonymous read must be denied');

    await editor.getByRole('button', { name: '사진 삭제', exact: true }).click();
    const confirm = editor.getByRole('alertdialog', { name: '사진 삭제 확인', exact: true });
    await confirm.getByRole('button', { name: '삭제하기', exact: true }).click();
    await editor.getByRole('status').filter({ hasText: '사진을 삭제했어요' }).waitFor();
    const cleared = await sdk.from('profiles').select('avatar_url').eq('id', incompleteSession.user.id).single();
    assert.equal(cleared.error, null);
    assert.equal(cleared.data.avatar_url, null);
    await waitForObject(sdk, changed.data.avatar_url, false);
    assert.equal(await page.locator('header').getByRole('button', { name: '로그인', exact: true }).count(), 0, 'photo deletion must keep the login session');

    await editor.getByRole('button', { name: '닫기', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('header').getByRole('button', { name: '로그인', exact: true }).count(), 0, 'reload after deletion must keep the session');
    await page.locator('#nav-tab-me').click();
    await page.getByTitle('로그아웃').click();
    await page.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor();

    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({
      result: 'PASS',
      target: 'yumidang-production',
      uploadAttempts: uploadCalls,
      signupRpcAttempts: signupRpcCalls,
      rpcRetryReusedPath: true,
      stablePathStored: true,
      signedDisplayAfterReload: true,
      replacementCleanedOldObject: true,
      deletionKeptSession: true,
      finalAvatarCleared: true,
    }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
