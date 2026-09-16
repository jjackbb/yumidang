import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEADLINE_MESSAGE, END_BEFORE_START_MESSAGE, POST_FORM_STEPS, defaultPostForm, parseTags, postFieldsFromForm, postFormFromPost,
  requestEligibility, validatePostForm, type PostFormValues,
} from '../src/utils/postForm.ts';
import { activeFilterLabels, addDaysToKey, emptyExploreFilters, filterPosts } from '../src/utils/explore.ts';
import { myActivity, postEndedReason, requestEndedReason } from '../src/utils/myActivity.ts';
import { cancelAppointment, closePost, conditionsOf, confirmChangedConditions, updateRecruitingPost, type LifecycleState } from '../src/utils/postLifecycle.ts';
import { acceptRequest, requestStatusLabel } from '../src/utils/conversations.ts';
import { eventById } from '../src/data/events.ts';
import type { Appointment, JoinRequest, MeetupPost } from '../src/types.ts';

const now = new Date('2099-09-15T12:00:00+09:00');
const valid: PostFormValues = {
  ...defaultPostForm(now),
  title: '사진전 동행', category: '전시', description: '천천히 관람해요',
  startDate: '2099-09-17', startTime: '14:00', endDate: '2099-09-17', endTime: '15:00', deadline: '',
  partnerGender: 'female', tags: '#사진 #전시',
};
const post = (patch: Partial<MeetupPost> = {}): MeetupPost => ({
  id: 'p1', title: '디저트', category: '식사', author: '작성자', authorId: 'host', avatar: '', time: '',
  startsAt: '2099-09-18T15:00:00+09:00', endsAt: '2099-09-18T16:00:00+09:00', recruitmentEndsAt: '2099-09-18T15:00:00+09:00',
  description: '디저트 코스', location: '성동구 성수동', publicLocation: '성수역', secretLocation: '예약석', partnerPreferences: '',
  tags: [], currentMembers: 1, maxMembers: 2, status: 'recruiting', ...patch,
});
const request = (id: string, requesterId: string, patch: Partial<JoinRequest> = {}): JoinRequest => ({
  id, hostId: 'host', postId: 'p1', postTitle: '디저트', requesterId, requesterName: requesterId, requesterAvatar: '', requesterSugar: 15,
  message: '안녕하세요', status: 'pending', createdAt: '방금', conditionSnapshot: conditionsOf(post()), ...patch,
});

test('post form: required fields, past start, end after start, now < deadline <= start', () => {
  assert.deepEqual(validatePostForm(valid, now), {});
  const empty = validatePostForm({ ...valid, title: ' ', description: '', location: '', publicLocation: '' }, now);
  assert.deepEqual(Object.keys(empty).sort(), ['description', 'location', 'publicLocation', 'title']);
  assert.match(validatePostForm({ ...valid, startDate: '2099-09-15', startTime: '11:59', endDate: '2099-09-15', endTime: '13:00' }, now).startDate!, /지난 일정/);
  // Starting exactly now is already past.
  assert.ok(validatePostForm({ ...valid, startDate: '2099-09-15', startTime: '12:00', endDate: '2099-09-15', endTime: '13:00' }, now).startDate);
  assert.equal(validatePostForm({ ...valid, endTime: '14:00' }, now).endDate, END_BEFORE_START_MESSAGE);
  assert.equal(validatePostForm({ ...valid, endTime: '13:00' }, now).endDate, END_BEFORE_START_MESSAGE);
  // Overnight end on the next day is valid.
  assert.deepEqual(validatePostForm({ ...valid, startTime: '23:00', endDate: '2099-09-18', endTime: '01:00' }, now), {});
  assert.deepEqual(validatePostForm({ ...valid, deadline: '2099-09-17T14:00' }, now), {}, 'deadline equal to start');
  assert.equal(validatePostForm({ ...valid, deadline: '2099-09-17T14:01' }, now).deadline, DEADLINE_MESSAGE);
  assert.equal(validatePostForm({ ...valid, deadline: '2099-09-15T12:00' }, now).deadline, DEADLINE_MESSAGE, 'deadline equal to now');
  assert.deepEqual(validatePostForm({ ...valid, deadline: '2099-09-15T12:01' }, now), {});
  assert.ok(validatePostForm({ ...valid, deadline: '2099-13-01T10:00' }, now).deadline);
});

test('post form B steps use the same rules; A and B save identical fields and edit restores them', () => {
  const broken = { ...valid, title: '', location: '' };
  assert.deepEqual(Object.keys(validatePostForm(broken, now, POST_FORM_STEPS[0])), ['title']);
  assert.deepEqual(Object.keys(validatePostForm(broken, now, POST_FORM_STEPS[1])), ['location']);
  assert.deepEqual(new Set(POST_FORM_STEPS.flat()), new Set(Object.keys(valid)), 'B steps cover every A field');
  const saved = { ...post(), ...postFieldsFromForm({ ...valid, deadline: '2099-09-16T20:00' }) };
  assert.equal(saved.recruitmentEndsAt, new Date('2099-09-16T20:00:00+09:00').toISOString());
  assert.equal(saved.partnerGender, 'female');
  assert.deepEqual(saved.tags, ['사진', '전시']);
  const restored = postFormFromPost(saved, now);
  assert.deepEqual(restored, { ...valid, deadline: '2099-09-16T20:00' });
  assert.deepEqual(postFieldsFromForm(restored), postFieldsFromForm({ ...valid, deadline: '2099-09-16T20:00' }));
  // A deadline equal to the start is restored as the default (empty) value.
  assert.equal(postFormFromPost({ ...post(), ...postFieldsFromForm(valid) }, now).deadline, '');
  assert.deepEqual(parseTags('  ', '전시'), ['전시', '1대1동행']);
});

test('partner condition: eligible members apply, others get a reason, old posts mean anyone', () => {
  assert.equal(requestEligibility(post(), { gender: 'male' }).ok, true);
  assert.equal(requestEligibility(post({ partnerGender: 'female' }), { gender: 'female' }).ok, true);
  const refused = requestEligibility(post({ partnerGender: 'female' }), { gender: 'male' });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /여성만 신청/);
  assert.equal(requestEligibility(post({ partnerGender: 'male' }), { gender: 'undisclosed' }).ok, false);
  assert.equal(requestEligibility(post({ partnerGender: 'male' }), null).ok, true, 'logged-out viewers only see the condition');
});

test('changing the partner condition needs re-consent; consent alone never confirms; then the host accepts one', () => {
  const base: LifecycleState = { posts: [post()], requests: [request('r1', 'a'), request('r2', 'b')], rooms: [], appointments: [], notifications: [] };
  const changed = updateRecruitingPost(base, { ...post(), partnerGender: 'male' }, 'host', now)!;
  assert.ok(changed);
  assert.equal(updateRecruitingPost(base, { ...post(), partnerGender: 'male' }, 'a', now), null, 'only the author edits');
  assert.deepEqual(changed.requests.map(item => item.status), ['reconfirming', 'reconfirming']);
  assert.ok(changed.requests[0].reconfirmation!.changes.some(item => item.label === '상대 성별 조건' && item.after === '남성만 신청 가능'));
  assert.equal(acceptRequest(changed.requests, changed.posts[0], 'r1', 'host', now), null, 'no acceptance while re-consent is pending');
  const agreed = confirmChangedConditions(changed, 'r1', changed.posts[0].revision!, true, 'a', now)!;
  assert.equal(agreed.requests[0].status, 'pending');
  assert.equal(confirmChangedConditions(changed, 'r1', changed.posts[0].revision!, true, 'host', now), null, 'the host cannot consent for the requester');
  assert.equal(acceptRequest(agreed.requests, agreed.posts[0], 'r1', 'a', now), null, 'requester cannot accept own request');
  const accepted = acceptRequest(agreed.requests, agreed.posts[0], 'r1', 'host', now)!;
  assert.deepEqual(accepted.map(item => item.status), ['accepted', 'matched_with_other']);
  // Deadline-only edits are not a condition change.
  const deadlineOnly = updateRecruitingPost(base, { ...post(), recruitmentEndsAt: '2099-09-18T14:00:00+09:00' }, 'host', now)!;
  assert.deepEqual(deadlineOnly.requests.map(item => item.status), ['pending', 'pending']);
});

test('explore filters: category, region, today/7-day/date boundaries, search, zero results and reset', () => {
  const at = (day: string, hour = '10:00') => `${day}T${hour}:00+09:00`;
  // Region matching reads the public area and landmark together; landmarks here are neutral.
  const posts = [
    post({ id: 'today', category: '전시', location: '종로구 삼청동', publicLocation: '미술관 앞', startsAt: at('2099-09-15', '23:30') }),
    post({ id: 'day6', category: '식사', location: '성동구 성수동', publicLocation: '카페 앞', startsAt: at('2099-09-21') }),
    post({ id: 'day7', category: '전시', location: '강남구 대치동', publicLocation: '역 출구', startsAt: at('2099-09-22') }),
    post({ id: 'nodate', category: '기타', location: '서초구 반포', publicLocation: '공원 입구', startsAt: undefined, tags: ['러닝'] }),
  ];
  assert.deepEqual(filterPosts([post({ location: '어딘가', publicLocation: '성수역' })], { ...emptyExploreFilters(), region: 'seongdong' }, now).length, 1, 'landmark counts for the region');
  const ids = (patch: Partial<ReturnType<typeof emptyExploreFilters>>) => filterPosts(posts, { ...emptyExploreFilters(), ...patch }, now).map(item => item.id);
  assert.deepEqual(ids({}), ['today', 'day6', 'day7', 'nodate']);
  assert.deepEqual(ids({ category: '전시' }), ['today', 'day7']);
  assert.deepEqual(ids({ region: 'gangnam' }), ['day7']);
  assert.deepEqual(ids({ date: 'today' }), ['today']);
  assert.deepEqual(ids({ date: 'week' }), ['today', 'day6'], 'today + 6 days included, day 7 excluded');
  assert.deepEqual(ids({ date: 'date', dateValue: '2099-09-22' }), ['day7']);
  assert.deepEqual(ids({ date: 'date', dateValue: '' }), ['today', 'day6', 'day7', 'nodate'], 'no date chosen yet');
  assert.deepEqual(ids({ query: '러닝' }), ['nodate']);
  assert.deepEqual(ids({ category: '전시', region: 'seongdong' }), []);
  assert.deepEqual(activeFilterLabels({ ...emptyExploreFilters(), category: '전시', region: 'jongno', date: 'week' }), ['전시', '종로구', '7일 이내']);
  assert.deepEqual(activeFilterLabels(emptyExploreFilters()), []);
  assert.equal(addDaysToKey('2099-12-30', 3), '2100-01-02');
});

test('Me status lists follow the shared lifecycle: accept, cancel, close and delete show the same state', () => {
  const appointment: Appointment = {
    id: 'apt-r1', postId: 'p1', participantIds: ['host', 'a'], status: '매칭 확정', scheduledAt: post().startsAt, endsAt: post().endsAt,
    dDay: '', appointmentBadge: '', title: '디저트', dateTime: '', location: '', partnerName: '', partnerAvatar: '', partnerRating: 0,
    partnerBio: '', menuRecommendation: '', addressDetail: '', confirmedGuests: 2, totalGuests: 2,
  };
  const state: LifecycleState = {
    posts: [post({ status: 'closed', closedReason: 'matched', currentMembers: 2 })],
    requests: [request('r1', 'a', { status: 'accepted' })],
    rooms: [{ id: 'room-r1', requestId: 'r1', appointmentId: 'apt-r1', postId: 'p1', postTitle: '디저트', members: [], messages: [], draft: '' }],
    appointments: [appointment], notifications: [],
  };
  for (const user of ['host', 'a']) {
    const view = myActivity(user, state.posts, state.appointments);
    assert.deepEqual([view.confirmed.length, view.completed.length, view.cancelled.length], [1, 0, 0]);
  }
  assert.equal(myActivity('host', state.posts, state.appointments).posts.length, 1);
  assert.equal(myActivity('a', state.posts, state.appointments).posts.length, 0);
  assert.equal(myActivity('stranger', state.posts, state.appointments).confirmed.length, 0);
  const cancelled = cancelAppointment(state, 'apt-r1', '일정이 생겼어요', 'a', now)!;
  for (const user of ['host', 'a']) {
    const view = myActivity(user, cancelled.posts, cancelled.appointments);
    assert.deepEqual([view.confirmed.length, view.cancelled.length], [0, 1]);
  }
  assert.equal(cancelled.requests[0].status, 'match_cancelled');
  assert.match(postEndedReason(cancelled.posts[0])!, /취소/);

  const open: LifecycleState = { posts: [post()], requests: [request('r1', 'a')], rooms: [], appointments: [], notifications: [] };
  const closed = closePost(open, 'p1', 'closed', 'host', now)!;
  assert.equal(closed.requests[0].status, 'post_closed');
  assert.match(postEndedReason(closed.posts[0])!, /완료된 것은 아니에요/, 'closing recruitment is not completion');
  assert.equal(myActivity('host', closed.posts, closed.appointments).completed.length, 0);
  assert.equal(closePost(open, 'p1', 'deleted', 'a', now), null, 'only the author deletes');
  const deleted = closePost(open, 'p1', 'deleted', 'host', now)!;
  assert.match(postEndedReason(deleted.posts[0])!, /삭제/);
  assert.equal(requestStatusLabel[deleted.requests[0].status], '공고 삭제로 종료');
  assert.ok(requestEndedReason[deleted.requests[0].status]);
  assert.equal(postEndedReason(post()), null);
});

test('event ids resolve in any month so related posts and new posts point at one event', () => {
  const event = eventById('sample-2099-2-3-1')!;
  assert.equal(event.id, 'sample-2099-2-3-1');
  assert.equal(event.startsOn.slice(0, 7), '2099-02');
  assert.equal(eventById('sample-2099-2-9-1'), undefined);
  assert.equal(eventById(undefined), undefined);
});
