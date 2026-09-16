import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Star, Unlock, X } from 'lucide-react';
import type { ABVariant, Appointment, AppointmentReview } from '../types';
import type { CompletionReviewState, ReviewDraft } from '../utils/reviews';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  partnerName: string;
  variant: ABVariant;
  state: CompletionReviewState;
  ownReview?: AppointmentReview;
  partnerReview?: AppointmentReview;
  onSubmitReview: (review: ReviewDraft) => { ok: true } | { ok: false; error: string } | Promise<{ ok: true } | { ok: false; error: string }>;
}

const POSITIVE_ITEMS = ['시간 약속을 잘 지켜요', '친절하고 배려해요', '대화가 편안해요', '다시 동행하고 싶어요'];
const NEGATIVE_ITEMS = ['시간 약속이 아쉬워요', '대화가 불편했어요', '공고 내용과 달랐어요'];

const ReviewCard = ({ review, partnerName }: { review: AppointmentReview; partnerName: string }) => <div className="rounded-2xl bg-[#f8f9fc] p-4 space-y-2">
  <div className="flex items-center justify-between"><b className="text-sm">{partnerName}님이 남긴 후기</b><span className="flex items-center gap-1 text-xs font-bold text-amber-600"><Star size={14} className="fill-amber-400" />{review.rating}.0</span></div>
  <div className="flex flex-wrap gap-1.5">{review.positiveItems.map(item => <span key={item} className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-[#6c2cf5]">{item}</span>)}{review.negativeItems.map(item => <span key={item} className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">{item}</span>)}</div>
  <p className="text-xs leading-relaxed text-gray-700">{review.comment || '선택 한마디는 작성하지 않았어요.'}</p>
</div>;

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, appointment, partnerName, variant, state, ownReview, partnerReview, onSubmitReview }) => {
  const [rating, setRating] = useState(5);
  const [positiveItems, setPositiveItems] = useState<string[]>([]);
  const [negativeItems, setNegativeItems] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');

  useEffect(() => { setRating(5); setPositiveItems([]); setNegativeItems([]); setComment(''); setStep(1); setError(''); }, [appointment.id, variant]);
  if (!isOpen) return null;

  const toggle = (item: string, items: string[], setItems: React.Dispatch<React.SetStateAction<string[]>>) => {
    setItems(items.includes(item) ? items.filter(value => value !== item) : [...items, item]);
    setError('');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await onSubmitReview({ rating, positiveItems, negativeItems, comment });
    if ('error' in result) setError(result.error);
  };
  const deadline = state.reviewDeadline ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(state.reviewDeadline)) : '';
  const showDetails = variant === 'A' || step === 2;

  return <div role="dialog" aria-modal="true" aria-label="동행 평가" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
    <div className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto text-left shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between bg-white/95 px-5 py-4 shadow-xs backdrop-blur-md">
        <div><div className="flex items-center gap-2"><h2 className="font-bold">동행 평가</h2><span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">체험 설정 · 07 {variant}안</span></div><p className="mt-1 text-[11px] text-gray-500">{appointment.title}</p></div>
        <button type="button" onClick={onClose} aria-label="평가창 닫기" className="p-1 text-gray-500"><X size={19} /></button>
      </header>

      {state.reviewsReleased && partnerReview ? <div className="p-5 space-y-4">
        <div className="rounded-2xl bg-emerald-50 p-4 text-center"><Unlock className="mx-auto text-emerald-600" /><h3 className="mt-2 font-bold">양쪽 평가가 공개됐어요</h3><p className="mt-1 text-xs text-gray-600">내 평가를 제출했고 상대 평가도 도착해 서로에게 동시에 공개됐어요.</p></div>
        <ReviewCard review={partnerReview} partnerName={partnerName} />
        <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900"><b>당도 계산은 아직 논의 중</b><br />합산 방식·하한·갱신 시점을 확정한 뒤 적용합니다. 이 평가로 점수를 자동 변경하지 않았어요.</div>
        <button type="button" onClick={onClose} className="w-full rounded-xl bg-[#6c2cf5] py-3 text-sm font-bold text-white">닫기</button>
      </div> : ownReview ? <div className="p-7 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 text-[#6c2cf5]"><Lock size={28} /></div>
        <div><h3 className="font-bold">내 평가를 제출했어요</h3><p className="mt-2 text-xs leading-relaxed text-gray-500">상대가 평가를 제출할 때까지 양쪽 후기는 비공개예요. 7일 뒤에도 자동 공개되지 않습니다.</p></div>
        <div className="rounded-2xl bg-gray-50 p-4 text-left text-xs"><p className="flex items-center justify-between"><span>내 평가</span><b className="text-emerald-600">제출 완료</b></p><p className="mt-2 flex items-center justify-between"><span>상대 평가</span><b className="text-amber-600">제출 대기</b></p></div>
        <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold">닫기</button>
      </div> : !state.canReview ? <div className="p-7 text-center space-y-4"><Lock className="mx-auto text-gray-400" /><h3 className="font-bold">지금은 평가할 수 없어요</h3><p className="text-xs leading-relaxed text-gray-500">{state.reason}</p><button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold">닫기</button></div> : <form onSubmit={submit} className="p-5 space-y-5">
        <div className="rounded-2xl bg-purple-50 p-3 text-xs leading-relaxed text-purple-950"><b className="flex items-center gap-1"><Lock size={14} />상호 블라인드 평가</b><p className="mt-1">내 평가 제출 뒤 상대 평가가 있어야 서로에게 공개돼요. 상대 완료 확인은 기다리지 않아도 됩니다.</p>{deadline && <p className="mt-1 text-purple-700">작성 기한: {deadline} 직전까지</p>}</div>
        {variant === 'B' && <div aria-label="평가 단계" className="grid grid-cols-2 gap-2 text-[11px] font-bold"><span className={`rounded-full px-3 py-2 text-center ${step === 1 ? 'bg-[#6c2cf5] text-white' : 'bg-emerald-100 text-emerald-700'}`}>1 별점</span><span className={`rounded-full px-3 py-2 text-center ${step === 2 ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-500'}`}>2 후기</span></div>}
        <section className="text-center"><p className="text-sm font-bold">이번 동행은 어떠셨나요?</p><div className="mt-2 flex justify-center gap-2">{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value}점`} onClick={() => { setRating(value); setError(''); }}><Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} /></button>)}</div></section>
        {variant === 'B' && step === 1 && <button type="button" onClick={() => setStep(2)} className="w-full rounded-xl bg-[#6c2cf5] py-3 text-sm font-bold text-white">후기 선택으로</button>}
        {showDetails && <>
          <fieldset><legend className="text-xs font-bold">좋았던 점</legend><div className="mt-2 flex flex-wrap gap-2">{POSITIVE_ITEMS.map(item => <button type="button" key={item} aria-pressed={positiveItems.includes(item)} onClick={() => toggle(item, positiveItems, setPositiveItems)} className={`rounded-full px-3 py-2 text-xs ${positiveItems.includes(item) ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-600'}`}>{item}</button>)}</div></fieldset>
          <fieldset><legend className="text-xs font-bold">아쉬웠던 점</legend><div className="mt-2 flex flex-wrap gap-2">{NEGATIVE_ITEMS.map(item => <button type="button" key={item} aria-pressed={negativeItems.includes(item)} onClick={() => toggle(item, negativeItems, setNegativeItems)} className={`rounded-full px-3 py-2 text-xs ${negativeItems.includes(item) ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{item}</button>)}</div></fieldset>
          <label className="block text-xs font-bold">선택 한마디 <span className="font-normal text-gray-400">(선택, 300자)</span><textarea value={comment} maxLength={300} onChange={event => { setComment(event.target.value); setError(''); }} rows={3} className="mt-2 w-full resize-none rounded-xl border border-gray-200 p-3 font-normal" placeholder="상대에게 전할 말을 남겨주세요." /></label>
          <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">제출 후 수정할 수 없는 체험 흐름이에요. 당도 합산·하한·갱신 시점은 논의가 필요해 자동 반영하지 않습니다.</div>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6c2cf5] py-3.5 text-sm font-bold text-white"><CheckCircle2 size={17} />평가 제출하기</button>
        </>}
      </form>}
    </div>
  </div>;
};
