import type { Appointment } from '../types.ts';
import { appointmentStart, formatSchedule, koreaDateKey } from './calendar.ts';

export const formatClock = (iso: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

export function isValidMeetupRange(startsAt?: string, endsAt?: string) {
  const start = Date.parse(startsAt || '');
  const end = Date.parse(endsAt || '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function formatMeetupRange(startsAt?: string, endsAt?: string, fallback = '일정 미정') {
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) return fallback;
  if (!isValidMeetupRange(startsAt, endsAt)) return `${formatSchedule(startsAt)} · 종료 시각 미정`;
  const end = koreaDateKey(new Date(startsAt)) === koreaDateKey(new Date(endsAt!))
    ? formatClock(endsAt!) : formatSchedule(endsAt!);
  return `${formatSchedule(startsAt)} ~ ${end}`;
}

/** End time is explicit: recruitment closure and the start time never unlock completion. */
export function completionAvailability(appointment: Appointment, userId: string | undefined, now = new Date()) {
  const locked = (reason: string) => ({ canComplete: false, canReview: false, reason });
  if (!userId) return locked('로그인 후 참여한 동행을 완료할 수 있어요.');
  if (!appointment.participantIds?.includes(userId)) return locked('이 동행의 참여자만 완료·평가할 수 있어요.');
  if (appointment.status === '동행 취소') return locked('취소된 동행은 완료·평가할 수 없어요. 이전 기록만 확인할 수 있습니다.');
  if (!['매칭 확정', '매칭완료', '동행 완료'].includes(appointment.status)) return locked('확정된 동행만 완료·평가할 수 있어요.');
  const start = appointmentStart(appointment);
  if (!Number.isFinite(start.getTime()) || !isValidMeetupRange(start.toISOString(), appointment.endsAt)) {
    return locked('공고의 종료 시각을 먼저 확인해 주세요.');
  }
  if (now.getTime() < Date.parse(appointment.endsAt!)) return locked(`${formatSchedule(appointment.endsAt!)}부터 완료·평가할 수 있어요.`);
  const completed = appointment.status === '동행 완료';
  return { canComplete: !completed, canReview: completed, reason: completed ? '완료한 동행의 평가를 남겨주세요.' : '공고 종료 시각이 지났어요. 동행 완료 후 평가할 수 있어요.' };
}
