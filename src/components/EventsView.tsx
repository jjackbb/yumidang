import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EventBannerItem } from '../types';
import { eventsStartingInWeek, koreaDateParts, weekOfMonth, weeksInMonth, daysInMonth } from '../utils/calendar';
import { sampleEventsForMonth } from '../data/events';
import { EventCarousel } from './EventCarousel';

export function EventsView({ now, onClose, onSelectEvent }: { now: Date; onClose: () => void; onSelectEvent: (event: EventBannerItem) => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  const today = koreaDateParts(now);
  const [month, setMonth] = useState({ year: today.year, month: today.month });
  const [week, setWeek] = useState(weekOfMonth(today.day));
  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(month.year, month.month - 1 + offset, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
    setWeek(1);
  };
  const events = eventsStartingInWeek(sampleEventsForMonth(month.year, month.month), month.year, month.month, week);
  return <div role="dialog" aria-modal="true" aria-label="이벤트 전체보기" className="fixed inset-0 z-40 mx-auto max-w-[440px] bg-white overflow-y-auto pb-10">
    <header className="h-16 flex items-center gap-3 px-4 border-b border-gray-100">
      <button aria-label="이벤트 전체보기 닫기" onClick={onClose} className="p-2"><ArrowLeft size={22} /></button>
      <h1 className="text-lg font-bold">주차별 이벤트</h1>
    </header>
    <div className="px-5 pt-6">
      <div className="flex items-center justify-between mb-5">
        <button aria-label="이전 달" onClick={() => changeMonth(-1)} className="p-2 rounded-full bg-gray-50"><ChevronLeft size={20} /></button>
        <h2 className="font-bold text-xl">{month.year}년 {month.month}월</h2>
        <button aria-label="다음 달" onClick={() => changeMonth(1)} className="p-2 rounded-full bg-gray-50"><ChevronRight size={20} /></button>
      </div>
      <div role="tablist" aria-label="이벤트 시작 주차" className="flex gap-2 mb-6">
        {Array.from({ length: weeksInMonth(month.year, month.month) }, (_, i) => i + 1).map(w => <button key={w} role="tab" aria-selected={week === w} onClick={() => setWeek(w)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${week === w ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-500'}`}>{w}주차</button>)}
      </div>
      <h3 className="font-bold text-lg mb-1">{month.month}월 {week}주차에 시작하는 행사</h3>
      <p className="text-xs text-gray-500 mb-4">{month.month}.{(week - 1) * 7 + 1}–{month.month}.{Math.min(week * 7, daysInMonth(month.year, month.month))} 시작 · {events.length}개</p>
      <EventCarousel events={events} now={now} onSelectEvent={onSelectEvent} carouselKey={`${month.year}-${month.month}-${week}`} />
      <p className="text-xs text-gray-500 mt-5 leading-relaxed">행사가 시작한 주차에서 찾아보세요. 종료된 행사도 회색 카드로 확인할 수 있어요.</p>
      <p className="mt-6 text-[11px] text-gray-400">프로토타입 예시 행사 · 실제 일정과 다릅니다</p>
    </div>
  </div>;
}
