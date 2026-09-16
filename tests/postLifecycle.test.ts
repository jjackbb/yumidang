import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelAppointment,
  closePost,
  conditionChanges,
  conditionsOf,
  confirmChangedConditions,
  expirePosts,
  isRecruiting,
  overlappingAppointments,
  updateRecruitingPost,
  type LifecycleState,
} from '../src/utils/postLifecycle.ts';
import {
  acceptRequest,
  createRequestRoom,
  roomAccess,
} from '../src/utils/conversations.ts';
import type { Appointment, JoinRequest, MeetupPost } from '../src/types.ts';
const now = new Date('2099-09-15T12:00:00+09:00');
const post = {
  id: 'post',
  title: '디저트 동행',
  authorId: 'host',
  author: '작성자',
  avatar: '',
  category: '식사',
  description: '디저트 코스',
  startsAt: '2099-09-18T15:00:00+09:00',
  endsAt: '2099-09-18T16:00:00+09:00',
  recruitmentEndsAt: '2099-09-18T15:00:00+09:00',
  location: '성수동',
  publicLocation: '성수역',
  secretLocation: '비공개 예약석 A',
  partnerPreferences: '디저트를 좋아하는 분',
  time: '원래 표시',
  tags: [],
  currentMembers: 1,
  maxMembers: 2,
  status: 'recruiting',
} as MeetupPost;
const request = {
  id: 'first',
  postId: 'post',
  hostId: 'host',
  postTitle: post.title,
  requesterId: 'guest',
  requesterName: '신청자',
  requesterAvatar: '',
  requesterSugar: 50,
  message: '원래 신청문',
  status: 'pending',
  createdAt: '방금',
  conditionSnapshot: conditionsOf(post),
} as JoinRequest;
const second = { ...request, id: 'second', requesterId: 'guest2' };
function fixture(): LifecycleState {
  return {
    posts: [post],
    requests: [request, second],
    rooms: [createRequestRoom(request, post), createRequestRoom(second, post)],
    appointments: [],
    notifications: [],
  };
}
const changed = {
  ...post,
  startsAt: '2099-09-18T16:00:00+09:00',
  endsAt: '2099-09-18T17:00:00+09:00',
  publicLocation: '서울숲 입구',
};
function appointment(state: LifecycleState): LifecycleState {
  return {
    ...state,
    posts: [
      { ...post, status: 'closed', closedReason: 'matched', currentMembers: 2 },
    ],
    requests: [{ ...request, status: 'accepted' }],
    rooms: [{ ...state.rooms[0], appointmentId: 'apt', draft: '작성 중' }],
    appointments: [
      {
        id: 'apt',
        postId: 'post',
        status: '매칭 확정',
        participantIds: ['host', 'guest'],
        scheduledAt: post.startsAt,
        endsAt: post.endsAt,
      } as Appointment,
    ],
  };
}

test('manual closure ends pending candidates, retains conversations and does not manufacture a match', () => {
  const before = fixture(),
    after = closePost(before, 'post', 'closed', 'host', now)!;
  assert.equal(after.posts[0].currentMembers, 1);
  assert.equal(after.posts[0].closedReason, 'manual');
  assert.equal(after.appointments.length, 0);
  assert.deepEqual(
    after.requests.map((item) => item.status),
    ['post_closed', 'post_closed'],
  );
  assert.equal(after.rooms[0].messages[0].text, request.message);
  assert.equal(after.notifications[0].roomId, after.rooms[0].id);
  assert.equal(closePost(after, 'post', 'closed', 'host', now), null);
  assert.equal(closePost(before, 'post', 'closed', 'guest', now), null);
});
test('delete leaves a tombstone for old request links and never deletes message history', () => {
  const after = closePost(fixture(), 'post', 'deleted', 'host', now)!;
  assert.equal(after.posts[0].status, 'deleted');
  assert.equal(after.requests[0].status, 'post_deleted');
  assert.equal(after.rooms[0].messages[0].text, request.message);
  assert.equal(
    roomAccess(after.rooms[0], 'guest', after.requests, [], after.posts)
      .canSend,
    false,
  );
});
test('expiry uses the exact deadline, is idempotent, and cannot cancel an existing appointment', () => {
  const state = fixture(),
    cutoff = new Date(post.recruitmentEndsAt!);
  assert.equal(expirePosts(state, new Date(cutoff.getTime() - 1)), null);
  const expired = expirePosts(state, cutoff)!;
  assert.equal(expired.posts[0].status, 'expired');
  assert.equal(expired.requests[0].status, 'post_expired');
  assert.equal(expirePosts(expired, cutoff), null);
  assert.equal(isRecruiting(post, cutoff), false);
  assert.equal(expirePosts(appointment(state), cutoff), null);
});
test('condition changes require each applicant to consent and keep the original baseline through later edits', () => {
  const first = updateRecruitingPost(fixture(), changed, 'host', now)!;
  assert.equal(first.requests[0].status, 'reconfirming');
  assert.match(first.posts[0].time, /17:00/);
  assert.equal(
    acceptRequest(first.requests, first.posts[0], 'first', 'host'),
    null,
  );
  const latest = updateRecruitingPost(
    first,
    { ...first.posts[0], location: '종로구' },
    'host',
    now,
  )!;
  assert.equal(latest.requests[0].reconfirmation?.revision, 2);
  assert.equal(
    latest.requests[0].reconfirmation?.changes.find(
      (item) => item.label === '공개 만남 장소',
    )?.before,
    '성수동 · 성수역',
  );
  assert.equal(
    confirmChangedConditions(latest, 'first', 1, true, 'guest', now),
    null,
  );
  assert.equal(
    confirmChangedConditions(latest, 'first', 2, true, 'host', now),
    null,
  );
});
test('consent permits host acceptance but does not itself confirm or consent for other applicants', () => {
  const state = updateRecruitingPost(fixture(), changed, 'host', now)!;
  const agreed = confirmChangedConditions(
    state,
    'first',
    1,
    true,
    'guest',
    now,
  )!;
  assert.equal(agreed.requests[0].status, 'pending');
  assert.equal(agreed.requests[1].status, 'reconfirming');
  assert.equal(agreed.appointments.length, 0);
  const accepted = acceptRequest(
    agreed.requests,
    agreed.posts[0],
    'first',
    'host',
  )!;
  assert.deepEqual(
    accepted.map((item) => item.status),
    ['accepted', 'matched_with_other'],
  );
});
test('declined or expired reconfirmations cannot be reused, and decline closes only that request', () => {
  const state = updateRecruitingPost(fixture(), changed, 'host', now)!;
  const declined = confirmChangedConditions(
    state,
    'first',
    1,
    false,
    'guest',
    now,
  )!;
  assert.equal(declined.requests[0].status, 'change_declined');
  assert.equal(declined.requests[1].status, 'reconfirming');
  assert.equal(
    confirmChangedConditions(declined, 'first', 1, true, 'guest', now),
    null,
  );
  assert.equal(
    confirmChangedConditions(
      state,
      'first',
      1,
      true,
      'guest',
      new Date(post.recruitmentEndsAt!),
    ),
    null,
  );
});
test('unchanged save and tag edits do not demand consent; restoring original terms removes the pending change', () => {
  const unchanged = updateRecruitingPost(
    fixture(),
    { ...post, companionType: 'free', tags: ['추천'] },
    'host',
    now,
  )!;
  assert.equal(unchanged.requests[0].status, 'pending');
  const changedState = updateRecruitingPost(fixture(), changed, 'host', now)!;
  const restored = updateRecruitingPost(changedState, post, 'host', now)!;
  assert.equal(restored.requests[0].status, 'pending');
  assert.equal(restored.requests[0].reconfirmation, undefined);
});
test('private location changes are detectable without exposing the exact old or new address', () => {
  const changes = conditionChanges(
    conditionsOf(post),
    conditionsOf({ ...post, secretLocation: '비공개 예약석 B' }),
  );
  assert.equal(changes[0].label, '상세 만남 장소');
  assert.doesNotMatch(JSON.stringify(changes), /예약석 [AB]/);
});
test('foreign, closed, expired, invalid-deadline and confirmed posts reject direct edits', () => {
  const state = fixture();
  assert.equal(updateRecruitingPost(state, changed, 'guest', now), null);
  assert.equal(
    updateRecruitingPost(
      state,
      { ...changed, recruitmentEndsAt: '2099-09-19T12:00:00+09:00' },
      'host',
      now,
    ),
    null,
  );
  assert.equal(
    updateRecruitingPost(
      state,
      changed,
      'host',
      new Date(post.recruitmentEndsAt!),
    ),
    null,
  );
  const confirmed = appointment(state);
  assert.equal(updateRecruitingPost(confirmed, changed, 'host', now), null);
  for (const mode of ['closed', 'deleted'] as const)
    assert.equal(closePost(confirmed, 'post', mode, 'host', now), null);
});
test('either participant can cancel once with a reason; completed or unrelated appointments cannot be cancelled', () => {
  const state = appointment(fixture());
  for (const actor of ['host', 'guest']) {
    const cancelled = cancelAppointment(state, 'apt', '일정 변경', actor, now)!;
    assert.equal(cancelled.appointments[0].status, '동행 취소');
    assert.equal(cancelled.requests[0].status, 'match_cancelled');
    assert.equal(cancelled.posts[0].status, 'closed');
    assert.equal(cancelled.posts[0].currentMembers, 1);
    assert.equal(cancelled.rooms[0].draft, '작성 중');
    assert.equal(
      roomAccess(
        cancelled.rooms[0],
        actor,
        cancelled.requests,
        cancelled.appointments,
        cancelled.posts,
      ).canSend,
      false,
    );
    assert.equal(
      cancelAppointment(cancelled, 'apt', '다시 취소', actor, now),
      null,
    );
  }
  assert.equal(cancelAppointment(state, 'apt', '', 'guest', now), null);
  assert.equal(cancelAppointment(state, 'apt', '사유', 'stranger', now), null);
  assert.equal(
    cancelAppointment(
      {
        ...state,
        appointments: [{ ...state.appointments[0], status: '동행 완료' }],
      },
      'apt',
      '사유',
      'host',
      now,
    ),
    null,
  );
});
test('overlap detects partial and overnight intersections but excludes adjacent, cancelled and other-user appointments', () => {
  const base = {
    id: 'apt',
    status: '매칭 확정',
    participantIds: ['host'],
    scheduledAt: '2099-09-15T23:00:00+09:00',
    endsAt: '2099-09-16T01:00:00+09:00',
  } as Appointment;
  assert.equal(
    overlappingAppointments(
      [base],
      ['host'],
      '2099-09-16T00:30:00+09:00',
      '2099-09-16T02:00:00+09:00',
    ).length,
    1,
  );
  assert.equal(
    overlappingAppointments(
      [base],
      ['host'],
      base.endsAt,
      '2099-09-16T02:00:00+09:00',
    ).length,
    0,
  );
  assert.equal(
    overlappingAppointments([base], ['other'], base.scheduledAt, base.endsAt)
      .length,
    0,
  );
  assert.equal(
    overlappingAppointments(
      [{ ...base, status: '동행 취소' }],
      ['host'],
      base.scheduledAt,
      base.endsAt,
    ).length,
    0,
  );
  assert.equal(
    overlappingAppointments(
      [base],
      ['host'],
      base.scheduledAt,
      base.endsAt,
      base.id,
    ).length,
    0,
  );
});
