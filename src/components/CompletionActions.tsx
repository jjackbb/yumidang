import React from 'react';
import type { CompletionReviewState } from '../utils/reviews';

export interface CompletionActionsProps {
  state: CompletionReviewState;
  onComplete: () => void;
  onOpenReview: () => void;
}

export function CompletionActions({ state, onComplete, onOpenReview }: CompletionActionsProps) {
  const reviewLabel = state.reviewsReleased
    ? '공개된 후기 보기'
    : state.hasOwnReview
      ? '상대 평가 대기 중'
      : '평가 남기기';
  return <section aria-label="동행 완료와 평가" className="rounded-2xl bg-[#f7f4ff] p-3 space-y-2">
    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
      <span className={`rounded-full px-2 py-1 ${state.ownCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-500'}`}>내 완료 {state.ownCompleted ? '확인' : '대기'}</span>
      <span className={`rounded-full px-2 py-1 ${state.otherCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-500'}`}>상대 완료 {state.otherCompleted ? '확인' : '대기'}</span>
    </div>
    <p className="text-[11px] leading-relaxed text-gray-600" aria-live="polite">{state.reason}</p>
    <div className="grid grid-cols-2 gap-2">
      <button disabled={!state.canComplete} onClick={onComplete} className="rounded-xl bg-[#6c2cf5] text-white px-3 py-2.5 text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500">{state.ownCompleted ? '내 완료 확인됨' : '내 동행 완료 확인'}</button>
      <button disabled={!state.canReview && !state.reviewsReleased && !state.hasOwnReview} onClick={onOpenReview} className="rounded-xl bg-[#6c2cf5] text-white px-3 py-2.5 text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500">{reviewLabel}</button>
    </div>
  </section>;
}
