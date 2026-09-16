import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Check, Clock, Phone, ShieldCheck, X } from 'lucide-react';

import { getSupabaseClient } from '../lib/supabase';
import {
  exactAgeLabel,
  signupErrorMessage,
  toE164KoreanPhone,
  validateSignupProfile,
  type SignupProfile,
} from '../auth/signup';
import { koreaToday, sanitizePhone, validatePhone } from '../utils/profile';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileIncomplete: boolean;
  onProfileSaved: () => Promise<void> | void;
  now?: Date;
}

type SignupStep = 'terms' | 'phone' | 'basic' | 'complete';

const TEST_OTP = '123456';
const PROFILE_COLUMNS = 'id,nickname,birth_date,avatar_url,bio,created_at,updated_at';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  profileIncomplete,
  onProfileSaved,
  now = new Date(),
}) => {
  const [step, setStep] = useState<SignupStep>('terms');
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedService, setAgreedService] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);
  const [phone, setPhone] = useState('');
  const [requestedPhone, setRequestedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const allAgreed = agreedAge && agreedService && agreedPrivacy && agreedSafety;

  useEffect(() => {
    if (!isOpen) return;
    setStep(profileIncomplete ? 'basic' : 'terms');
    setErrorMessage('');
    setInfoMessage(profileIncomplete ? '휴대폰 확인은 완료됐어요. 기본 프로필을 저장하면 가입이 완료됩니다.' : '');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && profileIncomplete && step !== 'complete') setStep('basic');
  }, [isOpen, profileIncomplete]);

  useEffect(() => {
    if (!otpSent || timerSeconds <= 0) return;
    const timer = window.setInterval(() => setTimerSeconds(value => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, timerSeconds]);

  if (!isOpen) return null;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreedAge(next);
    setAgreedService(next);
    setAgreedPrivacy(next);
    setAgreedSafety(next);
  };

  const requestOtp = async () => {
    const problem = validatePhone(phone);
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setBusy(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      const e164Phone = toE164KoreanPhone(phone);
      const { error } = await getSupabaseClient().auth.signInWithOtp({
        phone: e164Phone,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setRequestedPhone(e164Phone);
      setOtpSent(true);
      setOtpCode('');
      setTimerSeconds(180);
      setInfoMessage('Supabase가 인증번호 요청을 받았어요. 등록된 테스트 번호는 문자 대신 고정 OTP로 확인합니다.');
    } catch (error: any) {
      setErrorMessage(signupErrorMessage(error, 'send'));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      setErrorMessage('인증번호 6자리 숫자를 입력해 주세요.');
      return;
    }
    if (!requestedPhone) {
      setErrorMessage('인증번호를 먼저 요청해 주세요.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      const { data, error } = await getSupabaseClient().auth.verifyOtp({
        phone: requestedPhone,
        token: otpCode,
        type: 'sms',
      });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error('Supabase 세션이 만들어지지 않았어요.');
      setOtpSent(false);
      setStep('basic');
      setInfoMessage('휴대폰 확인이 완료됐어요. 기본 프로필을 입력해 주세요.');
    } catch (error: any) {
      setErrorMessage(signupErrorMessage(error, 'verify'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateSignupProfile(nickname, birthDate, now);
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.user) {
        setStep('phone');
        throw new Error('인증 세션이 만료됐어요. 휴대폰 번호 확인부터 다시 진행해 주세요.');
      }

      const payload = {
        id: sessionData.session.user.id,
        nickname: nickname.trim(),
        birth_date: birthDate,
        avatar_url: null,
        bio: null,
      };
      let profile: SignupProfile | null = null;
      const inserted = await supabase.from('profiles').insert(payload).select(PROFILE_COLUMNS).single<SignupProfile>();
      if (inserted.error) {
        if (inserted.error.code !== '23505') throw inserted.error;
        const existing = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', payload.id).maybeSingle<SignupProfile>();
        if (existing.error) throw existing.error;
        profile = existing.data;
      } else profile = inserted.data;
      if (!profile) throw new Error('저장된 프로필을 확인하지 못했어요.');

      await onProfileSaved();
      setStep('complete');
      setInfoMessage('Supabase에 기본 프로필을 저장했고 가입을 완료했어요.');
    } catch (error: any) {
      const message = error instanceof Error && error.message.startsWith('인증 세션')
        ? error.message
        : signupErrorMessage(error, 'profile');
      setErrorMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const title = step === 'terms' ? '약관 확인' : step === 'phone' ? '휴대폰 번호 확인' : step === 'basic' ? '기본 프로필 입력' : '회원가입 완료';
  const progress = step === 'terms' ? 1 : step === 'phone' ? 2 : 3;
  const age = exactAgeLabel(birthDate, now);

  return <div role="dialog" aria-modal="true" aria-label="회원가입"
    onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
    <div className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl text-left">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-[#6c2cf5] text-white flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span><h3 className="text-[17px] font-bold">{title}</h3></div>
        <button type="button" aria-label="회원가입 창 닫기" onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
      </div>

      {step !== 'complete' && <div className="px-5 pt-3"><div className="flex gap-1.5">{[1, 2, 3].map(item => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= progress ? 'bg-[#6c2cf5]' : 'bg-gray-200'}`} />)}</div><p className="mt-2 text-[11px] text-gray-400">회원가입 {progress}/3</p></div>}
      {errorMessage && <div role="alert" className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMessage}</span></div>}
      {infoMessage && <div role="status" className="mx-5 mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700 flex gap-2"><Check className="w-4 h-4 shrink-0" /><span>{infoMessage}</span></div>}

      {step === 'terms' && <div className="p-5 space-y-4">
        <div className="space-y-3 bg-[#f8f9fc] p-4 rounded-2xl">
          <label className="flex items-center gap-3 pb-3 border-b border-gray-200/50 cursor-pointer font-bold text-sm"><input type="checkbox" checked={allAgreed} onChange={toggleAll} className="w-5 h-5 accent-[#6c2cf5]" />전체 약관에 동의합니다</label>
          {([
            [agreedAge, setAgreedAge, '[필수] 만 19세 이상 확인'],
            [agreedService, setAgreedService, '[필수] 서비스 이용약관 동의'],
            [agreedPrivacy, setAgreedPrivacy, '[필수] 개인정보 수집 및 이용 동의'],
            [agreedSafety, setAgreedSafety, '[필수] 1:1 동행 안전 수칙 확인'],
          ] as const).map(([checked, setter, label]) => <label key={label} className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer"><input type="checkbox" checked={checked} onChange={event => setter(event.target.checked)} className="w-4 h-4 accent-[#6c2cf5]" />{label}</label>)}
        </div>
        <p className="text-[11px] leading-relaxed text-gray-400">현재 약관 화면은 가입 흐름 확인용이며, 법률 검토된 영구 동의 이력을 저장하는 기능은 아직 포함하지 않았어요.</p>
        <button type="button" disabled={!allAgreed} onClick={() => { setStep('phone'); setInfoMessage(''); }} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center gap-2">동의하고 다음으로<ArrowRight className="w-4 h-4" /></button>
      </div>}

      {step === 'phone' && <div className="p-5 space-y-4">
        <div><label htmlFor="auth-phone" className="block text-xs font-bold text-gray-700 mb-1.5">휴대폰 번호</label><div className="flex gap-2"><div className="relative flex-1"><Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" /><input id="auth-phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={11} placeholder="01000000002" value={phone} onChange={event => { setPhone(sanitizePhone(event.target.value)); setOtpSent(false); setErrorMessage(''); }} className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30" /></div><button type="button" disabled={busy} onClick={requestOtp} className="px-3.5 rounded-xl bg-[#f0edff] text-[#6c2cf5] font-bold text-xs disabled:opacity-50">{otpSent ? '재요청' : '인증번호 요청'}</button></div></div>
        {otpSent && <div className="space-y-2.5"><div className="flex justify-between"><label htmlFor="auth-otp" className="text-xs font-bold">인증번호 6자리</label><span className="text-xs text-rose-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />화면 안내 {Math.floor(Math.max(timerSeconds, 0) / 60)}:{String(Math.max(timerSeconds, 0) % 60).padStart(2, '0')}</span></div><div className="relative"><input id="auth-otp" inputMode="numeric" maxLength={6} value={otpCode} onChange={event => { setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrorMessage(''); }} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center tracking-widest font-mono font-bold" /><button type="button" onClick={() => setOtpCode(TEST_OTP)} className="absolute right-2 top-2 px-2 py-1 text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] rounded-lg">테스트 OTP 입력</button></div><button type="button" disabled={busy || otpCode.length !== 6} onClick={verifyOtp} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-purple-300 text-white font-bold">Supabase에서 인증 확인</button></div>}
        <div className="p-3.5 rounded-2xl bg-amber-50 text-[11px] leading-relaxed text-amber-950"><strong>테스트 인증</strong><p className="mt-1">010-0000-0001~0020만 사용하며 실제 문자는 발송되지 않아요. 고정 OTP도 브라우저가 아니라 Supabase가 검증합니다.</p></div>
      </div>}

      {step === 'basic' && <form onSubmit={saveProfile} className="p-5 space-y-4" noValidate>
        <div><label htmlFor="auth-nickname" className="block text-xs font-bold mb-1.5">닉네임</label><input id="auth-nickname" value={nickname} maxLength={20} autoComplete="nickname" onChange={event => { setNickname(event.target.value); setErrorMessage(''); }} placeholder="예: 유미" className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200" /><p className="mt-1 text-[11px] text-gray-400">다른 사용자에게 공개할 이름이에요.</p></div>
        <div><div className="flex justify-between mb-1.5"><label htmlFor="auth-birth" className="text-xs font-bold">생년월일</label>{age && <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] rounded-full px-2 py-0.5">화면 표시: {age}</span>}</div><input id="auth-birth" type="date" min="1900-01-01" max={koreaToday(now)} value={birthDate} onChange={event => { setBirthDate(event.target.value); setErrorMessage(''); }} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200" /><p className="mt-1 text-[11px] text-gray-400">원본 생년월일은 본인만 조회하며, 화면에는 현재 서울 날짜 기준 만 나이만 표시해요.</p></div>
        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-purple-300 text-white font-bold">{busy ? 'Supabase에 저장 중…' : '기본 프로필 저장하고 가입 완료'}</button>
        <p className="text-[11px] text-gray-400">저장에 실패해도 인증 세션은 유지됩니다. 창을 다시 열거나 새로고침하면 이 단계부터 이어집니다.</p>
      </form>}

      {step === 'complete' && <div className="p-6 text-center space-y-4"><div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Check className="w-7 h-7" /></div><p className="font-bold">회원가입이 완료됐어요.</p><p className="text-sm text-gray-600">{nickname.trim()} · {age}</p><button type="button" onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] text-white font-bold">유미당 시작하기</button></div>}
    </div>
  </div>;
};
