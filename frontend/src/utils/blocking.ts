import type { Appointment, CompletionConfirmation } from '../types.ts';
import { isConfirmedAppointment } from './postLifecycle.ts';

export type BlockImpact =
  | { mode: 'proceed'; appointments: Appointment[] }
  | { mode: 'hold'; code: 'E2' | 'E3'; appointments: Appointment[]; reason: string };

/** Unresolved compound transitions remain a preview and never mutate lifecycle data. */
export function blockImpact(
  appointments: Appointment[],
  completions: CompletionConfirmation[],
  blockerId: string,
  blockedId: string,
): BlockImpact {
  const ongoing = appointments.filter(item => item.participantIds?.includes(blockerId)
    && item.participantIds.includes(blockedId) && isConfirmedAppointment(item));
  const oneSided = ongoing.filter(item => {
    const participantIds = new Set(item.participantIds || []);
    return new Set(completions.filter(entry => entry.appointmentId === item.id && participantIds.has(entry.userId)).map(entry => entry.userId)).size === 1;
  });
  if (oneSided.length) return {
    mode: 'hold', code: 'E2', appointments: oneSided,
    reason: '한쪽만 완료를 확인한 동행이 있어 평가·이력 처리 기준을 먼저 정해야 해요. 차단과 동행 상태 변경은 실행하지 않았습니다.',
  };
  if (ongoing.length > 1) return {
    mode: 'hold', code: 'E3', appointments: ongoing,
    reason: '같은 상대와 진행 중인 확정 동행이 여러 건이라 일괄 취소 범위를 먼저 정해야 해요. 차단과 동행 취소는 실행하지 않았습니다.',
  };
  return { mode: 'proceed', appointments: ongoing };
}

