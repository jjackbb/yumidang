import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { EventBannerItem } from '../types';
import { eventsStartingInWeek, koreaDateParts, weekOfMonth } from '../utils/calendar';
import { EventCarousel } from './EventCarousel';

export function EventBanner({ events, now, onSelectEvent, onViewAllEvents }: {
  events: EventBannerItem[]; now: Date; onSelectEvent: (event: EventBannerItem) => void; onViewAllEvents: () => void;
}) {
  const { year, month, day } = koreaDateParts(now);
  const week = weekOfMonth(day);
  const currentEvents = eventsStartingInWeek(events, year, month, week);
  return <section className="px-5 pt-3 pb-5">
    <div className="flex items-center justify-between gap-2 mb-3.5">
      <h2 className="flex items-center gap-1.5 text-[17px] font-bold tracking-tight"><Sparkles size={18} className="text-[#8b5cf6] shrink-0" />{month}월 {week}주차 이벤트</h2>
      <button id="btn-view-all-events" onClick={onViewAllEvents} className="text-xs text-gray-500 font-medium flex items-center shrink-0">전체보기<ChevronRight size={15} /></button>
    </div>
    <EventCarousel events={currentEvents} now={now} onSelectEvent={onSelectEvent} carouselKey={`${year}-${month}-${week}`} />
    <p className="mt-2 text-[10px] text-gray-400">프로토타입 예시 행사 · 해당 주차에 시작하는 행사</p>
  </section>;
}
