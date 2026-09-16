import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPrototype,
  defaultDemoSettings,
  loadPrototype,
  MAX_INLINE_IMAGE_CHARS,
  OVERSIZED_IMAGE,
  savePrototype,
  STORAGE_KEYS,
  STORAGE_VERSION,
  type PrototypeData,
  type StorageLike,
} from '../src/utils/prototypeStore.ts';
import type { CurrentUser, JoinRequest, MeetupPost } from '../src/types.ts';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  quota = Infinity;
  getItem(key: string) { return this.values.has(key) ? this.values.get(key)! : null; }
  setItem(key: string, value: string) {
    if (value.length > this.quota) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

const user = { id: 'u1', isLoggedIn: true, maskedName: '김*수', avatar: 'a.png', sugarContent: 15 } as CurrentUser;
const data = (): PrototypeData => ({
  posts: [{ id: 'post', title: '전시', status: 'recruiting' } as MeetupPost],
  requests: [{ id: 'req', postId: 'post', status: 'pending' } as JoinRequest],
  rooms: [{ id: 'room-req', requestId: 'req', postId: 'post', postTitle: '전시', members: [], messages: [{ id: 'm', senderId: 'u1', text: '안녕하세요', createdAt: '2026-09-15T03:00:00.000Z' }], draft: '임시 메시지' }],
  appointments: [], notifications: [], reviews: [],
  favorites: [{ ownerId: 'u1', targetId: 'u2', savedAt: '2026-09-15T03:00:00.000Z', notifyNewPosts: true }],
  invitations: [{ id: 'inv', postId: 'post', senderId: 'u2', recipientId: 'u1', receivedAt: '2026-09-15T03:00:00.000Z', status: 'received' }],
  completions: [{ appointmentId: 'apt', userId: 'u1', confirmedAt: '2026-09-15T06:00:00.000Z' }],
  appointmentReviews: [], notificationSettings: [{ userId: 'u1', strangerInvitations: false }], blocks: [],
  users: [user], activeUserId: 'u1',
  demo: { ...defaultDemoSettings(), timeOffsetMs: 3_600_000, variants: { profile: 'B', postForm: 'A', review: 'B' } },
  ui: { activeTab: 'chat' },
});

test('save then load restores every shared record, the active role, time offset and A/B choice', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(savePrototype(storage, STORAGE_KEYS.demo, data()), { ok: true });
  const loaded = loadPrototype(storage, STORAGE_KEYS.demo);
  assert.equal(loaded.issue, undefined);
  assert.deepEqual(loaded.data, data());
  assert.equal(loaded.data!.rooms[0].draft, '임시 메시지');
  assert.equal(loaded.data!.notificationSettings[0].strangerInvitations, false);
});

test('empty storage is a normal first visit, not an error', () => {
  assert.deepEqual(loadPrototype(new MemoryStorage(), STORAGE_KEYS.demo), { data: null });
});

test('broken JSON, wrong shapes and other versions are reported without throwing', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEYS.demo, '{not json');
  assert.deepEqual(loadPrototype(storage, STORAGE_KEYS.demo), { data: null, issue: 'corrupt' });
  storage.setItem(STORAGE_KEYS.demo, JSON.stringify({ version: STORAGE_VERSION, data: { ...data(), posts: 'x' } }));
  assert.equal(loadPrototype(storage, STORAGE_KEYS.demo).issue, 'corrupt');
  storage.setItem(STORAGE_KEYS.demo, JSON.stringify({ version: STORAGE_VERSION, data: { ...data(), activeUserId: 'missing-user' } }));
  assert.equal(loadPrototype(storage, STORAGE_KEYS.demo).issue, 'corrupt');
  storage.setItem(STORAGE_KEYS.demo, JSON.stringify({ version: STORAGE_VERSION, data: { ...data(), demo: { timeOffsetMs: 0, variants: { profile: 'C', postForm: 'A', review: 'A' } } } }));
  assert.equal(loadPrototype(storage, STORAGE_KEYS.demo).issue, 'corrupt');
  storage.setItem(STORAGE_KEYS.demo, JSON.stringify({ version: STORAGE_VERSION + 1, data: data() }));
  assert.deepEqual(loadPrototype(storage, STORAGE_KEYS.demo), { data: null, issue: 'version' });
});

test('storage that throws on read or write is reported as unavailable', () => {
  const broken: StorageLike = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  assert.equal(loadPrototype(broken, STORAGE_KEYS.demo).issue, 'unavailable');
  assert.deepEqual(savePrototype(broken, STORAGE_KEYS.demo, data()), { ok: false, issue: 'unavailable' });
  assert.equal(loadPrototype(null, STORAGE_KEYS.demo).issue, 'unavailable');
});

test('quota errors keep the previous saved copy intact', () => {
  const storage = new MemoryStorage();
  savePrototype(storage, STORAGE_KEYS.demo, data());
  const before = storage.getItem(STORAGE_KEYS.demo);
  storage.quota = 10;
  const bigger = { ...data(), posts: [...data().posts, { id: 'post-2', title: '두번째', status: 'recruiting' } as MeetupPost] };
  assert.deepEqual(savePrototype(storage, STORAGE_KEYS.demo, bigger), { ok: false, issue: 'quota' });
  assert.equal(storage.getItem(STORAGE_KEYS.demo), before);
  assert.equal(loadPrototype(storage, STORAGE_KEYS.demo).data!.posts.length, 1);
});

test('large inline photo originals are never written; small ones and URLs are kept', () => {
  const storage = new MemoryStorage();
  const huge = 'data:image/png;base64,' + 'A'.repeat(MAX_INLINE_IMAGE_CHARS);
  const small = 'data:image/png;base64,AAAA';
  const withPhotos = { ...data(), users: [{ ...user, avatar: huge }, { ...user, id: 'u2', avatar: small }, { ...user, id: 'u3', avatar: 'https://example.com/a.jpg' }] };
  savePrototype(storage, STORAGE_KEYS.demo, withPhotos);
  assert.ok(storage.getItem(STORAGE_KEYS.demo)!.length < MAX_INLINE_IMAGE_CHARS);
  const avatars = loadPrototype(storage, STORAGE_KEYS.demo).data!.users.map(item => item.avatar);
  assert.deepEqual(avatars, [OVERSIZED_IMAGE, small, 'https://example.com/a.jpg']);
});

test('demo reset clears only the demo key and leaves ordinary app data untouched', () => {
  const storage = new MemoryStorage();
  savePrototype(storage, STORAGE_KEYS.demo, data());
  savePrototype(storage, STORAGE_KEYS.app, { ...data(), activeUserId: null });
  assert.notEqual(STORAGE_KEYS.demo, STORAGE_KEYS.app);
  assert.ok(STORAGE_KEYS.demo.endsWith(`v${STORAGE_VERSION}`));
  assert.equal(clearPrototype(storage, STORAGE_KEYS.demo), true);
  assert.deepEqual(loadPrototype(storage, STORAGE_KEYS.demo), { data: null });
  assert.equal(loadPrototype(storage, STORAGE_KEYS.app).data!.posts[0].id, 'post');
});
