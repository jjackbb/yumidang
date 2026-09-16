import test from 'node:test';
import assert from 'node:assert/strict';

import { toLiveError } from '../src/live/errors.ts';
import { ageLabel, formatRange, mergeMessages, postStatusLabel, PUBLIC_AREA_PATTERN, REQUEST_STATUS_LABEL, timeKey, validatePostDraft } from '../src/live/format.ts';

const NOW = new Date('2026-09-16T03:00:00Z');
const draft = {
  title: '성수 전시 같이 봐요', description: '천천히 관람해요', category: '전시',
  startsAt: '2026-09-20T05:00:00.000Z', endsAt: '2026-09-20T07:00:00.000Z', recruitmentEndsAt: '2026-09-20T04:00:00.000Z',
  publicArea: '서울특별시 성동구 성수동', exactLocation: '성수역 3번 출구 앞', preferenceNote: '',
};

test('request status labels follow the product wording', () => {
  assert.equal(REQUEST_STATUS_LABEL.pending, '매칭 대화 중');
  assert.equal(REQUEST_STATUS_LABEL.withdrawn, '신청 취소');
  assert.equal(REQUEST_STATUS_LABEL.declined, '신청 거절');
  assert.equal(REQUEST_STATUS_LABEL.matched, '동행 확정');
  assert.equal(REQUEST_STATUS_LABEL.not_selected, '다른 동행자와 확정');
  assert.equal(ageLabel(25), '25살');
});

test('public area accepts 시·구·동 only', () => {
  for (const ok of ['서울특별시 성동구 성수동', '경기도 성남시 분당구 정자동', '서울특별시 성동구 성수동1가']) assert.ok(PUBLIC_AREA_PATTERN.test(ok), ok);
  for (const bad of ['성수역 3번 출구', '서울특별시 성동구', '서울특별시 성동구 성수동 12-3']) assert.ok(!PUBLIC_AREA_PATTERN.test(bad), bad);
});

test('post draft validation mirrors the server contract', () => {
  assert.equal(validatePostDraft(draft, NOW), null);
  assert.match(validatePostDraft({ ...draft, publicArea: '성수역 3번 출구' }, NOW)!, /시·구·동/);
  assert.match(validatePostDraft({ ...draft, exactLocation: '가' }, NOW)!, /2~200자/);
  assert.match(validatePostDraft({ ...draft, endsAt: draft.startsAt }, NOW)!, /종료/);
  assert.match(validatePostDraft({ ...draft, recruitmentEndsAt: '2026-09-20T06:00:00.000Z' }, NOW)!, /모집 마감은/);
  assert.match(validatePostDraft({ ...draft, recruitmentEndsAt: '2026-09-16T02:00:00.000Z' }, NOW)!, /지금 이후/);
});

test('post status label uses the server clock', () => {
  const post = { status: 'recruiting' as const, recruitment_ends_at: '2026-09-16T04:00:00Z', starts_at: '2026-09-16T05:00:00Z' };
  assert.equal(postStatusLabel(post, '2026-09-16T03:59:59Z'), '모집 중');
  assert.equal(postStatusLabel(post, '2026-09-16T04:00:00Z'), '모집 마감');
  assert.equal(postStatusLabel({ ...post, status: 'closed' }, NOW), '모집 완료');
});

test('messages merge by id and sort by microsecond timestamp across formats', () => {
  const a = { id: 'b', created_at: '2026-09-16T03:00:00.000002+00:00' };
  const b = { id: 'a', created_at: '2026-09-16 03:00:00.000001+00' };
  const c = { id: 'c', created_at: '2026-09-16T03:00:00.000002+00:00' };
  assert.equal(timeKey(a.created_at) - timeKey(b.created_at), 1);
  const merged = mergeMessages([a], [b, c, { ...a }]);
  assert.deepEqual(merged.map(item => item.id), ['a', 'b', 'c']);
});

test('formatRange shows Seoul time', () => {
  assert.match(formatRange('2026-09-20T05:00:00Z', '2026-09-20T07:00:00Z'), /14:00 ~ 16:00/);
});

test('server errors map to safe user messages', () => {
  assert.equal(toLiveError({ message: 'too_early' }).code, 'too_early');
  assert.match(toLiveError({ message: 'new row violates check constraint "posts_public_area_format"', code: '23514' }).message, /시·구·동/);
  assert.doesNotMatch(toLiveError({ message: 'internal detail secret', code: 'XX000' }).message, /secret/);
});
