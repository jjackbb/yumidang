import { NEW_USER_SUGAR } from '../data/publicProfiles';
import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Phone, ArrowRight, AlertCircle, Check, Clock, Sparkles, Key, Mail } from 'lucide-react';
import { CurrentUser } from '../types';
import { maskRealName } from '../utils/maskName';
import {
  NEIGHBORHOOD_OPTIONS, ageGroupOf, koreaToday, sanitizePhone, validateBirthDate, validateKoreanName,
  validatePhone, validateReferralCode, validateWorkEmail,
} from '../utils/profile';

export interface DemoAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: CurrentUser, kind: 'signup' | 'signin') => void;
  /** Accounts known to this prototype (looked up by phone). */
  users: CurrentUser[];
  now?: Date;
}

type AuthMode = 'signup' | 'signin';
type SignUpStep = 'terms' | 'phone' | 'basic';

// Prototype-only codes. No SMS or email is ever sent.
export const SAMPLE_OTP = '123456';
export const SAMPLE_EMAIL_CODE = '246810';
const SAMPLE_LOGIN_PHONE = '01000000001';

export const DemoAuthModal: React.FC<DemoAuthModalProps> = ({ isOpen, onClose, onAuthSuccess, users, now = new Date() }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<SignUpStep>('terms');

  const [phone, setPhone] = useState(SAMPLE_LOGIN_PHONE);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [timerActive, setTimerActive] = useState(false);

  const [realName, setRealName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [neighborhood, setNeighborhood] = useState(NEIGHBORHOOD_OPTIONS[0]);
  const [maleRoute, setMaleRoute] = useState<'referral' | 'work_email'>('referral');
  const [referralCode, setReferralCode] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');

  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedService, setAgreedService] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (!timerActive) return;
    if (timerSeconds <= 0) { setTimerActive(false); return; }
    const interval = setInterval(() => setTimerSeconds(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const allAgreed = agreedAge && agreedService && agreedPrivacy && agreedSafety;
  const handleToggleAll = () => {
    const next = !allAgreed;
    setAgreedAge(next); setAgreedService(next); setAgreedPrivacy(next); setAgreedSafety(next);
  };

  const resetOtp = () => { setOtpSent(false); setOtpCode(''); setTimerActive(false); setTimerSeconds(180); };
  const resetForm = (nextMode: AuthMode = 'signin') => {
    setMode(nextMode); setStep('terms');
    setPhone(nextMode === 'signin' ? SAMPLE_LOGIN_PHONE : ''); resetOtp();
    setRealName(''); setBirthDate(''); setGender(null); setNeighborhood(NEIGHBORHOOD_OPTIONS[0]);
    setMaleRoute('referral'); setReferralCode(''); setWorkEmail(''); setEmailSent(false); setEmailCode('');
    setAgreedAge(false); setAgreedService(false); setAgreedPrivacy(false); setAgreedSafety(false);
    setErrorMessage(''); setInfoMessage('');
  };

  useEffect(() => { if (isOpen) resetForm('signin'); }, [isOpen]);

  if (!isOpen) return null;

  const close = () => { onClose(); resetForm(); };
  const existingByPhone = (value: string) => users.find(user => user.phone === value);

  const handleSendOtp = () => {
    const problem = validatePhone(phone);
    if (problem) { setErrorMessage(problem); return; }
    if (mode === 'signin' && !existingByPhone(phone)) { setErrorMessage('가입 정보가 없는 번호예요. 번호를 확인하거나 휴대폰 본인인증으로 가입해 주세요.'); return; }
    if (mode === 'signup' && existingByPhone(phone)) { setErrorMessage('이미 가입된 번호예요. 로그인으로 돌아가 주세요.'); return; }
    setErrorMessage('');
    setOtpSent(true); setOtpCode(''); setTimerSeconds(180); setTimerActive(true);
    setInfoMessage(`체험 모드라 실제 문자는 보내지 않았어요. 예시 인증번호 ${SAMPLE_OTP}을 입력하면 다음 단계로 넘어가요.`);
  };

  const handleVerifyOtp = () => {
    setErrorMessage('');
    if (timerSeconds <= 0) { setErrorMessage('인증 시간이 지났어요. 재발송을 눌러 다시 시도해 주세요.'); return; }
    if (!/^\d{6}$/.test(otpCode)) { setErrorMessage('인증번호 6자리 숫자를 입력해 주세요.'); return; }
    if (otpCode !== SAMPLE_OTP) { setErrorMessage('인증번호가 맞지 않아요. 다시 입력하거나 재발송해 주세요.'); return; }
    setTimerActive(false);
    if (mode === 'signin') {
      const account = existingByPhone(phone);
      if (!account) { setErrorMessage('가입 정보가 없는 번호예요.'); return; }
      onAuthSuccess({ ...account, isLoggedIn: true }, 'signin');
      close();
      return;
    }
    setStep('basic');
    setInfoMessage('번호 확인(체험)을 마쳤어요. 기본 정보를 입력해 주세요. 실제 휴대폰 인증 배지는 부여되지 않아요.');
  };

  const handleSendEmail = () => {
    const problem = validateWorkEmail(workEmail);
    if (problem) { setErrorMessage(problem); return; }
    setErrorMessage(''); setEmailSent(true);
    setInfoMessage(`체험 모드라 실제 메일은 보내지 않았어요. 예시 확인 코드 ${SAMPLE_EMAIL_CODE}을 입력해 주세요.`);
  };

  const handleCompleteSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateKoreanName(realName) || validateBirthDate(birthDate, now)
      || (!gender ? '성별을 선택해 주세요.' : null)
      || (gender === 'male' && maleRoute === 'referral' ? validateReferralCode(referralCode) : null)
      || (gender === 'male' && maleRoute === 'work_email' ? (validateWorkEmail(workEmail) || (!emailSent ? '확인 메일 보내기를 먼저 눌러 주세요.' : emailCode.trim() !== SAMPLE_EMAIL_CODE ? '이메일 확인 코드가 맞지 않아요. 다시 입력해 주세요.' : null)) : null);
    if (problem) { setErrorMessage(problem); return; }
    if (existingByPhone(phone)) { setErrorMessage('이미 가입된 번호예요. 로그인으로 돌아가 주세요.'); return; }

    const name = realName.trim();
    const masked = maskRealName(name);
    const newUser: CurrentUser = {
      id: `user-${crypto.randomUUID()}`,
      isLoggedIn: true,
      phone,
      realName: name,
      maskedName: masked,
      nickname: masked,
      gender: gender!,
      birthDate,
      ageGroup: ageGroupOf(birthDate, now),
      neighborhood,
      sugarContent: NEW_USER_SUGAR,
      // The code check above is a prototype example, so no verified badge is granted.
      isPhoneVerified: false,
      isKycVerified: false,
      isSample: false,
      avatar: '',
      bio: '',
      hobbies: [],
      traits: [],
      joinedAt: '방금 가입',
      joinRoute: gender === 'male' ? maleRoute : undefined,
      referralCode: gender === 'male' && maleRoute === 'referral' ? referralCode.trim() : undefined,
      email: gender === 'male' && maleRoute === 'work_email' ? workEmail.trim().toLowerCase() : undefined,
    };
    onAuthSuccess(newUser, 'signup');
    close();
  };

  const phoneInput = (label: string) => <div>
    <label htmlFor="auth-phone" className="block text-xs font-bold text-gray-700 mb-1.5">{label}</label>
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input id="auth-phone" type="tel" maxLength={11} inputMode="numeric" autoComplete="tel" aria-label="휴대폰 번호" placeholder="01012345678" value={phone}
          onChange={(e) => { setPhone(sanitizePhone(e.target.value)); setErrorMessage(''); if (otpSent) resetOtp(); }}
          onPaste={(e) => { e.preventDefault(); setPhone(sanitizePhone(e.clipboardData.getData('text'))); setErrorMessage(''); if (otpSent) resetOtp(); }}
          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30 focus:border-[#6c2cf5]" />
      </div>
      <button type="button" onClick={handleSendOtp} className="px-3.5 py-2.5 bg-[#f0edff] hover:bg-[#ded6fb] text-[#6c2cf5] font-bold text-xs rounded-xl transition-colors whitespace-nowrap">
        {otpSent ? '재발송' : '인증번호 발송'}
      </button>
    </div>
    <p className="text-[11px] text-gray-400 mt-1">숫자만 11자리까지 입력돼요. 붙여넣어도 하이픈·공백은 빠져요.</p>
  </div>;

  const otpBlock = (submitLabel: string) => otpSent && <div className="space-y-2.5 animate-in fade-in">
    <div className="flex items-center justify-between">
      <label htmlFor="auth-otp" className="block text-xs font-bold text-gray-700">인증번호 6자리</label>
      <span className="text-xs font-semibold text-rose-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />남은 시간 {Math.floor(Math.max(timerSeconds, 0) / 60)}:{('0' + (Math.max(timerSeconds, 0) % 60)).slice(-2)}</span>
    </div>
    <div className="relative">
      <input id="auth-otp" type="text" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리 입력" value={otpCode}
        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrorMessage(''); }}
        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-sm tracking-widest font-mono text-center font-bold border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30 focus:border-[#6c2cf5]" />
      <button type="button" onClick={() => setOtpCode(SAMPLE_OTP)} className="absolute right-2 top-2 px-2 py-1 text-[11px] font-bold text-[#6c2cf5] bg-[#f0edff] hover:bg-[#ded6fb] rounded-lg transition-colors">테스트코드 입력</button>
    </div>
    <button type="button" disabled={otpCode.length !== 6} onClick={handleVerifyOtp}
      className="w-full mt-2 py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] disabled:bg-purple-300 text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2">
      <span>{submitLabel}</span><ArrowRight className="w-4 h-4" />
    </button>
  </div>;

  const sampleNotice = <div className="p-3.5 bg-amber-50 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
    <div className="font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />실제 문자 발송 없는 인증 체험</div>
    <p className="mt-0.5">[인증번호 발송] 후 [테스트코드 입력]으로 예시 번호를 넣을 수 있어요. 실제 본인인증을 마친 것은 아니에요.</p>
  </div>;

  const age = ageGroupOf(birthDate, now);
  const title = mode === 'signin' ? '로그인' : step === 'terms' ? '약관 동의' : step === 'phone' ? '휴대폰 번호 확인' : '기본 정보 입력';

  return (
    <div role="dialog" aria-modal="true" aria-label={mode === 'signin' ? '휴대폰 로그인' : '회원가입'}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6c2cf5] flex items-center justify-center text-white"><ShieldCheck className="w-4 h-4" /></div>
            <h3 className="text-[17px] font-bold text-gray-900">{title}</h3>
          </div>
          <button aria-label="로그인 창 닫기" onClick={close} className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {errorMessage && <div role="alert" className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2 animate-in fade-in"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{errorMessage}</span></div>}
        {infoMessage && <div role="status" className="mx-5 mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700 flex items-start gap-2 animate-in fade-in"><Check className="w-4 h-4 shrink-0 mt-0.5 text-[#6c2cf5]" /><span>{infoMessage}</span></div>}

        {mode === 'signup' && <div>
          <div className="px-5 pt-3 pb-2 flex items-center gap-1.5" aria-hidden>
            {(['terms', 'phone', 'basic'] as SignUpStep[]).map((item, index) => <div key={item} className={`h-1.5 flex-1 rounded-full ${index <= ['terms', 'phone', 'basic'].indexOf(step) ? 'bg-[#6c2cf5]' : 'bg-gray-200'}`} />)}
          </div>
          <p className="px-5 text-[11px] text-gray-400">가입 {['terms', 'phone', 'basic'].indexOf(step) + 1}/3 · 가입 후 사진 → 취미·성향 → 소개 순서로 프로필을 만들어요.</p>

          {step === 'terms' && <div className="p-5 space-y-4">
            <div className="space-y-3 bg-[#f8f9fc] p-4 rounded-2xl">
              <label className="flex items-center gap-3 pb-3 border-b border-gray-200/50 cursor-pointer font-bold text-sm text-gray-900">
                <input type="checkbox" checked={allAgreed} onChange={handleToggleAll} className="w-5 h-5 accent-[#6c2cf5] rounded cursor-pointer" /><span>전체 약관에 동의합니다</span>
              </label>
              {([
                [agreedAge, setAgreedAge, '[필수] 만 19세 이상 성인 본인 확인'],
                [agreedService, setAgreedService, '[필수] 유미당 서비스 이용약관 동의'],
                [agreedPrivacy, setAgreedPrivacy, '[필수] 개인정보 수집 및 이용 동의'],
                [agreedSafety, setAgreedSafety, '[필수] 1:1 동행 안전 수칙 준수 서약'],
              ] as const).map(([checked, set, label]) => <label key={label} className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="w-4 h-4 accent-[#6c2cf5] rounded cursor-pointer" /><span>{label}</span>
              </label>)}
            </div>
            <button disabled={!allAgreed} onClick={() => { setStep('phone'); setInfoMessage(''); }}
              className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-1.5 ${allAgreed ? 'bg-[#6c2cf5] text-white shadow-md shadow-purple-500/20 active:scale-98' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              <span>동의하고 다음으로</span><ArrowRight className="w-4 h-4" />
            </button>
            {!allAgreed && <p className="text-[11px] text-gray-400 text-center">필수 약관 4개에 모두 동의해야 다음으로 갈 수 있어요.</p>}
          </div>}

          {step === 'phone' && <div className="p-5 space-y-4">
            {phoneInput('휴대폰 번호')}
            {otpBlock('인증 확인 및 계속하기')}
            {sampleNotice}
            <button type="button" onClick={() => { setStep('terms'); resetOtp(); setErrorMessage(''); setInfoMessage(''); }} className="text-xs text-gray-500 hover:text-gray-700">&larr; 약관 동의로 돌아가기</button>
          </div>}

          {step === 'basic' && <form onSubmit={handleCompleteSignUp} noValidate className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-name" className="block text-xs font-bold text-gray-700">실명 (한글)</label>
                <span className="text-[11px] font-semibold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded-full">공개 표기: {maskRealName(realName.trim()) || '미입력'}{age ? ` · ${age}` : ''}</span>
              </div>
              {/* Validated on submit only, so Korean IME composition is never interrupted. */}
              <input id="auth-name" type="text" autoComplete="name" aria-label="실명" placeholder="예: 조유미" value={realName}
                onChange={(e) => { setRealName(e.target.value); setErrorMessage(''); }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30 focus:border-[#6c2cf5]" />
              <p className="text-[11px] text-gray-400 mt-1">실명은 공개되지 않고 가운데를 가린 이름으로만 보여요.</p>
            </div>

            <div>
              <label htmlFor="auth-birth" className="block text-xs font-bold text-gray-700 mb-1.5">생년월일</label>
              <input id="auth-birth" type="date" aria-label="생년월일" max={koreaToday(now)} min="1900-01-01" value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); setErrorMessage(''); }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 focus:bg-white text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6c2cf5]/30" />
              <p className="text-[11px] text-gray-400 mt-1">프로필에는 생년월일 대신 연령대만 보여요.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div role="group" aria-label="성별">
                <span className="block text-xs font-bold text-gray-700 mb-1.5">성별</span>
                <div className="flex gap-1.5">
                  {(['female', 'male'] as const).map(g => <button type="button" key={g} aria-pressed={gender === g} onClick={() => { setGender(g); setErrorMessage(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${gender === g ? 'bg-[#f0edff] text-[#6c2cf5] border border-[#6c2cf5]/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{g === 'female' ? '여성' : '남성'}</button>)}
                </div>
              </div>
              <label className="block text-xs font-bold text-gray-700">활동 지역
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="mt-1.5 w-full px-2.5 py-2 rounded-xl bg-gray-50 text-xs font-normal border border-gray-200">
                  {NEIGHBORHOOD_OPTIONS.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>

            {gender === 'male' && <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl space-y-2.5 animate-in fade-in">
              <p className="text-xs font-bold text-blue-950">남성 회원 가입 확인 방법</p>
              <div role="radiogroup" aria-label="남성 가입 확인 방법" className="grid grid-cols-2 gap-1.5">
                {([['referral', '추천인 코드', Key], ['work_email', '학교·직장 이메일', Mail]] as const).map(([value, label, Icon]) => <button key={value} type="button" role="radio" aria-checked={maleRoute === value}
                  onClick={() => { setMaleRoute(value); setErrorMessage(''); }}
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold border ${maleRoute === value ? 'bg-white border-blue-500 text-blue-700' : 'bg-blue-50 border-blue-100 text-blue-900/70'}`}><Icon size={13} />{label}</button>)}
              </div>
              {maleRoute === 'referral' ? <div className="relative">
                <input type="text" aria-label="추천인 코드" placeholder="예: SAFE-7788" value={referralCode}
                  onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setErrorMessage(''); }}
                  className="w-full pl-3 pr-24 py-2.5 rounded-xl bg-white text-xs border border-blue-200 font-mono tracking-wider" />
                <button type="button" onClick={() => { setReferralCode('SAFE-7788'); setErrorMessage(''); }} className="absolute right-1.5 top-1.5 px-2.5 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">예시 코드 입력</button>
              </div> : <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input type="email" aria-label="학교·직장 이메일" placeholder="name@company.co.kr" value={workEmail}
                    onChange={(e) => { setWorkEmail(e.target.value); setEmailSent(false); setEmailCode(''); setErrorMessage(''); }}
                    className="min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-white text-xs border border-blue-200" />
                  <button type="button" onClick={handleSendEmail} className="shrink-0 px-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold">{emailSent ? '다시 보내기' : '확인 메일 보내기'}</button>
                </div>
                {emailSent && <input type="text" inputMode="numeric" aria-label="이메일 확인 코드" placeholder="확인 코드 6자리" value={emailCode} maxLength={6}
                  onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white text-xs border border-blue-200 tracking-widest font-mono" />}
              </div>}
              <p className="text-[11px] text-blue-800/90 leading-snug">체험 화면이에요. 실제 추천인 코드 조회나 메일 발송은 하지 않아요.</p>
            </div>}

            <div className="p-3.5 bg-[#f8f6ff] rounded-2xl flex items-center justify-between text-xs">
              <div><span className="font-bold text-gray-900 block">신규 시작 당도</span><span className="text-[11px] text-gray-500">합산·하한·갱신 방식은 논의 중이에요</span></div>
              <span className="font-extrabold text-[#6c2cf5] text-sm bg-white px-2.5 py-1 rounded-lg shadow-2xs">{NEW_USER_SUGAR} 🍯</span>
            </div>

            <button type="submit" className="w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all">가입하고 프로필 만들기</button>
          </form>}
        </div>}

        {mode === 'signin' && <div className="p-5 space-y-4">
          {phoneInput('가입된 휴대폰 번호')}
          {otpBlock('인증 확인 및 로그인')}
          {sampleNotice}
          <p className="text-[11px] text-gray-400">예시 회원 조*미의 번호가 채워져 있어요. 새로 가입한 번호로도 로그인할 수 있어요.</p>
          <div className="pt-2 text-center">
            <button type="button" onClick={() => resetForm('signup')} className="text-xs text-gray-500 hover:text-[#6c2cf5] font-medium">
              계정이 없으신가요? <span className="underline font-bold text-[#6c2cf5]">휴대폰 본인인증으로 가입</span>
            </button>
          </div>
        </div>}
        {mode === 'signup' && <div className="pb-5 text-center"><button type="button" onClick={() => resetForm('signin')} className="text-xs text-gray-500">이미 계정이 있으신가요? <span className="text-[#6c2cf5] font-bold underline">로그인으로 돌아가기</span></button></div>}
      </div>
    </div>
  );
};
