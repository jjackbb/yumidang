import React, { useState, useLayoutEffect } from 'react';
import { X, Lock, Sparkles, ShieldCheck, AlertCircle, CalendarHeart } from 'lucide-react';
import { ABVariant, MeetupPost, CurrentUser } from '../types';
import { avatarSrc } from '../utils/profile';
import {
  PARTNER_GENDERS, POST_CATEGORIES, POST_FORM_STEPS, defaultPostForm, postFieldsFromForm, postFormFromPost, validatePostForm,
  type PostFormErrors, type PostFormField, type PostFormValues,
} from '../utils/postForm';

interface CreateMeetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMeetup: (newPost: MeetupPost) => boolean;
  onUpdatePost?: (updatedPost: MeetupPost) => boolean;
  editPost?: MeetupPost | null;
  currentUser: CurrentUser | null;
  /** Prototype clock (shifted in the demo); used for past-schedule and deadline checks. */
  now: Date;
  /** 04 A: one sheet, 04 B: two steps. Same fields, validation and saved result. */
  variant: ABVariant;
  showVariantLabel?: boolean;
  initialCategory?: string;
  /** Post created from an event detail keeps that eventId only. */
  linkedEvent?: { id: string; title: string } | null;
}

const FIELD_IDS: Record<PostFormField, string> = {
  title: 'meetup-title', category: 'meetup-category', description: 'meetup-description',
  startDate: 'meetup-start-date', startTime: 'meetup-start-time', endDate: 'meetup-end-date', endTime: 'meetup-end-time',
  deadline: 'meetup-deadline', location: 'meetup-location', publicLocation: 'meetup-public-location',
  secretLocation: 'meetup-secret-location', partnerGender: 'meetup-partner-gender', partnerPreferences: 'meetup-partner-preferences', tags: 'meetup-tags',
};
const inputClass = 'w-full px-3 py-2 rounded-xl bg-gray-50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-300';

export const CreateMeetupModal: React.FC<CreateMeetupModalProps> = ({
  isOpen, onClose, onCreateMeetup, onUpdatePost, editPost, currentUser, now, variant, showVariantLabel = false, initialCategory, linkedEvent,
}) => {
  const [values, setValues] = useState<PostFormValues>(() => defaultPostForm(now));
  const [errors, setErrors] = useState<PostFormErrors>({});
  const [step, setStep] = useState(0);

  // Paid option is a separate preview experience, not part of the shared field contract.
  const [companionType, setCompanionType] = useState<'free' | 'pro'>('free');
  const [showProRequirementModal, setShowProRequirementModal] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(25000);
  const [specialty, setSpecialty] = useState<string>('스냅 촬영 & 감성 보정');
  const [curriculum, setCurriculum] = useState<string>('10분: 촬영 컨셉 상담\n40분: 스냅 촬영\n10분: 사진 모니터링');
  const [included, setIncluded] = useState<string>('보정본 10장, 원본 전체');
  const [excluded, setExcluded] = useState<string>('카페 음료비 개인 부담');

  const isEditing = Boolean(editPost);
  const eventTitle = linkedEvent?.title;

  useLayoutEffect(() => {
    setErrors({}); setStep(0);
    setValues(editPost ? postFormFromPost(editPost, now) : defaultPostForm(now, initialCategory || '식사'));
    setCompanionType(editPost?.companionType || 'free');
    if (editPost?.proDetails) {
      setHourlyRate(editPost.proDetails.hourlyRate);
      setSpecialty(editPost.proDetails.specialty);
      setCurriculum(editPost.proDetails.curriculum.join('\n'));
      setIncluded(editPost.proDetails.included.join(', '));
      setExcluded(editPost.proDetails.excluded.join(', '));
    }
  }, [editPost, isOpen]);

  if (!isOpen) return null;

  const set = <K extends PostFormField>(field: K, value: PostFormValues[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev }; delete next[field]; return next;
    });
  };
  const fieldProps = (field: PostFormField) => ({
    id: FIELD_IDS[field],
    'aria-invalid': Boolean(errors[field]) || undefined,
    'aria-describedby': errors[field] ? `${FIELD_IDS[field]}-error` : undefined,
  });
  const errorOf = (field: PostFormField) => errors[field]
    ? <p id={`${FIELD_IDS[field]}-error`} role="alert" data-field-error={field} className="text-[11px] text-red-600 mt-1">{errors[field]}</p>
    : null;
  const focusFirst = (found: PostFormErrors) => {
    const first = (Object.keys(FIELD_IDS) as PostFormField[]).find(field => found[field]);
    if (first) requestAnimationFrame(() => document.getElementById(FIELD_IDS[first])?.focus());
  };

  const handleSelectProType = () => {
    // PRO 전문 동행 개설 조건: 당도 90 이상 및 본인인증 완료
    const isEligible = currentUser && currentUser.sugarContent >= 90 && currentUser.isPhoneVerified;
    if (!isEligible) { setShowProRequirementModal(true); return; }
    setCompanionType('pro');
  };

  const goNext = () => {
    const found = validatePostForm(values, now, POST_FORM_STEPS[0]);
    setErrors(found);
    if (Object.keys(found).length) { focusFirst(found); return; }
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (variant === 'B' && step === 0) { goNext(); return; }
    const found = validatePostForm(values, now);
    setErrors(found);
    if (Object.keys(found).length) {
      if (variant === 'B' && POST_FORM_STEPS[0].some(field => found[field])) setStep(0);
      focusFirst(found);
      return;
    }
    const fields = postFieldsFromForm(values);
    if (companionType === 'pro' && !fields.tags.includes('PRO전문동행')) fields.tags.unshift('PRO전문동행');
    const proDetails = companionType === 'pro' ? {
      hourlyRate: Number(hourlyRate) || 25000,
      specialty: specialty.trim() || '맞춤 전문 동행',
      curriculum: curriculum.split('\n').map((s) => s.trim()).filter(Boolean),
      included: included.split(',').map((s) => s.trim()).filter(Boolean),
      excluded: excluded.split(',').map((s) => s.trim()).filter(Boolean),
    } : undefined;

    if (isEditing && editPost && onUpdatePost) {
      if (!onUpdatePost({ ...editPost, ...fields, companionType, proDetails })) return;
    } else {
      if (!currentUser) return;
      const newPost: MeetupPost = {
        id: `post-${crypto.randomUUID()}`,
        author: currentUser.maskedName, authorId: currentUser.id, avatar: avatarSrc(currentUser.avatar),
        ...fields,
        eventId: linkedEvent?.id,
        currentMembers: 1, maxMembers: 2, // 1:1 동행 2인 고정
        status: 'recruiting', companionType, proDetails,
      };
      if (!onCreateMeetup(newPost)) return;
    }
    onClose();
  };

  const startKey = `${values.startDate}T${values.startTime}`;

  const basics = <>
    <div>
      <span id={FIELD_IDS.category} tabIndex={-1} className="block text-xs font-bold text-gray-600 mb-1.5">카테고리 선택</span>
      <div role="radiogroup" aria-labelledby={FIELD_IDS.category} className="flex flex-wrap gap-1.5">
        {POST_CATEGORIES.map((cat) => (
          <button type="button" role="radio" aria-checked={values.category === cat} key={cat} onClick={() => set('category', cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${values.category === cat ? 'bg-[#6c2cf5] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      {errorOf('category')}
    </div>
    <div>
      <label htmlFor={FIELD_IDS.title} className="block text-xs font-bold text-gray-600 mb-1.5">모집 제목</label>
      <input type="text" {...fieldProps('title')} placeholder="예: 주말 삼청동 한옥 카페 디저트 투어 1:1 동행 가실 분!" value={values.title} onChange={(e) => set('title', e.target.value)} className={`${inputClass} text-sm py-2.5`} />
      {errorOf('title')}
    </div>
    <div>
      <label htmlFor={FIELD_IDS.description} className="block text-xs font-bold text-gray-600 mb-1.5">동행 상세 소개</label>
      <textarea {...fieldProps('description')} rows={4} value={values.description} onChange={e => set('description', e.target.value)} placeholder="무엇을 함께할지, 활동 순서와 준비물 등을 알려주세요." className={`${inputClass} text-sm p-3`} />
      {errorOf('description')}
    </div>
  </>;

  const schedule = <>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor={FIELD_IDS.startDate} className="block text-xs font-bold text-gray-600 mb-1.5">시작 날짜</label>
        <input type="date" {...fieldProps('startDate')} aria-label="시작 날짜" value={values.startDate}
          onChange={(e) => { if (values.endDate === values.startDate) set('endDate', e.target.value); set('startDate', e.target.value); }} className={inputClass} />
      </div>
      <div>
        <label htmlFor={FIELD_IDS.startTime} className="block text-xs font-bold text-gray-600 mb-1.5">시작 시각</label>
        <input type="time" {...fieldProps('startTime')} aria-label="시작 시각" value={values.startTime} onChange={(e) => { set('startTime', e.target.value); set('startDate', values.startDate); }} className={inputClass} />
      </div>
    </div>
    {errorOf('startDate')}
    <div className="grid grid-cols-2 gap-2">
      <div><label htmlFor={FIELD_IDS.endDate} className="block text-xs font-bold text-gray-600 mb-1.5">종료 날짜</label><input type="date" {...fieldProps('endDate')} min={values.startDate} value={values.endDate} onChange={e => set('endDate', e.target.value)} className={inputClass} /></div>
      <div><label htmlFor={FIELD_IDS.endTime} className="block text-xs font-bold text-gray-600 mb-1.5">종료 시각</label><input type="time" {...fieldProps('endTime')} value={values.endTime} onChange={e => { set('endTime', e.target.value); set('endDate', values.endDate); }} className={inputClass} /></div>
    </div>
    {errorOf('endDate')}
    <p className="text-xs text-gray-500">공고에 정한 종료 시각부터 동행 완료·평가가 가능해요.</p>
    <label className="block text-xs font-bold text-gray-600">모집 마감 날짜·시각
      <input type="datetime-local" {...fieldProps('deadline')} value={values.deadline || startKey} max={startKey} onChange={event => set('deadline', event.target.value === startKey ? '' : event.target.value)} className={`${inputClass} block p-3 mt-2 font-normal`} />
    </label>
    {errorOf('deadline')}
    <p className="text-[11px] text-gray-500">기본값은 동행 시작 시각이에요. 이 시각부터 새 신청과 미확정 신청의 수락이 종료됩니다. 모집 마감은 동행 완료가 아니에요.</p>
  </>;

  const place = <>
    <div>
      <span className="block text-xs font-bold text-gray-600 mb-1">공개 만남 지역 (누구나 열람 가능)</span>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" {...fieldProps('location')} aria-label="공개 만남 지역" placeholder="지역구 (예: 서울 종로구)" value={values.location} onChange={(e) => set('location', e.target.value)} className={inputClass} />
        <input type="text" {...fieldProps('publicLocation')} aria-label="공개 랜드마크" placeholder="공개 랜드마크 (예: 안국역 2번 출구)" value={values.publicLocation} onChange={(e) => set('publicLocation', e.target.value)} className={inputClass} />
      </div>
      {errorOf('location')}{errorOf('publicLocation')}
    </div>
    <div className="p-3.5 bg-purple-50/50 rounded-2xl space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={FIELD_IDS.secretLocation} className="text-xs font-bold text-gray-700 flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-[#6c2cf5]" /><span>확정자 전용 상세 장소</span>
        </label>
        <span className="text-[10px] font-bold text-[#6c2cf5] bg-[#f0edff] px-2 py-0.5 rounded">확정 시에만 공개</span>
      </div>
      <input type="text" {...fieldProps('secretLocation')} placeholder="예: 어니언 안국 3번 야외 테이블, 카페 2층 카운터 앞" value={values.secretLocation} onChange={(e) => set('secretLocation', e.target.value)} className={`${inputClass} bg-white`} />
      <p className="text-[10px] text-gray-500 leading-tight">매칭이 확정된 파트너 1인에게만 공개돼요. 모집을 마감해도 공개되지 않아요.</p>
    </div>
  </>;

  const partner = <>
    <fieldset>
      <legend className="block text-xs font-bold text-gray-600 mb-1.5">상대 성별 조건</legend>
      <div role="radiogroup" id={FIELD_IDS.partnerGender} tabIndex={-1} aria-label="상대 성별 조건" className="grid grid-cols-3 gap-1.5">
        {PARTNER_GENDERS.map(option => (
          <button type="button" role="radio" key={option.value} aria-checked={values.partnerGender === option.value} onClick={() => set('partnerGender', option.value)}
            className={`py-2 rounded-xl text-xs font-semibold ${values.partnerGender === option.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{option.label}</button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 mt-1">조건에 맞는 회원만 신청할 수 있고, 맞지 않는 회원에게는 이유를 안내해요.</p>
      {errorOf('partnerGender')}
    </fieldset>
    <div>
      <label htmlFor={FIELD_IDS.partnerPreferences} className="block text-xs font-bold text-gray-600 mb-1.5">동행 파트너에게 바라는 점 / 사전 질문</label>
      <textarea {...fieldProps('partnerPreferences')} rows={2} placeholder="예: 편안한 분위기 좋아하시는 분, 비흡연자 선호합니다." value={values.partnerPreferences} onChange={(e) => set('partnerPreferences', e.target.value)} className={`${inputClass} resize-none`} />
    </div>
    <div>
      <label htmlFor={FIELD_IDS.tags} className="block text-xs font-bold text-gray-600 mb-1.5">태그 (공백으로 구분)</label>
      <input type="text" {...fieldProps('tags')} placeholder="#주말 #맛집탐방 #동네친구" value={values.tags} onChange={(e) => set('tags', e.target.value)} className={inputClass} />
    </div>
  </>;

  const companion = <div>
    <span className="block text-xs font-bold text-gray-700 mb-1.5">동행 유형 선택</span>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={companionType === 'free'} onClick={() => setCompanionType('free')}
        className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${companionType === 'free' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'}`}>
        <span>☕ 일반 취향 동행</span><span className="text-[10px] font-normal opacity-80">(무료/각자)</span>
      </button>
      <button type="button" aria-pressed={companionType === 'pro'} onClick={handleSelectProType}
        className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${companionType === 'pro' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'bg-purple-50 text-purple-700 hover:bg-purple-100/70'}`}>
        <span>💎 PRO 전문 동행</span><span className="text-[10px] font-normal opacity-90">(유료 체험)</span>
      </button>
    </div>
    {companionType === 'pro' && (
      <div className="mt-3 p-4 bg-purple-50/70 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-950 flex items-center gap-1"><Sparkles size={14} className="text-[#6c2cf5]" /><span>PRO 유료 옵션 체험 정보</span></span>
          <span className="text-[10px] font-bold bg-white text-[#6c2cf5] px-2 py-0.5 rounded-full">실제 결제 없음</span>
        </div>
        <label className="block text-[11px] font-bold text-gray-700">시간당 희망 비용 (원)
          <input type="number" step="5000" min="10000" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="mt-1 w-full px-3.5 py-2 rounded-xl bg-white text-xs font-bold text-gray-900" />
        </label>
        <label className="block text-[11px] font-bold text-gray-700">전문 분야 / 스킬 타이틀
          <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 w-full px-3.5 py-2 rounded-xl bg-white text-xs text-gray-800" />
        </label>
        <label className="block text-[11px] font-bold text-gray-700">활동 커리큘럼 (줄바꿈으로 구분)
          <textarea rows={2} value={curriculum} onChange={(e) => setCurriculum(e.target.value)} className="mt-1 w-full px-3.5 py-2 rounded-xl bg-white text-xs text-gray-800 resize-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-bold text-gray-700">포함 내역 (쉼표 구분)<input type="text" value={included} onChange={(e) => setIncluded(e.target.value)} className="mt-1 w-full px-3 py-1.5 rounded-xl bg-white text-[11px] text-gray-800" /></label>
          <label className="block text-[11px] font-bold text-gray-700">불포함 내역 (쉼표 구분)<input type="text" value={excluded} onChange={(e) => setExcluded(e.target.value)} className="mt-1 w-full px-3 py-1.5 rounded-xl bg-white text-[11px] text-gray-800" /></label>
        </div>
      </div>
    )}
  </div>;

  const summary = <section aria-label="1단계 입력 확인" className="rounded-2xl bg-gray-50 p-3 text-[11px] text-gray-600 space-y-1">
    <div className="flex items-center justify-between"><b className="text-gray-800">1단계 입력 내용</b><button type="button" onClick={() => setStep(0)} className="text-[#6c2cf5] font-bold">수정</button></div>
    <p className="truncate">[{values.category}] {values.title}</p>
    <p>{values.startDate} {values.startTime} ~ {values.endDate} {values.endTime} · 마감 {values.deadline ? values.deadline.replace('T', ' ') : '시작 시각과 같음'}</p>
  </section>;

  const submitLabel = isEditing ? '공고 수정 완료' : '1:1 동행 등록 완료';

  return (
    <div role="dialog" aria-modal="true" aria-label={isEditing ? '동행 공고 수정' : '동행 공고 작성'} data-post-form-variant={variant} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold text-gray-900">{isEditing ? '1:1 동행 공고 수정' : '새 1:1 동행 모집하기'}</h3>
            {variant === 'B' && <p className="text-[11px] text-gray-500" data-form-step={step + 1}>{step + 1}/2 단계 · {step === 0 ? '기본 정보·일정' : '장소·상대 조건'}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showVariantLabel && <span className="text-[10px] font-bold rounded bg-amber-100 text-amber-900 px-1.5 py-0.5">04 {variant}안</span>}
            <button type="button" onClick={onClose} aria-label="공고 작성 창 닫기" className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-5 space-y-4">
          {(!isEditing || step === 0) && <div className="p-3.5 bg-[#f0edff] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#6c2cf5] text-white flex items-center justify-center text-xs font-bold shadow-xs">1:1</div>
              <div>
                <span className="text-xs font-bold text-gray-900 block">1대1 맞춤 동행 · 등록 즉시 전체 공개</span>
                <span className="text-[11px] text-gray-500">나 + 동행 파트너 1명 (총 2인 정원 고정)</span>
              </div>
            </div>
          </div>}
          {(eventTitle || editPost?.eventId) && <p data-linked-event={linkedEvent?.id || editPost?.eventId} className="flex items-center gap-1.5 rounded-xl bg-rose-50 text-rose-900 text-xs p-3">
            <CalendarHeart size={14} className="shrink-0" /><span>연결 행사: <b>{eventTitle || '행사 연결 공고'}</b> · 이 행사의 관련 공고에만 표시돼요</span>
          </p>}

          {variant === 'A' || step === 0 ? <>{basics}{schedule}</> : summary}
          {(variant === 'A' || step === 1) && <>{place}{partner}{companion}</>}
          {isEditing && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl p-3">일정·장소·활동 내용이나 상대 조건을 바꾸면 기존 신청자에게 다시 확인을 받아요. 동의만으로 확정되지 않고 작성자 수락이 필요해요. 확정된 동행은 채팅의 변경 제안을 이용해 주세요.</p>}
          {Object.keys(errors).length > 0 && <p className="text-xs text-red-600" data-form-error-count={Object.keys(errors).length}>입력 내용을 확인해 주세요. 표시된 항목 {Object.keys(errors).length}개를 고치면 저장할 수 있어요.</p>}

          <div className="pt-2 flex gap-2">
            {/* Distinct keys: reusing one <button> node would turn the "다음" click into a form submit once step 2 renders. */}
            {variant === 'B' && step === 1 && <button key="previous" type="button" onClick={() => setStep(0)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm">이전</button>}
            {variant === 'B' && step === 0
              ? <button key="next" type="button" onClick={goNext} className="w-full py-3.5 bg-[#6c2cf5] text-white font-bold rounded-xl text-[15px]">다음</button>
              : <button key="submit" type="submit" className="flex-[2] w-full py-3.5 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-[15px] shadow-md shadow-purple-500/25 active:scale-98 transition-all">{submitLabel}</button>}
          </div>
        </form>
      </div>

      {showProRequirementModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-label="PRO 전문 동행 개설 안내" className="bg-white w-full max-w-[360px] rounded-3xl p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-inner"><Sparkles className="w-7 h-7" /></div>
            <h4 className="text-lg font-bold text-gray-900 mb-1.5">PRO 전문 동행 개설 안내</h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">유료 옵션은 별도 체험이에요. 개설 기준은 예시이며 실제 결제·정산은 연결되지 않아요.</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-5 text-left text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><ShieldCheck className={`w-4 h-4 ${currentUser?.isPhoneVerified ? 'text-emerald-500' : 'text-gray-400'}`} /><span className="font-medium text-gray-700">휴대폰 본인확인</span></div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${currentUser?.isPhoneVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-600'}`}>{currentUser?.isPhoneVerified ? '인증 완료' : '미완료'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-sm">🍯</span><span className="font-medium text-gray-700">당도 90 이상 (예시 기준)</span></div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${(currentUser?.sugarContent || 0) >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>현재 {currentUser?.sugarContent ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-purple-400" /><span className="font-medium text-gray-700">일반 동행 완료 이력</span></div>
                <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">논의 중</span>
              </div>
            </div>
            <button type="button" onClick={() => { setShowProRequirementModal(false); setCompanionType('free'); }} className="w-full py-3 bg-[#6c2cf5] hover:bg-[#5820d8] text-white font-bold rounded-xl text-sm">일반 취향 동행으로 모집하기</button>
          </div>
        </div>
      )}
    </div>
  );
};
