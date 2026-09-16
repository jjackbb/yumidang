import type { NotificationItem } from '../types.ts';

export type NotificationFilter = 'all' | 'invitation' | 'matching' | 'chat' | 'event';

export const notificationFilterLabel: Record<NotificationFilter, string> = {
  all: '전체', invitation: '초대·관심친구', matching: '신청·동행', chat: '대화', event: '행사',
};

export function notificationGroup(item: NotificationItem): Exclude<NotificationFilter, 'all'> {
  if (item.type === 'invitation' || item.type === 'new_post') return 'invitation';
  if (item.type === 'chat') return 'chat';
  if (item.type === 'event') return 'event';
  return 'matching';
}

export function sortAndFilterNotifications(items: NotificationItem[], filter: NotificationFilter) {
  return items.map((item, index) => ({ item, index })).filter(({ item }) => filter === 'all' || notificationGroup(item) === filter)
    .sort((a, b) => {
      const left = Date.parse(a.item.createdAt || '');
      const right = Date.parse(b.item.createdAt || '');
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return right - left;
      if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(right) ? 1 : -1;
      return a.index - b.index;
    }).map(({ item }) => item);
}

