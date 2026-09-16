import type {
  Appointment,
  AppointmentReview,
  BlockRelation,
  ChatRoom,
  CompletionConfirmation,
  CurrentUser,
  DemoSettings,
  FavoriteFriend,
  Invitation,
  JoinRequest,
  MeetupPost,
  NotificationItem,
  NotificationSettings,
  ReviewItem,
} from '../types.ts';

// Prototype persistence only (localStorage). Not a server database.
export const STORAGE_VERSION = 1;
export const STORAGE_KEYS = {
  demo: `yumidang:demo:v${STORAGE_VERSION}`,
  app: `yumidang:app:v${STORAGE_VERSION}`,
} as const;
/** Photo originals (up to 10MB) must not be written to localStorage as-is. */
export const MAX_INLINE_IMAGE_CHARS = 300_000;
export const OVERSIZED_IMAGE = 'yumidang:image-too-large';

export type StorageIssue = 'corrupt' | 'version' | 'unavailable' | 'quota';
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PrototypeData {
  posts: MeetupPost[];
  requests: JoinRequest[];
  rooms: ChatRoom[];
  appointments: Appointment[];
  notifications: NotificationItem[];
  reviews: ReviewItem[];
  favorites: FavoriteFriend[];
  invitations: Invitation[];
  completions: CompletionConfirmation[];
  appointmentReviews: AppointmentReview[];
  notificationSettings: NotificationSettings[];
  blocks: BlockRelation[];
  /** Demo accounts sharing this browser; role switching changes `activeUserId` only. */
  users: CurrentUser[];
  activeUserId: string | null;
  demo: DemoSettings;
  ui: { activeTab: string };
}

export const defaultDemoSettings = (): DemoSettings => ({
  timeOffsetMs: 0,
  variants: { profile: 'A', postForm: 'A', review: 'A' },
});

const ARRAY_FIELDS = [
  'posts', 'requests', 'rooms', 'appointments', 'notifications', 'reviews', 'favorites',
  'invitations', 'completions', 'appointmentReviews', 'notificationSettings', 'blocks', 'users',
] as const;
const isVariant = (value: unknown) => value === 'A' || value === 'B';

export function isPrototypeData(value: unknown): value is PrototypeData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, any>;
  if (!ARRAY_FIELDS.every(field => Array.isArray(data[field]))) return false;
  if (data.activeUserId !== null && typeof data.activeUserId !== 'string') return false;
  if (data.activeUserId && !data.users.some((user: CurrentUser) => user?.id === data.activeUserId)) return false;
  const demo = data.demo;
  if (!demo || !Number.isFinite(demo.timeOffsetMs) || !demo.variants) return false;
  if (!['profile', 'postForm', 'review'].every(key => isVariant(demo.variants[key]))) return false;
  return Boolean(data.ui && typeof data.ui.activeTab === 'string');
}

/** Replace inline images too large for prototype storage; the UI asks to re-register them. */
export function stripOversizedImages<T>(value: T): T {
  if (typeof value === 'string')
    return (value.startsWith('data:') && value.length > MAX_INLINE_IMAGE_CHARS ? OVERSIZED_IMAGE : value) as T;
  if (Array.isArray(value)) return value.map(stripOversizedImages) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stripOversizedImages(item)])) as T;
  return value;
}

export function loadPrototype(storage: StorageLike | null, key: string): { data: PrototypeData | null; issue?: StorageIssue } {
  if (!storage) return { data: null, issue: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { data: null, issue: 'unavailable' };
  }
  if (raw === null) return { data: null };
  try {
    const envelope = JSON.parse(raw);
    if (!envelope || envelope.version !== STORAGE_VERSION) return { data: null, issue: 'version' };
    return isPrototypeData(envelope.data) ? { data: envelope.data } : { data: null, issue: 'corrupt' };
  } catch {
    return { data: null, issue: 'corrupt' };
  }
}

const isQuotaError = (error: any) =>
  error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22;

export function savePrototype(storage: StorageLike | null, key: string, data: PrototypeData, now = new Date()): { ok: true } | { ok: false; issue: StorageIssue } {
  if (!storage) return { ok: false, issue: 'unavailable' };
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, savedAt: now.toISOString(), data: stripOversizedImages(data) }));
    return { ok: true };
  } catch (error) {
    return { ok: false, issue: isQuotaError(error) ? 'quota' : 'unavailable' };
  }
}

/** Only removes the given key: resetting the demo never touches ordinary app data. */
export function clearPrototype(storage: StorageLike | null, key: string) {
  try {
    storage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const storageIssueMessage: Record<StorageIssue, string> = {
  corrupt: '저장된 체험 기록을 읽지 못했어요. 현재 화면은 예시 데이터로 계속 쓸 수 있고, 다시 시도하거나 초기화할 수 있어요.',
  version: '이전 버전의 체험 기록이라 불러오지 않았어요. 다시 시도하거나 초기화해 주세요.',
  unavailable: '브라우저 저장소를 사용할 수 없어 새로고침하면 변경 내용이 사라질 수 있어요.',
  quota: '저장 공간이 부족해 최근 변경을 저장하지 못했어요. 현재 화면은 유지돼요. 다시 시도하거나 초기화해 주세요.',
};
