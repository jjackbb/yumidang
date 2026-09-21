import { useState } from 'react';
import { X, CalendarClock, AlertCircle } from 'lucide-react';
import type { Appointment } from '../types';

export function LifecycleConfirmDialog({
  title,
  description,
  actionLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] bg-black/55 flex items-center justify-center p-5"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4">
        <AlertCircle className="text-amber-600" />
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 rounded-xl py-3 text-sm"
          >
            돌아가기
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#6c2cf5] text-white rounded-xl py-3 text-sm font-bold"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CancellationDialog({
  kind,
  title,
  onClose,
  onConfirm,
}: {
  kind: 'request' | 'appointment';
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => boolean;
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const label = kind === 'appointment' ? '확정 동행 취소' : '신청 취소';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[80] bg-black/55 flex items-center justify-center p-5"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = reason === '기타' ? details.trim() : reason;
          if (!value) {
            setError('취소 사유를 선택하거나 입력해 주세요.');
            return;
          }
          if (!onConfirm(value))
            setError(
              '현재 상태에서는 취소할 수 없어요. 최신 동행 상태를 확인해 주세요.',
            );
        }}
        className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{label}</h2>
          <button type="button" onClick={onClose} aria-label="취소 화면 닫기">
            <X size={20} />
          </button>
        </header>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-gray-600 leading-relaxed">
          취소하면 사유가 대화방과 알림에 표시돼요. 이전 대화는 남지만 새
          메시지는 보낼 수 없습니다.
        </p>
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold mb-2">취소 사유</legend>
          {[
            '일정이 변경됐어요',
            '개인 사정이 생겼어요',
            '조건이 맞지 않아요',
            '기타',
          ].map((value) => (
            <label
              key={value}
              className="flex gap-2 items-center rounded-xl border border-gray-100 p-3 text-xs"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                  setError('');
                }}
              />
              {value}
            </label>
          ))}
        </fieldset>
        {reason === '기타' && (
          <textarea
            aria-label="취소 사유 직접 입력"
            maxLength={300}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="w-full bg-gray-50 p-3 text-sm rounded-xl"
          />
        )}
        <p className="text-[10px] text-gray-500">
          취소에 따른 당도·이용 제한 정책은 준비 중입니다. 이 시연에서는 점수가
          변하지 않아요.
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 py-3 rounded-xl text-sm"
          >
            유지하기
          </button>
          <button
            type="submit"
            className="flex-1 bg-[#6c2cf5] text-white py-3 rounded-xl text-sm font-bold"
          >
            {label}하기
          </button>
        </div>
      </form>
    </div>
  );
}

export function ScheduleConflictDialog({
  conflicts,
  onClose,
  onContinue,
}: {
  conflicts: Appointment[];
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="일정 중복 안내"
      className="fixed inset-0 z-[90] bg-black/55 flex items-center justify-center p-5"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
        <CalendarClock className="text-amber-600" />
        <h2 className="text-lg font-bold">겹치는 확정 일정이 있어요</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          기존 동행의 시간과 일부 겹칩니다. 시간을 확인하고 진행 여부를 선택해
          주세요. 기존 약속이 자동으로 취소되지는 않아요.
        </p>
        {conflicts.map((item) => (
          <div key={item.id} className="bg-amber-50 rounded-xl p-3 text-xs">
            <b>{item.title}</b>
            <p className="mt-1 text-gray-600">{item.dateTime}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 py-3 rounded-xl text-xs"
          >
            돌아가서 확인
          </button>
          <button
            onClick={onContinue}
            className="flex-1 bg-[#6c2cf5] text-white py-3 rounded-xl text-xs font-bold"
          >
            확인했어요 · 계속 진행
          </button>
        </div>
      </div>
    </div>
  );
}
