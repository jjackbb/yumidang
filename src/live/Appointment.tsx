import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Star } from 'lucide-react';
import { liveApi, type AppointmentState, type ReviewState } from './api';
import { formatDateTime, formatRange } from './format';
import { useRealtime, usePolling } from './realtime';
import { ErrorBox, Notice, PrimaryButton, StatusChip } from './ui';

function completionLabel(state: AppointmentState) {
  if (state.status === 'completed') return '동행 완료';
  if (state.my_completion_at && !state.peer_completion_at) return '내 완료 확인됨 · 상대 확인 대기';
  if (!state.my_completion_at && state.peer_completion_at) return '상대 완료 확인됨 · 내 확인 필요';
  return '동행 완료 확인 전';
}

export function AppointmentPanel({ appointmentId }: { appointmentId: string }) {
  const [state, setState] = useState<AppointmentState | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [exactLocation, setExactLocation] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [next, nextReview] = await Promise.all([liveApi.appointmentState(appointmentId), liveApi.reviewState(appointmentId)]);
      setState(next); setReview(nextReview);
      if (next) setExactLocation(await liveApi.exactLocation(next.post_id));
      setError('');
    } catch (err: any) { setError(err.message); }
  }, [appointmentId]);
  useEffect(() => { void load(); }, [load]);
  useRealtime(`appointment:${appointmentId}`, [
    { table: 'appointment_completion_confirmations', event: 'INSERT', filter: `appointment_id=eq.${appointmentId}`, onChange: () => void load() },
    { table: 'appointments', event: 'UPDATE', filter: `id=eq.${appointmentId}`, onChange: () => void load() },
  ], () => void load());
  // Review rows are never streamed; the blind state is re-read through the safe RPC.
  usePolling(() => void load(), 5000, !review?.released);

  const confirmCompletion = async () => {
    setBusy(true);
    try { await liveApi.confirmCompletion(appointmentId); await load(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  if (!state) return <section aria-label="확정된 동행" className="p-4">{error ? <ErrorBox message={error} onRetry={() => void load()} /> : <p className="text-xs text-gray-500">동행 정보를 불러오는 중…</p>}</section>;

  return <section aria-label="확정된 동행" className="m-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
    <div className="flex items-center gap-2"><StatusChip tone="green">확정된 동행</StatusChip><StatusChip tone={state.status === 'completed' ? 'green' : 'amber'}><span data-testid="completion-status">{completionLabel(state)}</span></StatusChip></div>
    <p className="text-sm font-bold">{state.post_title}</p>
    <p className="text-xs text-gray-600">{formatRange(state.post_starts_at, state.post_ends_at)} · {state.post_public_area}</p>
    {exactLocation && <p data-testid="appointment-exact-location" className="text-sm flex items-center gap-1"><MapPin className="w-4 h-4 text-emerald-700" />{exactLocation}</p>}
    {error && <ErrorBox message={error} onRetry={() => void load()} />}

    {!state.my_completion_at && <div className="space-y-1.5">
      <PrimaryButton disabled={busy || !state.can_confirm_completion} onClick={() => void confirmCompletion()}>{busy ? '확인 중…' : '내 동행 완료 확인'}</PrimaryButton>
      <p className="text-[11px] text-gray-500">{state.can_confirm_completion ? '완료 확인은 취소할 수 없어요.' : `${formatDateTime(state.post_ends_at)}부터 완료할 수 있어요. (서버 시각 기준)`}</p>
    </div>}
    {state.my_completion_at && <p className="text-xs text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />내 완료 확인 {formatDateTime(state.my_completion_at)}</p>}

    {review && <ReviewBlock appointmentId={appointmentId} review={review} counterpart={state.counterpart_masked_name} onSubmitted={setReview} />}
  </section>;
}

function Stars({ value }: { value: number }) {
  return <span aria-label={`별점 ${value}점`} className="inline-flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`w-4 h-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />)}</span>;
}

function ReviewBlock({ appointmentId, review, counterpart, onSubmitted }: { appointmentId: string; review: ReviewState; counterpart: string; onSubmitted: (state: ReviewState) => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const expired = Date.parse(review.server_now) >= Date.parse(review.deadline_at);

  const submit = async () => {
    setBusy(true); setError('');
    try { onSubmitted(await liveApi.submitReview(appointmentId, rating, comment)); setConfirming(false); }
    catch (err: any) { setError(err.message); setConfirming(false); }
    finally { setBusy(false); }
  };

  return <div aria-label="상호 평가" role="region" className="rounded-xl bg-white border border-gray-100 p-3 space-y-2">
    <p className="text-xs font-bold">{counterpart}님과의 블라인드 상호 평가 <span className="font-normal text-gray-400">· 마감 {formatDateTime(review.deadline_at)}</span></p>
    {!review.my_completion_confirmed && <p data-testid="review-state" className="text-xs text-gray-500">동행 완료 확인 후 평가할 수 있어요.</p>}
    {review.my_completion_confirmed && !review.own_review && expired && <p data-testid="review-state" className="text-xs text-gray-500">평가 작성 기간이 종료됐어요.</p>}
    {review.can_write && <div className="space-y-2">
      <p className="text-[11px] text-gray-500">두 사람이 모두 제출해야 서로의 평가가 공개돼요. 제출 후에는 수정할 수 없어요.</p>
      <div role="radiogroup" aria-label="별점 선택" className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`} onClick={() => { setRating(n); setError(''); }}>
          <Star className={`w-7 h-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} /></button>)}
      </div>
      <label className="block text-xs font-bold">한마디 (선택, 300자 이하)<textarea name="review-comment" value={comment} maxLength={300} rows={2} onChange={event => setComment(event.target.value)} className="w-full mt-1 rounded-xl bg-gray-50 border border-gray-200 p-2 text-sm font-normal" /></label>
      {error && <ErrorBox message={error} />}
      {!confirming
        ? <PrimaryButton disabled={rating === 0} onClick={() => setConfirming(true)}>평가 제출</PrimaryButton>
        : <div className="space-y-1.5"><Notice>제출한 평가는 수정·삭제할 수 없어요. 제출할까요?</Notice>
          <div className="flex gap-2"><button type="button" onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold">다시 고치기</button>
            <button type="button" disabled={busy} onClick={() => void submit()} className="flex-1 py-2.5 rounded-xl bg-[#6c2cf5] text-white text-sm font-bold">{busy ? '제출 중…' : '확인하고 제출'}</button></div></div>}
    </div>}
    {review.own_review && <div className="text-xs space-y-1">
      <p className="font-bold">내가 남긴 평가 <Stars value={review.own_review.rating} /></p>
      {review.own_review.comment && <p className="text-gray-700">{review.own_review.comment}</p>}
    </div>}
    {!review.released && review.own_review && <p data-testid="review-state" className="text-xs text-amber-800">내 평가 제출 완료 · 상대 평가 대기</p>}
    {!review.released && !review.own_review && review.peer_submitted && <p data-testid="peer-submitted" className="text-xs text-gray-600">{counterpart}님은 평가를 제출했어요. 별점과 한마디는 내 평가를 제출하면 함께 공개돼요.</p>}
    {review.released && review.peer_review && <div data-testid="peer-review" className="text-xs space-y-1 rounded-lg bg-purple-50 p-2">
      <p data-testid="review-state" className="font-bold text-[#6c2cf5]">서로의 평가가 공개됐어요</p>
      <p className="font-bold">{counterpart}님이 남긴 평가 <Stars value={review.peer_review.rating} /></p>
      {review.peer_review.comment && <p data-testid="peer-review-comment" className="text-gray-700">{review.peer_review.comment}</p>}
    </div>}
  </div>;
}
