import React, { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Ticket } from 'lucide-react';
import { getMyReferralCode } from '../auth/signupEligibility';

export const ReferralCodeCard: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = async () => {
    setError('');
    try { setCode(await getMyReferralCode()); }
    catch { setError('추천 코드를 불러오지 못했어요.'); }
  };
  useEffect(() => { void load(); }, []);
  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError('복사하지 못했어요. 코드를 길게 눌러 복사해 주세요.'); }
  };
  return <section aria-label="내 여성 회원 추천 코드" className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
    <div className="flex items-center gap-2 text-sm font-bold text-purple-950"><Ticket className="w-4 h-4 text-[#6c2cf5]" />내 추천 코드</div>
    {code ? <div className="mt-3 flex items-center gap-2"><code data-referral-code className="flex-1 rounded-xl bg-white px-3 py-2.5 text-center font-bold tracking-wider text-[#6c2cf5]">{code}</code><button type="button" onClick={copy} className="rounded-xl bg-[#6c2cf5] p-2.5 text-white" aria-label="추천 코드 복사">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></div>
      : error ? <button type="button" onClick={() => void load()} className="mt-3 flex items-center gap-1 text-xs font-bold text-rose-700"><RefreshCw className="w-3.5 h-3.5" />{error} 다시 시도</button>
        : <p className="mt-3 text-xs text-purple-700">추천 코드를 준비하고 있어요…</p>}
    <p className="mt-2 text-[11px] leading-relaxed text-purple-800">가입을 완료한 여성 회원에게만 발급되며, 여러 명이 반복해서 사용할 수 있어요.</p>
  </section>;
};
