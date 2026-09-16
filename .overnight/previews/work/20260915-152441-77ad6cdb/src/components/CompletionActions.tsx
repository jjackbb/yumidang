import React from 'react';

export interface CompletionActionsProps {
  availability: { canComplete: boolean; canReview: boolean; reason: string };
  isCompleted: boolean;
  hasSubmittedReview: boolean;
  onComplete: () => void;
  onOpenReview: () => void;
}

export function CompletionActions({ availability, isCompleted, hasSubmittedReview, onComplete, onOpenReview }: CompletionActionsProps) {
  return <section aria-label="동행 완료와 평가" className="rounded-2xl bg-[#f7f4ff] p-3 space-y-2">
    <p className="text-[11px] leading-relaxed text-gray-600" aria-live="polite">{availability.reason}</p>
    <div className="grid grid-cols-2 gap-2">
      <button disabled={!availability.canComplete} onClick={onComplete} className="rounded-xl bg-[#6c2cf5] text-white px-3 py-2.5 text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500">{isCompleted ? '동행 완료됨' : '동행 완료 처리'}</button>
      <button disabled={!availability.canReview} onClick={onOpenReview} className="rounded-xl bg-[#6c2cf5] text-white px-3 py-2.5 text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500">{hasSubmittedReview ? '제출한 평가 확인' : '평가 남기기'}</button>
    </div>
  </section>;
}
