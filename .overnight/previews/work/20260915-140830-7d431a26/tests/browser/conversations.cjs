const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'),
  assert = require('assert/strict');
const out =
  process.env.EVIDENCE_DIR ||
  require('path').resolve(__dirname, '../../docs/prototype-roadmap/evidence');
fs.mkdirSync(out, { recursive: true });
const url = process.env.CHECK_URL || 'http://127.0.0.1:4176';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  const result = {
    url,
    mode: 'Frontend simulation; Supabase intercepted; no real messages or transactions',
    cases: [],
    errors: [],
  };
  async function check(name, fn, width = 390) {
    if (process.env.CASE && !name.includes(process.env.CASE)) return;
    const c = await browser.newContext({
      viewport: { width, height: 844 },
      timezoneId: 'Asia/Seoul',
    });
    await c.route('**/*.supabase.co/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    const p = await c.newPage();
    p.setDefaultTimeout(7000);
    p.on('pageerror', (e) => result.errors.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: new Date('2026-09-15T12:00:00+09:00') });
    await p.goto(url, { waitUntil: 'networkidle' });
    try {
      await fn(p);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      result.cases.push({ name, status: 'PASS' });
    } catch (e) {
      result.cases.push({ name, status: 'FAIL', error: e.message });
      await p.screenshot({
        path: out + '/failure-' + name.split(' ')[0] + '.png',
      });
    } finally {
      await c.close();
      console.log(result.cases.at(-1));
      fs.writeFileSync(
        out +
          '/' +
          (process.env.CASE
            ? 'case-' + process.env.CASE
            : process.env.CHECK_URL
              ? 'production'
              : 'browser') +
          '.json',
        JSON.stringify(result, null, 2),
      );
    }
  }
  async function authenticate(p) {
    await p.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await p
      .getByRole('button', { name: '테스트코드 입력', exact: true })
      .click();
    await p
      .getByRole('button', { name: '인증 확인 및 로그인', exact: true })
      .click();
  }
  async function login(p) {
    await p
      .locator('header')
      .getByRole('button', { name: '로그인', exact: true })
      .click();
    await authenticate(p);
  }
  const room = (p) =>
    p.getByRole('region', { name: '동행 대화방', exact: true });
  const nav = (p, id) => p.locator('#nav-tab-' + id).click();
  async function open(p, id) {
    await nav(p, 'chat');
    if (
      await p
        .getByRole('button', { name: '채팅 목록으로', exact: true })
        .count()
    )
      await p
        .getByRole('button', { name: '채팅 목록으로', exact: true })
        .click();
    await p.locator(`[data-room-id="${id}"]`).click();
    assert.equal(await room(p).getAttribute('data-active-room'), id);
  }
  async function send(p, t) {
    await p.getByRole('textbox', { name: '메시지', exact: true }).fill(t);
    await p.getByRole('button', { name: '메시지 보내기' }).click();
  }
  await check(
    'anonymous notification requires login then opens the correct request',
    async (p) => {
      await nav(p, 'chat');
      assert.equal(await p.locator('[data-room-id]').count(), 0);
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await p.locator('#btn-notifications').click();
      await p
        .locator('[data-notification-id="notif-req-init-2"]')
        .getByRole('button')
        .click();
      await authenticate(p);
      assert.equal(
        await room(p).getAttribute('data-active-room'),
        'room-req-init-2',
      );
      assert.match(await room(p).innerText(), /확정 전/);
      assert.equal(
        await p.getByRole('button', { name: '동행 수락하기' }).count(),
        1,
      );
    },
  );
  await check(
    'host profile messages drafts isolated then accept once in the same room',
    async (p) => {
      await login(p);
      await nav(p, 'me');
      await p.getByRole('tab', { name: /받은 신청/ }).click();
      const req = p.locator('[data-request-id="req-init-1"]');
      await req.getByRole('button', { name: /상세 프로필 보기/ }).click();
      assert.match(await p.getByRole('dialog').last().innerText(), /김\*수/);
      await p.getByRole('button', { name: '이전 화면으로 돌아가기' }).click();
      await req.getByRole('button', { name: '대화하기', exact: true }).click();
      await send(p, '검증 메시지: 디저트 코스 확인했어요');
      await p
        .getByRole('textbox', { name: '메시지', exact: true })
        .fill('보내기 전 초안');
      await nav(p, 'home');
      await nav(p, 'chat');
      assert.equal(
        await p
          .getByRole('textbox', { name: '메시지', exact: true })
          .inputValue(),
        '보내기 전 초안',
      );
      assert.match(await room(p).innerText(), /검증 메시지/);
      await open(p, 'room-req-init-2');
      assert.doesNotMatch(await room(p).innerText(), /검증 메시지/);
      assert.equal(
        await p
          .getByRole('textbox', { name: '메시지', exact: true })
          .inputValue(),
        '',
      );
      await open(p, 'room-req-init-1');
      assert.equal(
        await p
          .getByRole('textbox', { name: '메시지', exact: true })
          .inputValue(),
        '보내기 전 초안',
      );
      await p.screenshot({ path: out + '/before-confirm.png' });
      await p.getByRole('button', { name: '동행 수락하기' }).click();
      assert.equal(
        await room(p).getAttribute('data-active-room'),
        'room-req-init-1',
      );
      assert.match(await room(p).innerText(), /매칭 확정/);
      assert.match(await room(p).innerText(), /검증 메시지/);
      assert.equal(
        await p.getByRole('button', { name: '동행 수락하기' }).count(),
        0,
      );
      await p.screenshot({ path: out + '/after-confirm.png' });
      await p.getByRole('button', { name: '약속 상세 →', exact: true }).click();
      await p
        .getByRole('button', { name: '동행 대화방 바로가기', exact: true })
        .click();
      assert.equal(
        await room(p).getAttribute('data-active-room'),
        'room-req-init-1',
      );
      await open(p, 'room-req-init-2');
      assert.match(await room(p).innerText(), /다른 동행자와 확정/);
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await p.screenshot({ path: out + '/ended-request.png' });
      await nav(p, 'me');
      await p.getByRole('tab', { name: /받은 신청/ }).click();
      assert.match(
        await p.locator('[data-request-id="req-init-1"]').innerText(),
        /매칭 확정/,
      );
      assert.match(
        await p.locator('[data-request-id="req-init-2"]').innerText(),
        /다른 동행자와 확정/,
      );
    },
  );
  await check(
    'requester apply cancel reapply and explicit host simulation retain the correct room',
    async (p) => {
      await login(p);
      await p.locator('#cat-flash').click();
      await p
        .getByText('지금 서울숲에서 커피 한 잔 하실 분?', { exact: true })
        .click();
      await p
        .getByRole('dialog', { name: '동행 공고 상세', exact: true })
        .getByRole('button', { name: /참여 신청/ })
        .click();
      await p
        .getByRole('dialog', { name: '동행 참여 신청', exact: true })
        .locator('textarea')
        .fill('서울숲에서 커피 마시고 싶어요.');
      await p.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
      const first = await room(p).getAttribute('data-active-room');
      assert.match(await room(p).innerText(), /서울숲에서 커피 마시고/);
      assert.equal(
        await p
          .getByRole('button', { name: '동행 수락하기', exact: true })
          .count(),
        0,
      );
      await p.getByRole('button', { name: '신청 취소', exact: true }).click();
      await p.getByRole('radio', { name: '개인 사정이 생겼어요' }).check();
      await p
        .getByRole('button', { name: '신청 취소하기', exact: true })
        .click();
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await room(p)
        .getByRole('button', {
          name: '지금 서울숲에서 커피 한 잔 하실 분?',
          exact: true,
        })
        .click();
      await p
        .getByRole('dialog', { name: '동행 공고 상세', exact: true })
        .getByRole('button', { name: /참여 신청/ })
        .click();
      await p.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
      assert.notEqual(await room(p).getAttribute('data-active-room'), first);
      await send(p, '새 신청의 메시지');
      const second = await room(p).getAttribute('data-active-room');
      await p.getByText('프로토타입 시연 도구', { exact: true }).click();
      await p
        .getByRole('button', { name: '작성자 수락 시연', exact: true })
        .click();
      assert.equal(await room(p).getAttribute('data-active-room'), second);
      assert.match(await room(p).innerText(), /매칭 확정/);
      assert.match(await room(p).innerText(), /새 신청의 메시지/);
    },
  );
  await check(
    'schedule requires explicit response survives tabs and updates only its appointment',
    async (p) => {
      await login(p);
      await open(p, 'room-appt-gangnam-brunch');
      await p.getByTitle('일정/장소 제안하기', { exact: true }).click();
      await p
        .getByLabel('새 종료 날짜·시각', { exact: true })
        .fill('2026-09-17T16:00');
      await p
        .getByLabel('새 만남 장소', { exact: true })
        .fill('변경된 브런치 카페');
      await p.getByRole('button', { name: '제안 전송하기' }).click();
      await p.clock.fastForward(5000);
      assert.match(
        await room(p).locator('[data-chat-status]').innerText(),
        /확정/,
      );
      assert.match(
        await room(p).innerText(),
        /상대 동의 전까지 기존 일정 유지/,
      );
      await nav(p, 'home');
      await nav(p, 'chat');
      assert.equal(
        await p
          .getByRole('button', { name: '상대 수락 시연', exact: true })
          .count(),
        1,
      );
      await p
        .getByRole('button', { name: '상대 수락 시연', exact: true })
        .click();
      assert.match(await room(p).innerText(), /변경 수락됨/);
      assert.equal(
        await p
          .getByRole('button', { name: '상대 수락 시연', exact: true })
          .count(),
        0,
      );
      await nav(p, 'me');
      await p.getByRole('button', { name: /강\*훈 님과의 공원 산책/ }).click();
      await p.getByRole('button', { name: '참여 대시보드 닫기' }).click();
      await nav(p, 'chat');
      assert.equal(
        await room(p).getAttribute('data-active-room'),
        'room-appt-gangnam-brunch',
      );
      await p.clock.fastForward(
        Date.parse('2026-09-17T16:00:00+09:00') -
          (await p.evaluate(() => Date.now())),
      );
      assert.equal(
        await p
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        false,
      );
      await p
        .getByRole('button', { name: '동행 완료 처리', exact: true })
        .click();
      assert.equal(
        await p
          .getByRole('button', { name: '평가 남기기', exact: true })
          .isDisabled(),
        false,
      );
      await open(p, 'room-appt-walk');
      assert.equal(
        await p
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        true,
      );
      await p.clock.fastForward(
        Date.parse('2026-09-22T14:59:00+09:00') -
          (await p.evaluate(() => Date.now())),
      );
      assert.equal(
        await p
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        true,
      );
      await p.clock.fastForward(60000);
      assert.equal(
        await p
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        false,
      );
    },
  );
  await check(
    'future voice and paid preview show preparation without success or auto matching',
    async (p) => {
      await login(p);
      await open(p, 'room-req-sent-demo');
      assert.equal(
        await p.getByRole('button', { name: '안심 통화 안내' }).count(),
        0,
      );
      await open(p, 'room-appt-art');
      await p.getByRole('button', { name: '안심 통화 안내' }).click();
      const d = p.getByRole('dialog', { name: '안심 통화 준비 안내' });
      assert.match(await d.innerText(), /준비 중/);
      await p.clock.fastForward(10000);
      assert.equal(await d.isVisible(), true);
      await p.screenshot({ path: out + '/call-preview.png' });
      await p.getByRole('button', { name: '채팅으로 돌아가기' }).click();
      await nav(p, 'explore');
      await p
        .getByText('[PRO] 성수동 감성 골목 인생샷 스냅 촬영 1:1 동행 📸', {
          exact: true,
        })
        .click();
      await p.getByRole('button', { name: /유료 동행 미리보기/ }).click();
      const paid = p.getByRole('dialog', { name: '유료 동행 미리보기' });
      await paid.getByRole('button', { name: '3시간', exact: true }).click();
      assert.match(
        await paid.innerText(),
        /결제·예약·매칭 확정은 진행되지 않습니다/,
      );
      await p.clock.fastForward(10000);
      assert.equal(await paid.isVisible(), true);
      await p.screenshot({ path: out + '/paid-preview.png' });
      await paid.getByRole('button', { name: '확인했어요' }).click();
      await open(p, 'room-appt-art');
      assert.equal(await p.locator('[data-active-room]').count(), 1);
    },
    1280,
  );
  await check(
    'review regression 14:50/14:59 locked → 15:00 complete → review once, close/reopen and another appointment isolated',
    async (p) => {
      await login(p);
      await p.locator('#nav-tab-me').click();
      await p.getByRole('button', { name: /강\*훈 님과의 공원 산책/ }).click();
      const done = p.getByRole('button', {
        name: '동행 완료 처리',
        exact: true,
      });
      const review = p.getByRole('button', {
        name: '평가 남기기',
        exact: true,
      });
      assert.equal(await done.isDisabled(), true);
      assert.equal(await review.isDisabled(), true);
      async function jump(iso) {
        const delta = Date.parse(iso) - (await p.evaluate(() => Date.now()));
        await p.clock.fastForward(delta);
      }
      await jump('2026-09-22T14:50:00+09:00');
      assert.equal(await done.isDisabled(), true);
      await jump('2026-09-22T14:59:00+09:00');
      assert.equal(await done.isDisabled(), true);
      await done.scrollIntoViewIfNeeded();
      await p.screenshot({ path: out + '/review-before-end.png' });
      await jump('2026-09-22T15:00:00+09:00');
      assert.equal(await done.isDisabled(), false);
      assert.equal(await review.isDisabled(), true);
      await p.screenshot({ path: out + '/review-at-end.png' });
      await done.click();
      assert.equal(await review.isDisabled(), false);
      await review.click();
      await p
        .locator('textarea')
        .fill('종료 시각 이후 작성한 산책 후기입니다.');
      await p
        .getByRole('button', {
          name: '블라인드 평가 안심 제출하기',
          exact: true,
        })
        .click();
      await p.getByRole('button', { name: '평가창 닫기', exact: true }).click();
      await p
        .getByRole('button', { name: '제출한 평가 확인', exact: true })
        .click();
      assert.match(
        await p.locator('body').innerText(),
        /종료 시각 이후 작성한 산책 후기입니다/,
      );
      assert.equal(
        await p
          .getByRole('button', {
            name: '블라인드 평가 안심 제출하기',
            exact: true,
          })
          .count(),
        0,
      );
      await p
        .getByRole('button', {
          name: '상대방 평가 도착 시연 (테스트용)',
          exact: true,
        })
        .click();
      await p.clock.fastForward(5000);
      await p.getByRole('button', { name: '평가창 닫기', exact: true }).click();
      await p
        .getByRole('button', { name: '제출한 평가 확인', exact: true })
        .click();
      assert.equal(
        await p
          .getByRole('button', {
            name: '상대방 평가 도착 시연 (테스트용)',
            exact: true,
          })
          .count(),
        0,
      );
      await p.getByRole('button', { name: '평가창 닫기', exact: true }).click();
      await p
        .getByRole('button', { name: '참여 대시보드 닫기', exact: true })
        .click();
      assert.match(await p.locator('main').innerText(), /52/);
      await p
        .getByRole('button', { name: /조\*미 님과의 강남맛집 식사 동행/ })
        .click();
      assert.equal(
        await p
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        false,
      );
      assert.equal(
        await p
          .getByRole('button', { name: '평가 남기기', exact: true })
          .isDisabled(),
        true,
      );
    },
  );

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (result.cases.some((c) => c.status === 'FAIL') || result.errors.length)
    process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
