import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Camera, Check, Clock, Mail, Phone, ShieldCheck, Ticket, X } from 'lucide-react';

import { getSupabaseClient } from '../lib/supabase';
import {
  authErrorMessage,
  exactAgeLabel,
  toE164KoreanPhone,
  validateSignupProfile,
  PROFILE_COLUMNS,
  type AuthMode,
  type SignupProfile,
} from '../auth/signup';
import { koreaToday, PLACEHOLDER_AVATAR, validatePhone, validatePhotoFile } from '../utils/profile';
import { prepareProfileImage, type PreparedProfileImage } from '../utils/imageResize';
import { profileImageErrorMessage, removeOwnProfileImage, uploadProfileImage } from '../profile/avatarStorage';
import { PhotoSignupFlowError, runPhotoSignup } from '../auth/signupPhotoFlow';
import { PhoneInput } from './PhoneInput';
import { maskRealName } from '../utils/maskName';
import { isTestPhoneAuthEnabled, testPhoneAuth } from '../auth/testPhone';
import {
  assertSignupEligibility,
  completeSignupWithAvatar,
  eligibilityErrorMessage,
  normalizeInstitutionalEmail,
  TEST_INSTITUTIONAL_EMAIL_CODE,
  testInstitutionalEmail,
  type MaleSignupMethod,
  validateInstitutionalEmail,
  validateReferralCode,
} from '../auth/signupEligibility';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileIncomplete: boolean;
  onProfileSaved: () => Promise<void> | void;
  now?: Date;
}

type AuthStep = 'terms' | 'phone' | 'basic' | 'eligibility' | 'complete';


export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  profileIncomplete,
  onProfileSaved,
  now = new Date(),
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('phone');
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedService, setAgreedService] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);
  const [phone, setPhone] = useState('');
  const [requestedPhone, setRequestedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [realName, setRealName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [maleMethod, setMaleMethod] = useState<MaleSignupMethod>('female_referral');
  const [referralCode, setReferralCode] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailRequested, setEmailRequested] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [preparedPhoto, setPreparedPhoto] = useState<PreparedProfileImage | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');

  const allAgreed = agreedAge && agreedService && agreedPrivacy && agreedSafety;
  const testPhoneMode = isTestPhoneAuthEnabled();

  useEffect(() => {
    if (!isOpen) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      setPhotoPreviewUrl('');
      setPreparedPhoto(null);
      setUploadedPhotoPath('');
      return;
    }
    setMode(profileIncomplete ? 'signup' : 'login');
    setStep(profileIncomplete ? 'basic' : 'phone');
    setOtpSent(false);
    setOtpCode('');
    setRequestedPhone('');
    setErrorMessage('');
    setInfoMessage(profileIncomplete ? '휴대폰 확인은 완료됐어요. 새로고침 뒤에는 사진을 보관하지 않으므로 다시 선택해 주세요.' : '');
  }, [isOpen]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    if (isOpen && profileIncomplete && (step === 'phone' || step === 'terms')) {
      setMode('signup');
      setStep('basic');
    }
  }, [isOpen, profileIncomplete]);

  useEffect(() => {
    if (!otpSent || timerSeconds <= 0) return;
    const timer = window.setInterval(() => setTimerSeconds(value => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, timerSeconds]);

  if (!isOpen) return null;

  const requestClose = () => {
    const hasDraft = Boolean(phone || otpCode || realName || birthDate || gender || preparedPhoto || referralCode || institutionalEmail || emailCode || agreedAge || agreedService || agreedPrivacy || agreedSafety);
    if (!hasDraft || window.confirm('입력 중인 내용을 삭제하고 인증 창을 닫을까요?')) onClose();
  };

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreedAge(next);
    setAgreedService(next);
    setAgreedPrivacy(next);
    setAgreedSafety(next);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep(nextMode === 'signup' ? 'terms' : 'phone');
    setOtpSent(false);
    setOtpCode('');
    setRequestedPhone('');
    setErrorMessage('');
    setInfoMessage('');
    if (nextMode === 'signup') {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      setPhotoPreviewUrl('');
      setPreparedPhoto(null);
      setUploadedPhotoPath('');
    }
  };

  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = validatePhotoFile(file);
    if (invalid) { setErrorMessage(invalid); return; }
    setPhotoBusy(true);
    setErrorMessage('');
    try {
      const prepared = await prepareProfileImage(file);
      const nextPreview = URL.createObjectURL(prepared.blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = nextPreview;
      setPhotoPreviewUrl(nextPreview);
      setPreparedPhoto(prepared);
      const orphan = uploadedPhotoPath;
      setUploadedPhotoPath('');
      if (orphan) void removeOwnProfileImage(orphan).catch(() => {});
      setInfoMessage('사진을 준비했어요. 가입 완료 전까지 이 창 안에서만 유지됩니다.');
    } catch {
      setErrorMessage('사진을 읽지 못했어요. 비어 있거나 손상된 파일인지 확인하고 다시 선택해 주세요.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const requestOtp = async () => {
    const problem = testPhoneMode ? (/^\d{11}$/.test(phone) ? null : '숫자 11자리를 입력해 주세요.') : validatePhone(phone);
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setBusy(true);
    setErrorMessage('');
    setInfoMessage('');
    try {
      if (testPhoneMode) {
        await testPhoneAuth('request', phone, undefined, mode);
        setRequestedPhone(phone);
      } else {
        const e164Phone = toE164KoreanPhone(phone);
        const { error } = await getSupabaseClient().auth.signInWithOtp({
          phone: e164Phone,
          options: { shouldCreateUser: mode === 'signup' },
        });
        if (error) throw error;
        setRequestedPhone(e164Phone);
      }
      setOtpSent(true);
      setOtpCode('');
      setTimerSeconds(180);
      setInfoMessage(testPhoneMode ? '실제 문자는 보내지 않아요. 테스트 환경에서 제공받은 인증값을 입력해 주세요.' : 'Supabase가 인증번호 요청을 받았어요. 등록된 테스트 번호는 운영 안내에 따라 확인합니다.');
    } catch (error: any) {
      setErrorMessage(testPhoneMode ? error.message : authErrorMessage(error, 'send', mode));
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
      const supabase = getSupabaseClient();
      const { data, error } = testPhoneMode
        ? await supabase.auth.setSession(await testPhoneAuth('verify', requestedPhone, otpCode, mode))
        : await supabase.auth.verifyOtp({ phone: requestedPhone, token: otpCode, type: 'sms' });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error('Supabase 세션이 만들어지지 않았어요.');
      setOtpSent(false);
      const existing = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', data.user.id).maybeSingle<SignupProfile>();
      if (existing.error) throw existing.error;
      if (existing.data) {
        setInfoMessage(mode === 'login' ? '로그인이 완료됐어요.' : '이미 가입된 계정으로 로그인했어요.');
        await onProfileSaved();
        return;
      }
      setMode('signup');
      setStep('basic');
      setInfoMessage(mode === 'login'
        ? '휴대폰 확인은 완료됐지만 기본 프로필이 없어요. 가입을 이어서 완료해 주세요.'
        : '휴대폰 확인이 완료됐어요. 기본 프로필을 입력해 주세요.');
    } catch (error: any) {
      setErrorMessage(testPhoneMode ? error.message : authErrorMessage(error, 'verify', mode));
    } finally {
      setBusy(false);
    }
  };

  const finishSignup = async (method: 'female_direct' | MaleSignupMethod, code?: string) => {
    if (!preparedPhoto) throw new Error('프로필 사진을 선택해 주세요.');
    try {
      await runPhotoSignup(preparedPhoto.blob, uploadedPhotoPath, {
        upload: blob => uploadProfileImage(blob),
        complete: avatarPath => completeSignupWithAvatar({ realName, birthDate, gender: gender!, avatarPath, method, referralCode: code }),
      }, setUploadedPhotoPath);
      setUploadedPhotoPath('');
    } catch (error) {
      const original = error instanceof PhotoSignupFlowError ? error.original : error;
      const eligibilityMessage = eligibilityErrorMessage(original, '');
      const action = error instanceof PhotoSignupFlowError && error.phase === 'upload' ? 'upload' : 'save';
      throw new Error(eligibilityMessage || profileImageErrorMessage(original, action));
    }
    await onProfileSaved();
    setStep('complete');
    setInfoMessage('가입 조건을 확인하고 기본 프로필을 안전하게 저장했어요.');
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateSignupProfile(realName, birthDate, now, gender) || (!preparedPhoto ? '프로필 사진을 선택해 주세요.' : null);
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

      if (gender === 'male') {
        setStep('eligibility');
        setInfoMessage('남성 회원은 기존 여성 회원 추천 코드 또는 학교·직장 이메일 확인이 필요해요.');
      } else {
        await finishSignup('female_direct');
      }
    } catch (error: any) {
      const message = error instanceof Error && (error.message.startsWith('인증 세션') || /사진|네트워크|권한/.test(error.message))
        ? error.message : authErrorMessage(error, 'profile', 'signup');
      setErrorMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const requestEmailCode = async () => {
    const problem = validateInstitutionalEmail(institutionalEmail);
    if (problem) { setErrorMessage(problem); return; }
    setBusy(true); setErrorMessage('');
    try {
      const result = await testInstitutionalEmail('request', institutionalEmail);
      setInstitutionalEmail(normalizeInstitutionalEmail(institutionalEmail));
      setEmailRequested(true); setEmailVerified(false); setEmailCode('');
      setInfoMessage(result.message);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : '이메일 확인을 요청하지 못했어요.'); }
    finally { setBusy(false); }
  };

  const verifyEmailCode = async () => {
    if (!emailRequested) { setErrorMessage('같은 이메일로 확인 코드를 먼저 요청해 주세요.'); return; }
    setBusy(true); setErrorMessage('');
    try {
      const result = await testInstitutionalEmail('verify', institutionalEmail, emailCode);
      setEmailVerified(Boolean(result.verified)); setInfoMessage(result.message);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : '이메일을 확인하지 못했어요.'); }
    finally { setBusy(false); }
  };

  const saveEligibility = async (event: React.FormEvent) => {
    event.preventDefault();
    if (maleMethod === 'female_referral') {
      const problem = validateReferralCode(referralCode);
      if (problem) { setErrorMessage(problem); return; }
    } else if (!emailVerified) { setErrorMessage('기관 이메일 확인을 먼저 완료해 주세요.'); return; }
    setBusy(true); setErrorMessage('');
    try {
      await assertSignupEligibility(maleMethod, maleMethod === 'female_referral' ? referralCode : undefined);
      await finishSignup(maleMethod, maleMethod === 'female_referral' ? referralCode : undefined);
    }
    catch (error) {
      const direct = error instanceof Error && /사진|네트워크|권한/.test(error.message) ? error.message : '';
      setErrorMessage(direct || eligibilityErrorMessage(error));
    }
    finally { setBusy(false); }
  };

  const title = mode === 'login' && step === 'phone' ? '로그인' : step === 'terms' ? '약관 확인' : step === 'phone' ? '휴대폰 번호 확인' : step === 'basic' ? '기본 프로필 입력' : step === 'eligibility' ? '가입 조건 확인' : '회원가입 완료';
  const progress = step === 'terms' ? 1 : step === 'phone' ? 2 : step === 'basic' ? 3 : 4;
  const age = exactAgeLabel(birthDate, now);
  const dialogLabel = mode === 'login' && step === 'phone' ? '로그인' : '회원가입';

  return <div role="dialog" aria-modal="true" aria-label={dialogLabel}
    onClick={requestClose}
    onKeyDown={event => { if (event.key === 'Escape') requestClose(); }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
    <div onClick={event => event.stopPropagation()} className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl text-left">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-[#6c2cf5] text-white flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span><h3 className="text-[17px] font-bold">{title}</h3></div>
        <button type="button" aria-label={`${dialogLabel} 창 닫기`} onClick={requestClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
      </div>

      {mode === 'signup' && step !== 'complete' && <div className="px-5 pt-3"><div className="flex gap-1.5">{[1, 2, 3, 4].map(item => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= progress ? 'bg-[#6c2cf5]' : 'bg-gray-200'}`} />)}</div><p className="mt-2 text-[11px] text-gray-400">회원가입 {progress}/4</p></div>}
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
        <button type="button" onClick={() => switchMode('login')} className="w-full text-xs font-bold text-[#6c2cf5]">로그인으로 돌아가기</button>
      </div>}

      {step === 'phone' && <div className="p-5 space-y-4">
        <div><label htmlFor="auth-phone" className="block text-xs font-bold text-gray-700 mb-1.5">휴대폰 번호</label><div className="flex gap-2"><div className="relative flex-1"><Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" /><PhoneInput id="auth-phone" value={phone} onValueChange={digits => { setPhone(digits); setOtpSent(false); setRequestedPhone(''); setOtpCode(''); setErrorMessage(''); setInfoMessage(''); }} className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30" /></div><button type="button" disabled={busy} onClick={requestOtp} className="px-3.5 rounded-xl bg-[#f0edff] text-[#6c2cf5] font-bold text-xs disabled:opacity-50">{otpSent ? '재요청' : '인증번호 요청'}</button></div><p className="mt-1.5 text-[11px] text-gray-400">숫자 11자리를 입력하면 하이픈이 자동으로 표시돼요.</p></div>
        {otpSent && <div className="space-y-2.5"><div className="flex justify-between"><label htmlFor="auth-otp" className="text-xs font-bold">인증번호 6자리</label><span className="text-xs text-rose-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />화면 안내 {Math.floor(Math.max(timerSeconds, 0) / 60)}:{String(Math.max(timerSeconds, 0) % 60).padStart(2, '0')}</span></div><input id="auth-otp" inputMode="numeric" maxLength={6} value={otpCode} onChange={event => { setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrorMessage(''); }} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center tracking-widest font-mono font-bold" /><button type="button" disabled={busy || otpCode.length !== 6} onClick={verifyOtp} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-purple-300 text-white font-bold">인증하고 {mode === 'login' ? '로그인' : '가입 계속하기'}</button></div>}
        <div className="p-3.5 rounded-2xl bg-amber-50 text-[11px] leading-relaxed text-amber-950"><strong>테스트 인증 안내</strong><p className="mt-1">테스트 계정과 인증값은 별도 운영 안내에서 확인해 주세요. 화면에는 전화번호나 인증값을 노출하지 않아요.</p></div>
        {mode === 'login' ? <div className="pt-4 border-t border-gray-100 text-center space-y-2"><p className="text-xs text-gray-500">아직 유미당 계정이 없나요?</p><button type="button" onClick={() => switchMode('signup')} className="w-full py-3 rounded-xl border border-[#6c2cf5] text-[#6c2cf5] font-bold">회원가입</button></div>
          : <button type="button" onClick={() => switchMode('login')} className="w-full text-xs font-bold text-[#6c2cf5]">이미 계정이 있어요 · 로그인</button>}
      </div>}

      {step === 'basic' && <form onSubmit={saveProfile} className="p-5 space-y-4" noValidate>
        <section aria-labelledby="auth-photo-label" className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center gap-4">
            <img src={photoPreviewUrl || PLACEHOLDER_AVATAR} alt={photoPreviewUrl ? '선택한 프로필 사진 미리보기' : ''}
              className="h-20 w-20 shrink-0 rounded-full object-cover bg-purple-100 ring-4 ring-white" />
            <div className="min-w-0 flex-1">
              <p id="auth-photo-label" className="text-xs font-bold">프로필 사진 (필수)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">JPG·JPEG·PNG, 원본 10MB 이하. 긴 변 480px JPEG로 줄여 비공개 저장소에 올려요.</p>
              <input ref={photoInputRef} id="auth-profile-photo" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                aria-describedby="auth-photo-help" className="sr-only" onChange={choosePhoto} />
              <button type="button" disabled={busy || photoBusy} onClick={() => photoInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-2 text-xs font-bold disabled:opacity-50">
                <Camera className="h-3.5 w-3.5" />{photoBusy ? '사진 준비 중…' : photoPreviewUrl ? '다시 선택' : '사진 선택'}
              </button>
            </div>
          </div>
          <p id="auth-photo-help" className="text-[11px] text-gray-400">선택한 사진은 이 가입 창의 다음 단계에서도 유지되지만, 새로고침하면 다시 선택해야 해요.</p>
        </section>
        <div><label htmlFor="auth-real-name" className="block text-xs font-bold mb-1.5">실명</label><input id="auth-real-name" value={realName} maxLength={20} autoComplete="name" onChange={event => { setRealName(event.target.value); setErrorMessage(''); }} placeholder="한글 실명을 입력해 주세요" className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200" /><p className="mt-1 text-[11px] text-gray-400">원본 실명은 본인만 볼 수 있고, 다른 회원에게는 {realName.trim().length >= 2 ? maskRealName(realName) : '가려진 이름'}만 보여요. 신분증 확인이나 실명 인증은 아니에요.</p></div>
        <div><span id="auth-gender-label" className="block text-xs font-bold mb-1.5">성별</span><div role="group" aria-labelledby="auth-gender-label" className="flex gap-2">{(['female', 'male'] as const).map(value => <button type="button" key={value} aria-pressed={gender === value} onClick={() => { setGender(value); setErrorMessage(''); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${gender === value ? 'bg-[#f0edff] text-[#6c2cf5] border border-[#6c2cf5]/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{value === 'female' ? '여성' : '남성'}</button>)}</div><p className="mt-1 text-[11px] text-gray-400">성별은 본인이 선택하며 별도 증명 절차는 없어요. 가입 후 로그인 회원에게 공고 상세에서만 표시돼요.</p>{gender === 'female' && <p className="mt-1 text-[11px] font-bold text-[#6c2cf5]">여성 회원은 기본정보 입력 후 바로 가입할 수 있어요.</p>}{gender === 'male' && <p className="mt-1 text-[11px] font-bold text-[#6c2cf5]">여성회원 추천 코드 또는 학교·직장 이메일 확인이 필요해요.</p>}</div>
        <div><div className="flex justify-between mb-1.5"><label htmlFor="auth-birth" className="text-xs font-bold">생년월일</label>{age && <span className="text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] rounded-full px-2 py-0.5">화면 표시: {age}</span>}</div><input id="auth-birth" type="date" min="1900-01-01" max={koreaToday(now)} value={birthDate} onChange={event => { setBirthDate(event.target.value); setErrorMessage(''); }} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200" /><p className="mt-1 text-[11px] text-gray-400">원본 생년월일은 본인만 조회하며, 화면에는 현재 서울 날짜 기준 만 나이만 표시해요.</p></div>
        <button type="submit" disabled={busy || photoBusy || !preparedPhoto} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold">{busy ? '확인 중…' : gender === 'male' ? '다음: 가입 조건 확인' : '사진과 기본 프로필 저장하고 가입 완료'}</button>
        <p className="text-[11px] text-gray-400">저장에 실패해도 인증 세션은 유지됩니다. 창을 다시 열거나 새로고침하면 이 단계부터 이어집니다.</p>
      </form>}

      {step === 'eligibility' && <form onSubmit={saveEligibility} className="p-5 space-y-4" noValidate>
        <p className="text-sm text-gray-600 leading-relaxed">여성회원 추천 코드 또는 학교·직장 이메일 확인이 필요해요. 이메일과 추천 정보는 다른 회원에게 공개되지 않아요.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={maleMethod === 'female_referral'} onClick={() => { setMaleMethod('female_referral'); setErrorMessage(''); }} className={`rounded-xl p-3 text-xs font-bold border ${maleMethod === 'female_referral' ? 'border-[#6c2cf5] bg-[#f0edff] text-[#6c2cf5]' : 'border-gray-200'}`}><Ticket className="w-4 h-4 mx-auto mb-1" />여성 회원 추천</button>
          <button type="button" aria-pressed={maleMethod === 'institutional_email'} onClick={() => { setMaleMethod('institutional_email'); setErrorMessage(''); }} className={`rounded-xl p-3 text-xs font-bold border ${maleMethod === 'institutional_email' ? 'border-[#6c2cf5] bg-[#f0edff] text-[#6c2cf5]' : 'border-gray-200'}`}><Mail className="w-4 h-4 mx-auto mb-1" />학교·직장 이메일</button>
        </div>
        {maleMethod === 'female_referral' ? <div>
          <label htmlFor="auth-referral" className="block text-xs font-bold mb-1.5">추천 코드</label>
          <input id="auth-referral" value={referralCode} onChange={event => { setReferralCode(event.target.value.toUpperCase()); setErrorMessage(''); }} placeholder="YMD-12AB34CD" maxLength={12} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 font-mono uppercase" />
          <p className="mt-1 text-[11px] text-gray-400">유저테스트에서는 가입을 완료한 여성 회원의 한 코드를 여러 번 사용할 수 있어요.</p>
        </div> : <div className="space-y-3">
          <div><label htmlFor="auth-institution-email" className="block text-xs font-bold mb-1.5">학교·직장 이메일</label><div className="flex gap-2"><input id="auth-institution-email" type="email" value={institutionalEmail} onChange={event => { setInstitutionalEmail(event.target.value); setEmailRequested(false); setEmailVerified(false); setErrorMessage(''); }} placeholder="name@company.com" className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200" /><button type="button" disabled={busy} onClick={requestEmailCode} className="px-3 rounded-xl bg-[#f0edff] text-[#6c2cf5] text-xs font-bold disabled:opacity-50">코드 요청</button></div></div>
          {emailRequested && <div><label htmlFor="auth-email-code" className="block text-xs font-bold mb-1.5">확인 코드</label><div className="relative"><input id="auth-email-code" inputMode="numeric" maxLength={6} value={emailCode} onChange={event => { setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setEmailVerified(false); setErrorMessage(''); }} className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-center tracking-widest font-mono font-bold" /><button type="button" onClick={() => setEmailCode(TEST_INSTITUTIONAL_EMAIL_CODE)} className="absolute right-2 top-2 px-2 py-1 text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] rounded-lg">테스트 코드 입력</button></div><button type="button" disabled={busy || emailCode.length !== 6 || emailVerified} onClick={verifyEmailCode} className="w-full mt-2 py-3 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:bg-gray-300">{emailVerified ? '확인 완료' : '이메일 확인'}</button></div>}
          <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950"><strong>유저테스트용 인증입니다.</strong> 실제 이메일은 발송되지 않아요. 고정 확인 코드 246810은 서버가 검증하며, 요청 후 10분 동안만 유효해요.</p>
        </div>}
        <button type="submit" disabled={busy || !preparedPhoto} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold">{busy ? '가입 완료 중…' : '조건 확인하고 사진 업로드 · 가입 완료'}</button>
        <button type="button" onClick={() => { setStep('basic'); setErrorMessage(''); setInfoMessage(''); }} className="w-full text-xs font-bold text-gray-500">기본 정보로 돌아가기</button>
      </form>}

      {step === 'complete' && <div className="p-6 text-center space-y-4"><div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Check className="w-7 h-7" /></div><p className="font-bold">회원가입이 완료됐어요.</p><p className="text-sm text-gray-600">{maskRealName(realName)} · {age}</p><button type="button" onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#6c2cf5] text-white font-bold">유미당 시작하기</button></div>}
    </div>
  </div>;
};
