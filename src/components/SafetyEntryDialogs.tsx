import React, { useEffect, useRef, useState } from 'react';

const REPORT_REASONS = ['불쾌한 언행·비매너', '금전 요구·영업·포교', '허위 프로필', '연락처 요구·외부 유도', '기타'];

function Shell({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div ref={ref} className="bg-white w-full max-w-[400px] rounded-t-3xl sm:rounded-3xl p-5 space-y-3 text-left text-sm">{children}</div>
  </div>;
}

/** Short report entry. The receipt is a prototype example: nothing is sent and no sanction is applied. */
export function ReportUserDialog({ targetName, onClose, onSubmit }: { targetName: string; onClose: () => void; onSubmit: (reason: string, detail: string) => void }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!reason) { setError('신고 사유를 선택해 주세요.'); return; }
    if (detail.trim().length < 5) { setError('상황을 5자 이상 적어 주세요.'); return; }
    if (detail.length > 500) { setError('내용은 500자 이하로 적어 주세요.'); return; }
    onSubmit(reason, detail.trim());
  };
  return <Shell label={`${targetName}님 신고`} onClose={onClose}>
    <h2 className="text-base font-bold">{targetName}님 신고</h2>
    <fieldset className="space-y-1.5"><legend className="text-xs font-bold mb-1">사유</legend>
      {REPORT_REASONS.map(item => <label key={item} className="flex items-center gap-2 text-xs"><input type="radio" name="report-reason" checked={reason === item} onChange={() => { setReason(item); setError(''); }} />{item}</label>)}
    </fieldset>
    <label className="block text-xs font-bold">상황 설명
      <textarea rows={3} value={detail} onChange={event => { setDetail(event.target.value); setError(''); }} className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-sm font-normal" />
    </label>
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    <p className="text-[11px] text-gray-500">체험 화면이라 운영팀·기관에 실제로 전달되지 않고, 상대에게 자동 제재나 당도 감점도 없어요.</p>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-gray-100 py-2.5 text-xs font-bold">취소</button><button type="button" onClick={submit} className="rounded-xl bg-rose-600 text-white py-2.5 text-xs font-bold">신고 접수(예시)</button></div>
  </Shell>;
}

/** Block entry with impact shown first. Completed records are kept; unblocking does not restore cancelled meetups. */
export function BlockUserDialog({ targetName, affectedTitles, holdReason, onClose, onConfirm }: { targetName: string; affectedTitles: string[]; holdReason?: string; onClose: () => void; onConfirm: () => void }) {
  return <Shell label={`${targetName}님 차단`} onClose={onClose}>
    <h2 className="text-base font-bold">{holdReason ? '차단 영향 검토가 필요해요' : `${targetName}님을 차단할까요?`}</h2>
    {holdReason && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{holdReason}</p>}
    <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
      <li>서로의 공고·신청·초대가 보이지 않도록 막아요.</li>
      {affectedTitles.length
        ? <li className="text-rose-600">진행 중인 확정 동행 {affectedTitles.length}건이 함께 취소돼요: {affectedTitles.join(', ')}</li>
        : <li>진행 중인 확정 동행은 없어요.</li>}
      <li>이미 완료된 동행 기록은 삭제되지 않아요. 차단을 해제해도 취소된 동행은 복구되지 않아요.</li>
    </ul>
    <p className="text-[11px] text-gray-500">동행만 취소하려면 차단 대신 약속 상세의 ‘동행 취소’를 이용해 주세요.</p>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-gray-100 py-2.5 text-xs font-bold">{holdReason ? '이전으로' : '취소'}</button><button type="button" disabled={Boolean(holdReason)} onClick={onConfirm} className="rounded-xl bg-rose-600 text-white py-2.5 text-xs font-bold disabled:bg-gray-200 disabled:text-gray-500">{holdReason ? '정책 확정 후 가능' : '차단하기'}</button></div>
  </Shell>;
}
