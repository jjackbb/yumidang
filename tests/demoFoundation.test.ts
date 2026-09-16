import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoNow, fromKoreaInputValue, isDemoSearch, koreaInputValue, offsetFor } from '../src/utils/demoMode.ts';
import { canUsePrivateArea, canViewSecretLocation, visibleNotifications } from '../src/utils/access.ts';
import { hasMetBefore, notificationSettingsFor, relationToSender } from '../src/utils/relations.ts';
import { NEW_USER_SUGAR, publicProfileForMember, publicProfileForPost } from '../src/data/publicProfiles.ts';
import { demoAccounts } from '../src/data/demoAccounts.ts';
import { DEMO_USER_ID } from '../src/data/demoIdentity.ts';
import { acceptRequest, roomAccess, createRequestRoom } from '../src/utils/conversations.ts';
import type { Appointment, CurrentUser, FavoriteFriend, JoinRequest, MeetupPost, NotificationItem } from '../src/types.ts';

test('demo mode starts only with an explicit demo=1 query', () => {
  assert.equal(isDemoSearch('?demo=1'), true);
  assert.equal(isDemoSearch('?tab=me&demo=1'), true);
  for (const search of ['', '?demo', '?demo=0', '?demo=true', '?demo=11', '?mode=demo']) assert.equal(isDemoSearch(search), false);
});

test('demo clock shifts real time and converts Asia/Seoul input exactly', () => {
  const real = Date.parse('2026-09-15T03:00:00Z');
  assert.equal(demoNow(3_600_000, real).toISOString(), '2026-09-15T04:00:00.000Z');
  assert.equal(demoNow(Number.NaN, real).getTime(), real);
  assert.equal(fromKoreaInputValue('2026-09-15T15:00'), '2026-09-15T06:00:00.000Z');
  assert.equal(koreaInputValue(new Date('2026-09-15T06:00:00Z')), '2026-09-15T15:00');
  assert.equal(koreaInputValue(new Date('2026-09-15T15:30:00Z')), '2026-09-16T00:30');
  for (const value of ['', '2026-09-15', '2026-13-40T25:00', 'nope']) assert.equal(fromKoreaInputValue(value), null);
  assert.equal(offsetFor('2026-09-15T06:00:00.000Z', real), 3 * 3_600_000);
  assert.equal(offsetFor('invalid', real), null);
});

const newMember: CurrentUser = {
  id: 'user-new', isLoggedIn: true, phone: '01012345678', realName: '홍길동', maskedName: '홍*동', nickname: '홍*동',
  gender: 'female', ageGroup: '20대', neighborhood: '성동구 성수동', sugarContent: NEW_USER_SUGAR,
  isPhoneVerified: false, isKycVerified: false, avatar: 'new.png', bio: '새로 가입했어요', joinedAt: '방금',
  birthDate: '2000-01-02', email: 'hong@example.com', referralCode: 'CODE1', hobbies: ['전시'], traits: ['차분한'],
};

test('new members start at sugar 15 with no verification badge, shown the same from every entry point', () => {
  assert.equal(NEW_USER_SUGAR, 15);
  const viewer = demoAccounts()[1];
  const fromChat = publicProfileForMember({ id: newMember.id, displayName: '다른 이름', avatar: 'stale.png' }, viewer, [newMember]);
  const fromPost = publicProfileForPost({ id: 'p', authorId: newMember.id, author: '옛 이름', avatar: 'old.png' } as MeetupPost, viewer, [newMember]);
  const self = publicProfileForMember({ id: newMember.id, displayName: '', avatar: '' }, newMember);
  for (const profile of [fromChat, fromPost, self]) {
    assert.equal(profile.sugarContent, 15);
    assert.equal(profile.isPhoneVerified, false);
    assert.equal(profile.isKycVerified, false);
    assert.equal(profile.isSample, false);
    assert.equal(profile.displayName, '홍*동');
    assert.equal(profile.avatar, 'new.png');
    assert.deepEqual(profile.hobbies, ['전시']);
    assert.deepEqual(profile.reviews, []);
  }
  assert.deepEqual(fromChat, fromPost);
});

test('public profiles never include phone, real name, birth date, email or referral code', () => {
  const profile = publicProfileForMember({ id: newMember.id, displayName: '', avatar: '' }, null, [newMember]);
  const serialized = JSON.stringify(profile);
  for (const secret of ['01012345678', '홍길동', '2000-01-02', 'hong@example.com', 'CODE1']) assert.equal(serialized.includes(secret), false, secret);
  for (const key of ['phone', 'realName', 'birthDate', 'email', 'referralCode']) assert.equal(key in profile, false, key);
});

test('unknown users stay unverified with no sugar; sample accounts are labeled samples', () => {
  const unknown = publicProfileForMember({ id: 'nobody', displayName: '누구', avatar: '' }, null);
  assert.equal(unknown.sugarContent, null);
  assert.equal(unknown.isPhoneVerified, false);
  const sample = publicProfileForMember({ id: 'user-seojin', displayName: '서*진', avatar: '' }, null, demoAccounts());
  assert.equal(sample.isSample, true);
  assert.equal(sample.sugarContent, 81);
  const accounts = demoAccounts();
  assert.equal(new Set(accounts.map(item => item.id)).size, accounts.length);
  assert.ok(accounts.some(item => item.id === DEMO_USER_ID));
  assert.ok(accounts.every(item => item.isSample));
});

const appointment = (status: string, participantIds = ['host', 'guest']) =>
  ({ id: `apt-${status}`, postId: 'post', status, participantIds, scheduledAt: '2026-09-15T05:00:00Z', endsAt: '2026-09-15T06:00:00Z' }) as Appointment;

test('detailed location needs participation in a confirmed or completed meetup; closing a post reveals nothing', () => {
  for (const status of ['매칭 확정', '동행 완료']) {
    assert.equal(canViewSecretLocation('post', [appointment(status)], 'guest'), true);
    assert.equal(canViewSecretLocation('post', [appointment(status)], 'stranger'), false);
    assert.equal(canViewSecretLocation('other-post', [appointment(status)], 'guest'), false);
  }
  for (const status of ['동행 취소', '모집 마감']) assert.equal(canViewSecretLocation('post', [appointment(status)], 'guest'), false);
  assert.equal(canViewSecretLocation('post', [appointment('매칭 확정')], undefined), false);
  assert.equal(canUsePrivateArea(null), false);
  assert.equal(canUsePrivateArea({ isLoggedIn: false }), false);
  assert.equal(canUsePrivateArea({ isLoggedIn: true }), true);
});

test('addressed notifications are visible only to their recipient, including after logout', () => {
  const items = [
    { id: 'mine', recipientId: 'guest' }, { id: 'theirs', recipientId: 'host' }, { id: 'legacy' },
  ] as NotificationItem[];
  assert.deepEqual(visibleNotifications(items, 'guest').map(item => item.id), ['mine', 'legacy']);
  assert.deepEqual(visibleNotifications(items, undefined).map(item => item.id), ['legacy']);
});

test('stranger means not saved by the recipient AND never actually met', () => {
  const favorites: FavoriteFriend[] = [{ ownerId: 'recipient', targetId: 'saved', savedAt: '', notifyNewPosts: true }];
  const appointments = [
    appointment('동행 완료', ['recipient', 'met']),
    appointment('매칭 확정', ['recipient', 'confirmed-only']),
    appointment('매칭 확정', ['recipient', 'both-confirmed']),
    appointment('동행 완료', ['recipient', 'saved']),
  ];
  appointments[2].id = 'apt-both';
  const completions = [
    { appointmentId: 'apt-both', userId: 'recipient', confirmedAt: '' },
    { appointmentId: 'apt-both', userId: 'both-confirmed', confirmedAt: '' },
    { appointmentId: 'apt-매칭 확정', userId: 'recipient', confirmedAt: '' },
  ];
  const relation = (sender: string) => relationToSender('recipient', sender, favorites, appointments, completions);
  assert.deepEqual(relation('saved'), { isFavorite: true, hasMetBefore: true, isStranger: false });
  assert.deepEqual(relation('met'), { isFavorite: false, hasMetBefore: true, isStranger: false });
  assert.deepEqual(relation('both-confirmed'), { isFavorite: false, hasMetBefore: true, isStranger: false });
  assert.deepEqual(relation('confirmed-only'), { isFavorite: false, hasMetBefore: false, isStranger: true });
  assert.deepEqual(relation('nobody'), { isFavorite: false, hasMetBefore: false, isStranger: true });
  // Saving is one-way: the saved person does not gain a favorite relation back.
  assert.equal(relationToSender('saved', 'recipient', favorites, [], []).isFavorite, false);
  assert.equal(hasMetBefore('met', 'recipient', appointments), true);
  assert.equal(notificationSettingsFor([], 'recipient').strangerInvitations, true);
  assert.equal(notificationSettingsFor([{ userId: 'recipient', strangerInvitations: false }], 'recipient').strangerInvitations, false);
});

test('shifted demo time is honored by request access and host-only acceptance', () => {
  const post = { id: 'post', authorId: 'host', author: '작성자', avatar: '', title: '전시', status: 'recruiting',
    startsAt: '2026-09-18T06:00:00Z', endsAt: '2026-09-18T07:00:00Z', recruitmentEndsAt: '2026-09-17T06:00:00Z' } as MeetupPost;
  const request = { id: 'req', postId: 'post', hostId: 'host', requesterId: 'guest', requesterName: '신청자', requesterAvatar: '', message: '안녕하세요', status: 'pending' } as JoinRequest;
  const before = new Date('2026-09-16T00:00:00Z');
  const after = new Date('2026-09-17T06:00:00Z');
  const room = createRequestRoom(request, post);
  assert.equal(roomAccess(room, 'guest', [request], [], [post], before).canSend, true);
  assert.equal(roomAccess(room, 'guest', [request], [], [post], after).canSend, false);
  assert.equal(acceptRequest([request], post, 'req', 'guest', before), null, 'requester cannot accept');
  assert.equal(acceptRequest([request], post, 'req', 'host', after), null, 'deadline reached');
  assert.equal(acceptRequest([request], post, 'req', 'host', before)![0].status, 'accepted');
});
