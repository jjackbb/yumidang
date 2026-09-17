import type { MeetupPost } from '../types.ts';
import { koreaDateKey } from './calendar.ts';

export type ExploreDateFilter = 'all' | 'today' | 'week' | 'date';
export type ExploreGenderFilter = 'all' | 'female' | 'male';
export type ExploreAgeFilter = 'all' | '20s' | '30s' | '40plus';
export interface ExploreFilters {
  category: string | null;
  region: string;
  date: ExploreDateFilter;
  /** `YYYY-MM-DD`, used with `date: 'date'`. */
  dateValue: string;
  query: string;
  /** Discovery preferences only. Server-side application eligibility remains separate. */
  gender: ExploreGenderFilter;
  age: ExploreAgeFilter;
}

export const EXPLORE_REGIONS = [
  { id: 'all', label: '전체 지역', keywords: [] as string[] },
  { id: 'seongdong', label: '성동구·성수', keywords: ['성동구', '성수'] },
  { id: 'gangnam', label: '강남구', keywords: ['강남구', '대치', '삼성동', '선정릉'] },
  { id: 'jongno', label: '종로구', keywords: ['종로구', '삼청', '소격', '안국'] },
  { id: 'yeongdeungpo', label: '영등포구·여의도', keywords: ['영등포', '여의도'] },
  { id: 'seocho', label: '서초구·반포', keywords: ['서초', '반포'] },
];
export const EXPLORE_DATE_LABELS: Record<ExploreDateFilter, string> = { all: '전체 날짜', today: '오늘', week: '7일 이내', date: '날짜 지정' };

export const emptyExploreFilters = (): ExploreFilters => ({ category: null, region: 'all', date: 'all', dateValue: '', query: '', gender: 'all', age: 'all' });

export const ageBand = (age: number | undefined) => !age || age < 20 ? '' : age < 30 ? '20대' : age < 40 ? '30대' : '40대 이상';

export const addDaysToKey = (key: string, days: number) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

/** Meetup start date in Korea; the date filter never uses the deadline or end time. */
const startKey = (post: MeetupPost) => post.startsAt && Number.isFinite(Date.parse(post.startsAt)) ? koreaDateKey(new Date(post.startsAt)) : null;

export function filterPosts(posts: MeetupPost[], filters: ExploreFilters, now: Date) {
  const today = koreaDateKey(now);
  const region = EXPLORE_REGIONS.find(item => item.id === filters.region);
  const query = filters.query.trim().toLowerCase();
  return posts.filter(post => {
    if (filters.category && post.category !== filters.category) return false;
    if (region && region.keywords.length) {
      const place = `${post.location} ${post.publicLocation || ''}`;
      if (!region.keywords.some(keyword => place.includes(keyword))) return false;
    }
    if (filters.date !== 'all' && !(filters.date === 'date' && !filters.dateValue)) {
      const key = startKey(post);
      if (!key) return false;
      if (filters.date === 'today' && key !== today) return false;
      if (filters.date === 'week' && (key < today || key > addDaysToKey(today, 6))) return false;
      if (filters.date === 'date' && key !== filters.dateValue) return false;
    }
    if (query && ![post.title, post.location, post.publicLocation || '', ...post.tags].some(value => value.toLowerCase().includes(query))) return false;
    if (filters.gender !== 'all' && post.authorGender !== filters.gender) return false;
    if (filters.age !== 'all') {
      const band = ageBand(post.authorAge);
      if ((filters.age === '20s' && band !== '20대') || (filters.age === '30s' && band !== '30대') || (filters.age === '40plus' && band !== '40대 이상')) return false;
    }
    return true;
  });
}

export function activeFilterLabels(filters: ExploreFilters) {
  const labels: string[] = [];
  if (filters.category) labels.push(filters.category);
  if (filters.region !== 'all') labels.push(EXPLORE_REGIONS.find(item => item.id === filters.region)?.label || filters.region);
  if (filters.date === 'date' && filters.dateValue) labels.push(filters.dateValue);
  else if (filters.date !== 'all' && filters.date !== 'date') labels.push(EXPLORE_DATE_LABELS[filters.date]);
  if (filters.query.trim()) labels.push(`“${filters.query.trim()}”`);
  if (filters.gender !== 'all') labels.push(filters.gender === 'female' ? '여성 작성자' : '남성 작성자');
  if (filters.age !== 'all') labels.push({ '20s': '20대 작성자', '30s': '30대 작성자', '40plus': '40대 이상 작성자' }[filters.age]);
  return labels;
}
