import React from 'react';
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import type { Appointment } from '../types';
import { upcomingReminders } from '../utils/calendar';
import { CarouselBar, useCarousel } from './CarouselBar';

export function AppointmentReminders({ appointments, now, onOpenDashboard }: {
  appointments: Appointment[]; now: Date; onOpenDashboard: (appointment: Appointment) => void;
}) {
  const reminders = upcomingReminders(appointments, now);
  const { ref, index, onScroll } = useCarousel(reminders.map(r => r.appointment.id).join(','));
  if (!reminders.length) return null;
  return <section aria-label="다가오는 확정 동행" className="px-5 py-3">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold">곧 만나는 동행 <span className="text-[#6c2cf5]">{reminders.length}</span></h2>
      <span className="text-xs text-gray-400">7일 이내 약속</span>
    </div>
    <div ref={ref} onScroll={onScroll} data-testid="appointment-carousel" className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none">
      {reminders.map(({ appointment, days }) => <button key={appointment.id} data-appointment-id={appointment.id} onClick={() => onOpenDashboard(appointment)} className="basis-[calc(100%-20px)] shrink-0 snap-start text-left rounded-[22px] border border-purple-100 bg-[#f8f6ff] p-4">
        <div className="flex justify-between items-center mb-3"><span className="text-xs text-[#6c2cf5] font-bold">매칭 확정</span><span className="bg-[#6c2cf5] text-white font-bold text-xs rounded-full px-3 py-1">{days === 0 ? 'D-day' : `D-${days}`}</span></div>
        <h3 className="font-bold text-[16px] leading-snug mb-3">{appointment.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-gray-600 mb-2"><CalendarDays size={14} className="shrink-0" />{appointment.dateTime}</p>
        <p className="flex items-center gap-1.5 text-xs text-gray-600"><MapPin size={14} className="shrink-0" />{appointment.location}</p>
        <p className="flex justify-end items-center text-xs text-[#6c2cf5] font-semibold mt-4">약속 확인<ChevronRight size={15} /></p>
      </button>)}
    </div>
    {reminders.length > 1 && <CarouselBar count={reminders.length} index={index} label="확정 동행 위치" />}
  </section>;
}
