import type { EventBannerItem } from '../types.ts';
import { dateKey, daysInMonth, weeksInMonth } from '../utils/calendar.ts';

/** Finds an example event by its id (`sample-YYYY-M-week-index`), whatever month it belongs to. */
export function eventById(id: string | undefined): EventBannerItem | undefined {
  const match = id?.match(/^sample-(\d{4})-(\d{1,2})-\d+-\d+$/);
  return match ? sampleEventsForMonth(Number(match[1]), Number(match[2])).find(event => event.id === id) : undefined;
}

// Example records only. A future collector can supply this same date-based contract.
export function sampleEventsForMonth(year: number, month: number): EventBannerItem[] {
  const kinds: EventBannerItem['kind'][] = ['팝업', '전시', '축제', '공연'];
  const names = ['취향을 만나는 라이프스타일 팝업', '색과 빛으로 떠나는 전시 산책', '동네에서 즐기는 작은 가을 축제', '저녁을 채우는 라이브 공연'];
  const photos = ['photo-1441986300917-64674bd600d8', 'photo-1579783900882-c0d3dad7b119', 'photo-1511795409834-ef04bbd61622', 'photo-1511671782779-c97d3d27a1d4'];
  const places = ['성수동', '삼청동', '한강공원', '홍대'];
  const lastDay = daysInMonth(year, month);
  return Array.from({ length: weeksInMonth(year, month) }, (_, i) => i + 1).flatMap(week =>
    [0, 1, 2, 3].map(index => {
      const kind = (week + index - 1) % kinds.length;
      const start = Math.min((week - 1) * 7 + 1 + index, lastDay);
      const end = index === 0 ? lastDay : Math.min(start + (index === 1 ? 1 : 8), lastDay);
      return {
        id: `sample-${year}-${month}-${week}-${index}`, badge: kinds[kind], subBadge: `${month}월 ${week}주차 시작`,
        title: names[kind], subtitle: '취향이 맞는 동행과 함께 둘러보세요',
        imageUrl: `https://images.unsplash.com/${photos[kind]}?auto=format&fit=crop&w=1000&q=80`,
        tag: places[kind], startsOn: dateKey(year, month, start), endsOn: dateKey(year, month, end),
        kind: kinds[kind], description: '주차별 행사 탐색을 체험하기 위한 예시 행사입니다. 실제 행사 일정이나 예약 정보가 아닙니다.',
        sourceType: 'sample' as const,
      };
    })
  );
}
