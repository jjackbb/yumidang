const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict');
const url = process.env.CHECK_URL || 'http://127.0.0.1:4180';
const out = path.resolve(__dirname, '../../docs/post-lifecycle/evidence');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  const result = {
    url,
    mode: 'Frontend simulation; Supabase intercepted; no real messages or penalties',
    cases: [],
    errors: [],
  };
  async function check(name, fn, width = 390) {
    if (process.env.CASE && !name.startsWith(process.env.CASE)) return;
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      timezoneId: 'Asia/Seoul',
    });
    await context.route('**/*.supabase.co/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    const p = await context.newPage();
    p.setDefaultTimeout(7000);
    p.on('pageerror', (e) => result.errors.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.clock.install({ time: new Date('2026-09-15T12:00:00+09:00') });
    await p.clock.pauseAt(new Date('2026-09-15T12:00:01+09:00'));
    await p.goto(url, { waitUntil: 'networkidle' });
    try {
      await login(p);
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
        path: path.join(out, 'failure-' + name.split(' ')[0] + '.png'),
      });
    } finally {
      console.log(result.cases.at(-1));
      await context.close();
      fs.writeFileSync(
        path.join(
          out,
          process.env.CASE
            ? `case-${process.env.CASE}.json`
            : url.includes('vercel.app')
              ? 'production.json'
              : 'build.json',
        ),
        JSON.stringify(result, null, 2),
      );
    }
  }
  async function login(p) {
    await p
      .locator('header')
      .getByRole('button', { name: '로그인', exact: true })
      .click();
    await p.getByRole('button', { name: '인증번호 발송', exact: true }).click();
    await p
      .getByRole('button', { name: '테스트코드 입력', exact: true })
      .click();
    await p
      .getByRole('button', { name: '인증 확인 및 로그인', exact: true })
      .click();
  }
  const nav = (p, id) => p.locator('#nav-tab-' + id).click();
  const room = (p) =>
    p.getByRole('region', { name: '동행 대화방', exact: true });
  const request = (p, id) => p.locator(`[data-request-id="${id}"]`);
  async function me(p) {
    await nav(p, 'me');
    await p.getByRole('tab', { name: /받은 신청/ }).click();
  }
  async function ownPost(p) {
    await nav(p, 'me');
    await p
      .getByRole('region', { name: '내가 쓴 공고' })
      .getByRole('button', { name: /성수동 디저트/ })
      .click();
    return p.getByRole('dialog', { name: '동행 공고 상세', exact: true });
  }
  async function edit(p) {
    await ownPost(p);
    await p.getByRole('button', { name: '공고 수정', exact: true }).click();
    return p.getByRole('dialog', { name: '동행 공고 수정' });
  }
  async function openRoom(p, id) {
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
  }
  async function dismiss(p) {
    if (await p.getByRole('button', { name: '안내 닫기' }).count())
      await p.getByRole('button', { name: '안내 닫기' }).click();
  }
  async function closePostDialog(p) {
    await p
      .getByRole('button', { name: '공고 상세 닫기', exact: true })
      .click();
  }
  async function save(p) {
    await p
      .getByRole('dialog', { name: '동행 공고 수정' })
      .locator('button[type="submit"]')
      .click();
  }
  await check(
    'close confirmation synchronizes Me chat and post without inventing a second member',
    async (p) => {
      await openRoom(p, 'room-req-init-1');
      await p
        .getByRole('textbox', { name: '메시지', exact: true })
        .fill('마감 전에 나눈 대화');
      await p.getByRole('button', { name: '메시지 보내기' }).click();
      await ownPost(p);
      await p.getByRole('button', { name: '모집 조기 마감' }).click();
      const confirm = p.getByRole('dialog', { name: '모집 마감', exact: true });
      await confirm.getByRole('button', { name: '돌아가기' }).click();
      assert.equal(
        await p
          .getByRole('button', { name: '공고 수정', exact: true })
          .isEnabled(),
        true,
      );
      await p.getByRole('button', { name: '모집 조기 마감' }).click();
      await confirm.getByRole('button', { name: '모집 마감하기' }).click();
      await dismiss(p);
      const detail = p.getByRole('dialog', {
        name: '동행 공고 상세',
        exact: true,
      });
      assert.doesNotMatch(await detail.innerText(), /2\/2명/);
      assert.equal(
        await detail
          .getByRole('button', { name: '공고 수정', exact: true })
          .isDisabled(),
        true,
      );
      await closePostDialog(p);
      await me(p);
      assert.match(
        await request(p, 'req-init-1').innerText(),
        /모집 마감으로 종료/,
      );
      assert.equal(
        await request(p, 'req-init-1')
          .getByRole('button', { name: '수락하기', exact: true })
          .count(),
        0,
      );
      await request(p, 'req-init-1')
        .getByRole('button', { name: '대화 내역 보기' })
        .click();
      assert.match(await room(p).innerText(), /마감 전에 나눈 대화/);
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await p.screenshot({ path: path.join(out, 'closed-chat.png') });
    },
  );
  await check(
    'delete preserves a usable old request link and removes the public listing',
    async (p) => {
      await ownPost(p);
      await p
        .getByRole('button', { name: '공고 삭제하기', exact: true })
        .click();
      await p
        .getByRole('dialog', { name: '공고 삭제', exact: true })
        .getByRole('button', { name: '공고 삭제하기', exact: true })
        .click();
      await dismiss(p);
      assert.equal(
        await p
          .getByRole('dialog', { name: '삭제된 공고', exact: true })
          .isVisible(),
        true,
      );
      await p
        .getByRole('button', { name: '이전 화면으로', exact: true })
        .click();
      await me(p);
      assert.match(
        await request(p, 'req-init-1').innerText(),
        /공고 삭제로 종료/,
      );
      await request(p, 'req-init-1')
        .getByRole('button', {
          name: '성수동 디저트 오마카세 같이 가실 분',
          exact: true,
        })
        .click();
      assert.equal(
        await p
          .getByRole('dialog', { name: '삭제된 공고', exact: true })
          .isVisible(),
        true,
      );
      await p.screenshot({ path: path.join(out, 'deleted-post.png') });
      await p
        .getByRole('button', { name: '이전 화면으로', exact: true })
        .click();
      await nav(p, 'explore');
      assert.equal(
        await p
          .getByText('성수동 디저트 오마카세 같이 가실 분', { exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    'expiry at the exact deadline disables acceptance and keeps a confirmed appointment',
    async (p) => {
      await edit(p);
      await p
        .getByLabel('모집 마감 날짜·시각', { exact: true })
        .fill('2026-09-15T12:01');
      await save(p);
      await closePostDialog(p);
      await me(p);
      assert.equal(
        await request(p, 'req-init-1')
          .getByRole('button', { name: '수락하기', exact: true })
          .isEnabled(),
        true,
      );
      await p.clock.fastForward(
        Date.parse('2026-09-15T12:00:59.999+09:00') -
          (await p.evaluate(() => Date.now())),
      );
      assert.equal(
        await request(p, 'req-init-1')
          .getByRole('button', { name: '수락하기', exact: true })
          .isEnabled(),
        true,
      );
      await p.clock.fastForward(1);
      await request(p, 'req-init-1')
        .getByText('모집 기간 만료', { exact: true })
        .waitFor();
      assert.equal(
        await p.evaluate(() => Date.now()),
        Date.parse('2026-09-15T12:01:00+09:00'),
      );
      assert.match(
        await request(p, 'req-init-1').innerText(),
        /모집 기간 만료/,
      );
      await request(p, 'req-init-1')
        .getByRole('button', { name: '대화 내역 보기' })
        .click();
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await openRoom(p, 'room-appt-art');
      assert.match(
        await room(p).locator('[data-chat-status]').innerText(),
        /매칭 확정/,
      );
    },
  );
  await check(
    'host edits require individual consent and only the selected applicant becomes confirmed',
    async (p) => {
      await edit(p);
      await p.getByLabel('시작 시각', { exact: true }).fill('16:00');
      await p.getByLabel('종료 시각', { exact: true }).fill('17:00');
      await p
        .getByPlaceholder('공개 랜드마크 (예: 안국역 2번 출구)')
        .fill('서울숲 입구');
      await save(p);
      const detail = p.getByRole('dialog', {
        name: '동행 공고 상세',
        exact: true,
      });
      assert.match(await detail.innerText(), /17:00/);
      await closePostDialog(p);
      await me(p);
      for (const id of ['req-init-1', 'req-init-2'])
        assert.equal(
          await request(p, id)
            .getByRole('button', { name: '조건 동의 대기', exact: true })
            .isDisabled(),
          true,
        );
      await request(p, 'req-init-1')
        .getByRole('button', { name: '대화하기' })
        .click();
      const panel = p.getByRole('region', { name: '변경 조건 확인' });
      assert.match(await panel.innerText(), /이전:.*16:00/);
      assert.match(await panel.innerText(), /변경:.*17:00/);
      await p.screenshot({
        path: path.join(out, 'conditions-before-after.png'),
      });
      await panel.getByText('신청자 응답 시연', { exact: true }).click();
      await panel.getByRole('button', { name: '신청자 동의 시연' }).click();
      assert.match(
        await room(p).locator('[data-chat-status]').innerText(),
        /확정 전/,
      );
      await p
        .getByRole('button', { name: '동행 수락하기', exact: true })
        .click();
      assert.match(await room(p).innerText(), /17:00/);
      await me(p);
      assert.match(
        await request(p, 'req-init-2').innerText(),
        /다른 동행자와 확정/,
      );
      await ownPost(p);
      assert.equal(
        await p
          .getByRole('button', { name: '공고 수정', exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await p
          .getByRole('button', { name: '공고 삭제하기', exact: true })
          .isDisabled(),
        true,
      );
    },
  );
  await check(
    'requester reviews changes and refusal ends only the request',
    async (p) => {
      await openRoom(p, 'room-req-sent-demo');
      await p.getByText('프로토타입 시연 도구', { exact: true }).click();
      await p.getByRole('button', { name: '작성자 조건 변경 시연' }).click();
      const panel = p.getByRole('region', { name: '변경 조건 확인' });
      assert.equal(await panel.isVisible(), true);
      assert.equal(
        await p
          .getByRole('button', { name: '작성자 수락 시연', exact: true })
          .isDisabled(),
        true,
      );
      await panel
        .getByRole('button', { name: '변경 거절 · 신청 종료' })
        .click();
      assert.match(await room(p).innerText(), /변경 조건 거절/);
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      await nav(p, 'me');
      await p.getByRole('tab', { name: /신청한 동행/ }).click();
      assert.match(
        await request(p, 'req-sent-demo').innerText(),
        /변경 조건 거절/,
      );
    },
  );
  await check(
    'cancellation requires a reason preserves history and disables future appointment actions',
    async (p) => {
      await me(p);
      await request(p, 'req-init-1')
        .getByRole('button', { name: '수락하기', exact: true })
        .click();
      const id = await room(p).getAttribute('data-active-room');
      await p.getByRole('button', { name: '약속 상세 →', exact: true }).click();
      await p
        .getByRole('dialog', { name: '약속 상세', exact: true })
        .getByRole('button', { name: '확정 동행 취소', exact: true })
        .click();
      const cancel = p.getByRole('dialog', {
        name: '확정 동행 취소',
        exact: true,
      });
      await cancel.getByRole('button', { name: '확정 동행 취소하기' }).click();
      assert.equal(await cancel.getByRole('alert').count(), 1);
      await cancel.getByRole('radio', { name: '개인 사정이 생겼어요' }).check();
      await cancel.getByRole('button', { name: '확정 동행 취소하기' }).click();
      const dashboard = p.getByRole('dialog', {
        name: '약속 상세',
        exact: true,
      });
      assert.match(await dashboard.innerText(), /취소 사유: 개인 사정/);
      assert.equal(
        await dashboard
          .getByRole('button', { name: '동행 완료 처리', exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await dashboard
          .getByRole('button', { name: /도착 예정 안심 알림/ })
          .isDisabled(),
        true,
      );
      await p.screenshot({ path: path.join(out, 'cancelled-appointment.png') });
      await dashboard
        .getByRole('button', { name: '동행 대화방 바로가기' })
        .click();
      assert.equal(await room(p).getAttribute('data-active-room'), id);
      assert.equal(
        await p.getByRole('textbox', { name: '메시지', exact: true }).count(),
        0,
      );
      assert.equal(
        await p.getByRole('button', { name: '안심 통화 안내' }).count(),
        0,
      );
      await me(p);
      assert.match(
        await request(p, 'req-init-1').innerText(),
        /확정 동행 취소/,
      );
      await nav(p, 'home');
      assert.equal(
        await p.getByRole('button', { name: /성수동 디저트/ }).count(),
        0,
      );
    },
  );
  await check(
    'overlap warning allows returning then continuing without cancelling an old appointment',
    async (p) => {
      await p.locator('#cat-exhibition').click();
      await p
        .getByText('오후 사진전 14:30~15:30 함께 관람해요', { exact: true })
        .click();
      await p
        .getByRole('button', { name: '1:1 동행 참여 신청하기', exact: true })
        .click();
      await p
        .getByRole('dialog', { name: '동행 참여 신청', exact: true })
        .locator('textarea')
        .fill('겹치는 시간 확인 후 신청합니다.');
      await p.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
      const conflict = p.getByRole('dialog', {
        name: '일정 중복 안내',
        exact: true,
      });
      assert.match(await conflict.innerText(), /강남맛집 식사 동행/);
      await conflict.getByRole('button', { name: '돌아가서 확인' }).click();
      assert.equal(
        await p
          .getByRole('dialog', { name: '동행 참여 신청' })
          .locator('textarea')
          .inputValue(),
        '겹치는 시간 확인 후 신청합니다.',
      );
      await p.getByRole('button', { name: '1:1 동행 신청서 전달하기' }).click();
      await p.screenshot({ path: path.join(out, 'schedule-conflict.png') });
      await conflict
        .getByRole('button', { name: '확인했어요 · 계속 진행' })
        .click();
      assert.match(await room(p).innerText(), /겹치는 시간 확인 후 신청합니다/);
      await p.getByText('프로토타입 시연 도구', { exact: true }).click();
      await p
        .getByRole('button', { name: '작성자 수락 시연', exact: true })
        .click();
      assert.equal(await conflict.isVisible(), true);
      await conflict
        .getByRole('button', { name: '확인했어요 · 계속 진행' })
        .click();
      assert.match(
        await room(p).locator('[data-chat-status]').innerText(),
        /매칭 확정/,
      );
      await openRoom(p, 'room-appt-gangnam-brunch');
      assert.match(
        await room(p).locator('[data-chat-status]').innerText(),
        /매칭 확정/,
      );
      await p.getByTitle('일정/장소 제안하기', { exact: true }).click();
      await p
        .getByLabel('새 시작 날짜·시각', { exact: true })
        .fill('2026-09-17T15:00');
      await p
        .getByLabel('새 종료 날짜·시각', { exact: true })
        .fill('2026-09-17T16:00');
      await p.getByRole('button', { name: '제안 전송하기' }).click();
      await p
        .getByRole('button', { name: '상대 수락 시연', exact: true })
        .click();
      assert.equal(await conflict.isVisible(), true);
      await conflict.getByRole('button', { name: '돌아가서 확인' }).click();
      assert.equal(
        await p
          .getByRole('button', { name: '상대 수락 시연', exact: true })
          .count(),
        1,
      );
      await p
        .getByRole('button', { name: '상대 수락 시연', exact: true })
        .click();
      await conflict
        .getByRole('button', { name: '확인했어요 · 계속 진행' })
        .click();
      assert.match(await room(p).innerText(), /변경 수락됨/);
    },
    1280,
  );
  await check(
    'create validates a required deadline and preserves the form when overlap is declined',
    async (p) => {
      await p.locator('#btn-fab-create').click();
      const form = p.getByRole('dialog', {
        name: '동행 공고 작성',
        exact: true,
      });
      await form
        .getByPlaceholder(
          '예: 주말 삼청동 한옥 카페 디저트 투어 1:1 동행 가실 분!',
        )
        .fill('일정 경고 검증용 공고');
      await form
        .getByLabel('동행 상세 소개')
        .fill('시간과 마감을 확인하는 공고입니다.');
      await form.getByLabel('시작 날짜', { exact: true }).fill('2026-09-17');
      await form.getByLabel('시작 시각', { exact: true }).fill('14:30');
      await form.getByLabel('종료 시각', { exact: true }).fill('15:30');
      await form
        .getByLabel('모집 마감 날짜·시각', { exact: true })
        .fill('2026-09-17T15:00');
      await form.locator('button[type="submit"]').click();
      assert.equal(
        await form
          .getByLabel('모집 마감 날짜·시각', { exact: true })
          .evaluate((el) => el.validity.rangeOverflow),
        true,
      );
      await form
        .getByLabel('모집 마감 날짜·시각', { exact: true })
        .fill('2026-09-17T14:00');
      await form.locator('button[type="submit"]').click();
      const conflict = p.getByRole('dialog', {
        name: '일정 중복 안내',
        exact: true,
      });
      await conflict.getByRole('button', { name: '돌아가서 확인' }).click();
      assert.equal(await form.isVisible(), true);
      await form.locator('button[type="submit"]').click();
      await conflict
        .getByRole('button', { name: '확인했어요 · 계속 진행' })
        .click();
      assert.equal(await form.count(), 0);
      await nav(p, 'me');
      const own = p.getByRole('region', { name: '내가 쓴 공고' });
      assert.equal(
        await own
          .getByRole('button', { name: /일정 경고 검증용 공고/ })
          .count(),
        1,
      );
      await own.getByRole('button', { name: /일정 경고 검증용 공고/ }).click();
      assert.match(
        await p
          .getByRole('dialog', { name: '동행 공고 상세', exact: true })
          .innerText(),
        /모집 마감/,
      );
    },
  );
  await check('privacy after a schedule change reveals the detailed place only to participants', async p => {
    await openRoom(p, 'room-appt-gangnam-brunch');
    await p.getByTitle('일정/장소 제안하기', { exact: true }).click();
    await p.getByLabel('새 만남 장소', { exact: true }).fill('검증용 비공개 예약석 302호');
    await p.getByRole('button', { name: '제안 전송하기', exact: true }).click();
    await p.getByRole('button', { name: '상대 수락 시연', exact: true }).click();
    await room(p).getByRole('button', { name: '대치동 유명 브런치 카페 주말 런치 파트너 구해요 🥞', exact: true }).click();
    const detail = p.getByRole('dialog', { name: '동행 공고 상세', exact: true });
    assert.equal(await detail.getByText('검증용 비공개 예약석 302호', { exact: true }).count(), 1);
    assert.doesNotMatch(await detail.getByText('공고에 등록한 공개 지역:', { exact: false }).innerText(), /302호/);
    await closePostDialog(p); await nav(p, 'me');
    await p.getByRole('button', { name: '로그아웃', exact: true }).click();
    await p.locator('header').getByRole('button', { name: '로그인', exact: true }).waitFor();
    await nav(p, 'explore');
    await p.getByText('대치동 유명 브런치 카페 주말 런치 파트너 구해요 🥞', { exact: true }).click();
    assert.doesNotMatch(await detail.innerText(), /검증용 비공개 예약석 302호/);
    assert.match(await detail.innerText(), /상세 만남 장소는 1:1 매칭 확정 후 공개/);
    await p.screenshot({ path: path.join(out, 'private-place-locked.png') });
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (
    result.cases.some((item) => item.status === 'FAIL') ||
    result.errors.length
  )
    process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
