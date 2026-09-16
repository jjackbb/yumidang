import type { Appointment, EventBannerItem } from '../types.ts';

const DAY = 86_400_000;
export function koreaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const part = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}
export const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export function koreaDateKey(now = new Date()) {
  const { year, month, day } = koreaDateParts(now);
  return dateKey(year, month, day);
}
export const weekOfMonth = (day: number) => Math.ceil(day / 7);
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const weeksInMonth = (year: number, month: number) => weekOfMonth(daysInMonth(year, month));
export function eventsStartingInWeek(events: EventBannerItem[], year: number, month: number, week: number) {
  return events.filter(event => {
    const [y, m, d] = event.startsOn.split('-').map(Number);
    return y === year && m === month && weekOfMonth(d) === week;
  }).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}
export function eventStatus(event: Pick<EventBannerItem, 'startsOn' | 'endsOn'>, now = new Date()) {
  const today = koreaDateKey(now);
  return event.endsOn < today ? 'ended' : event.startsOn > today ? 'upcoming' : 'ongoing';
}
export const eventStatusLabel = { ended: '종료', upcoming: '시작 예정', ongoing: '진행 중' };
export const shortDate = (value: string) => value.split('-').slice(1).map(Number).join('.');
export function appointmentStart(appointment: Pick<Appointment, 'scheduledAt' | 'dateTime'>) {
  if (appointment.scheduledAt) return new Date(appointment.scheduledAt);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(appointment.dateTime)) return new Date(appointment.dateTime.replace(' ', 'T') + ':00+09:00');
  const match = appointment.dateTime.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\([^)]*\))?\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);
  if (!match) return new Date(NaN);
  const [, year, month, day, period, hour, minute] = match;
  const h = period ? Number(hour) % 12 + (period === '오후' ? 12 : 0) : Number(hour);
  return new Date(`${dateKey(+year, +month, +day)}T${String(h).padStart(2, '0')}:${minute}:00+09:00`);
}
export function daysUntil(start: Date, now = new Date()) {
  return Math.round((Date.parse(koreaDateKey(start)) - Date.parse(koreaDateKey(now))) / DAY);
}
export function upcomingReminders(appointments: Appointment[], now = new Date()) {
  return appointments.flatMap(appointment => {
    const startsAt = appointmentStart(appointment);
    if (!['매칭 확정', '매칭완료'].includes(appointment.status) || !Number.isFinite(startsAt.getTime()) || startsAt < now) return [];
    const days = daysUntil(startsAt, now);
    return days >= 0 && days <= 7 ? [{ appointment, days, startsAt }] : [];
  }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
export function demoSchedule(offset: number, hour = 14) {
  const { year, month, day } = koreaDateParts();
  const shifted = new Date(Date.UTC(year, month - 1, day + offset, hour - 9));
  return shifted.toISOString();
}
export const formatSchedule = (iso: string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));
