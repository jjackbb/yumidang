import React from 'react';
import type { EventBannerItem } from '../types';
import { eventStatus, eventStatusLabel, shortDate } from '../utils/calendar';
import { CarouselBar, useCarousel } from './CarouselBar';

export function EventCarousel({ events, onSelectEvent, now, carouselKey }: {
  events: EventBannerItem[]; onSelectEvent: (event: EventBannerItem) => void; now: Date; carouselKey: string;
}) {
  const { ref, index, onScroll } = useCarousel(carouselKey);
  if (!events.length) return <div className="rounded-3xl bg-gray-50 px-5 py-14 text-center text-sm text-gray-500">이 주차에 시작하는 행사가 없어요.</div>;
  return <>
    <div ref={ref} onScroll={onScroll} data-testid="event-carousel" aria-label="행사 목록" className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
      {events.map(event => {
        const status = eventStatus(event, now);
        return <button key={event.id} onClick={() => onSelectEvent(event)} data-event-id={event.id} data-status={status}
          className={`relative shrink-0 snap-start basis-[calc(100%-20px)] min-h-[250px] rounded-[22px] overflow-hidden text-left bg-gray-800 ${status === 'ended' ? 'grayscale opacity-60' : ''}`}>
          <img src={event.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
          <div className="absolute top-4 inset-x-4 flex justify-between gap-2">
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-gray-900">{event.kind}</span>
            <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${status === 'ended' ? 'bg-gray-700 text-white' : 'bg-[#6c2cf5] text-white'}`}>{eventStatusLabel[status]}</span>
          </div>
          <div className="relative pt-28 p-5 text-white">
            <p className="text-xs text-white/85 mb-2">{shortDate(event.startsOn)}–{shortDate(event.endsOn)} · {event.tag}</p>
            <h3 className="text-xl font-bold leading-snug">{event.title}</h3>
            <p className="text-xs text-white/80 mt-2">{event.subtitle}</p>
          </div>
        </button>;
      })}
    </div>
    <CarouselBar count={events.length} index={index} label="이벤트 배너 위치" />
  </>;
}
