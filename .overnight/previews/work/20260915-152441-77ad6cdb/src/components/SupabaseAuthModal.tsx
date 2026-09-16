import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import { authErrorMessage } from '../auth/errors';
import { normalizeKoreanMobile } from '../auth/phone';
import type { AuthState } from '../auth/session';

type Props = { isOpen: boolean; onClose: () => void; auth: AuthState; onRetry: () => void };
const field = 'w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm';
const button = 'w-full rounded-xl bg-[#6c2cf5] py-3 text-sm font-bold text-white disabled:opacity-50';

export function SupabaseAuthModal({ isOpen, onClose, auth, onRetry }: Props) {
  const [phone, setPhone] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [code, setCode] = useState('');
  const [signup, setSignup] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const lock = useRef(false);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (isOpen) { setPhone(''); setSentPhone(''); setCode(''); setError(''); setInfo(''); setSignup(false); setAgreed(false); }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);
  if (!isOpen) return null;
  const perform = async (action: () => Promise<void>) => {
    if (lock.current || !supabase) return;
    lock.current = true; setBusy(true); setError(''); setInfo('');
    try { await action(); } catch (cause) { setError(authErrorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeKoreanMobile(phone);
    if (!normalized) { setError('010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.'); return; }
    if (Date.now() < resendAt || (signup && !agreed)) return;
    void perform(async () => {
      const { error } = await supabase!.auth.signInWithOtp({ phone: normalized, options: { channel: 'sms', shouldCreateUser: signup } });
      if (error) throw error;
      setSentPhone(normalized); setCode(''); setNow(Date.now()); setResendAt(Date.now() + 60_000);
      setInfo('인증번호 발송을 요청했어요. 받은 숫자 6자리를 입력해 주세요.');
    });
  };
  const verify = (event: FormEvent) => {
    event.preventDefault();
    if (!sentPhone || sentPhone !== normalizeKoreanMobile(phone) || !/^\d{6}$/.test(code)) return;
    void perform(async () => {
      const { data, error } = await supabase!.auth.verifyOtp({ phone: sentPhone, token: code, type: 'sms' });
      if (error) throw error;
      if (!data.session) throw new Error('No session');
      setCode(''); setInfo('로그인 상태를 확인하고 있어요.');
    });
  };
  return <div role="dialog" aria-modal="true" aria-label="휴대폰 로그인" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
    onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}>
    <div className="w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white p-5 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{signup ? '휴대폰 회원가입' : '휴대폰 로그인'}</h2><button disabled={busy} aria-label="로그인 창 닫기" onClick={onClose}><X /></button></div>
      {(error || supabaseConfigurationError || auth.error) && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error || supabaseConfigurationError || auth.error}
        {auth.status === 'error' && !supabaseConfigurationError && <button onClick={onRetry} className="block mt-2 underline">로그인 상태 다시 확인</button>}
      </div>}
      {info && <p role="status" className="rounded-xl bg-purple-50 p-3 text-sm text-purple-800">{info}</p>}
      <form onSubmit={send}><fieldset disabled={busy || !supabase} className="space-y-3">
        {signup && <label className="flex gap-2 text-xs"><input type="checkbox" required checked={agreed} disabled={Boolean(sentPhone)} onChange={event => setAgreed(event.target.checked)} />만 19세 이상이며 이용약관, 개인정보 수집·이용 및 동행 안전 수칙에 동의합니다.</label>}
        <label htmlFor="real-auth-phone" className="block text-sm font-bold">휴대폰 번호</label>
        <input id="real-auth-phone" type="tel" autoComplete="tel" required value={phone} onChange={event => { setPhone(event.target.value); setSentPhone(''); setCode(''); setInfo(''); }} className={field} placeholder="01012345678" />
        <button type="submit" disabled={remaining > 0} className={button}>{busy ? '처리 중…' : remaining > 0 ? `${remaining}초 후 재발송 가능` : sentPhone ? '인증번호 재발송' : '인증번호 발송'}</button>
      </fieldset></form>
      {sentPhone && <form onSubmit={verify} className="space-y-3">
        <label htmlFor="real-auth-code" className="block text-sm font-bold">인증번호 6자리</label>
        <input id="real-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={field} />
        <button type="submit" disabled={busy || code.length !== 6} className={button}>{busy ? '확인 중…' : '인증 확인 및 로그인'}</button>
      </form>}
      <p className="text-xs text-gray-500">문자 인증은 번호 사용 여부를 확인해요. 실명·본인확인 인증과는 별개예요.</p>
      <button disabled={busy} onClick={() => { setSignup(!signup); setSentPhone(''); setCode(''); setError(''); setInfo(''); }} className="w-full text-sm text-[#6c2cf5]">{signup ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입'}</button>
    </div>
  </div>;
}
