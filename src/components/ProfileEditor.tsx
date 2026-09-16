import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Check, X } from 'lucide-react';
import type { ABVariant, CurrentUser, PublicUserProfile } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { resizePhoto } from '../utils/imageResize';
import {
  BIO_MAX_CHARS, HOBBY_OPTIONS, MAX_HOBBIES, MAX_TRAITS, NEIGHBORHOOD_OPTIONS, TRAIT_OPTIONS,
  hasUsablePhoto, missingProfileSteps, validateBio, validatePhotoFile, type ProfileStep,
} from '../utils/profile';

export type ProfilePatch = Partial<Pick<CurrentUser, 'avatar' | 'hobbies' | 'traits' | 'bio' | 'neighborhood'>>;
type SetupStep = ProfileStep | 'review';
const SETUP_STEPS: SetupStep[] = ['photo', 'interests', 'bio', 'review'];
const stepTitle: Record<SetupStep, string> = { photo: '프로필 사진', interests: '취미·성향', bio: '자기소개', review: '확인 및 저장' };

interface ProfileEditorProps {
  user: CurrentUser;
  /** setup: short steps after first signup/login, each step saved. edit: Me editing with one save. */
  mode: 'setup' | 'edit';
  variant: ABVariant;
  showVariantLabel?: boolean;
  initialStep?: ProfileStep;
  /** Why setup opened, e.g. an apply attempt with an unfinished profile. */
  reason?: string;
  previewOf: (patch: ProfilePatch) => PublicUserProfile;
  onCommit: (patch: ProfilePatch) => void | boolean | Promise<boolean>;
  onClose: () => void;
  onDone: () => void;
}

export function ProfileEditor({ user, mode, variant, showVariantLabel, initialStep, reason, previewOf, onCommit, onClose, onDone }: ProfileEditorProps) {
  const [step, setStep] = useState<SetupStep>(initialStep || 'photo');
  const [reasonText, setReasonText] = useState(reason || '');
  const [hobbies, setHobbies] = useState<string[]>(user.hobbies || []);
  const [traits, setTraits] = useState<string[]>(user.traits || []);
  const [bio, setBio] = useState(user.bio || '');
  const [neighborhood, setNeighborhood] = useState(user.neighborhood || NEIGHBORHOOD_OPTIONS[0]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [step]);

  const draft: ProfilePatch = { hobbies, traits, bio, neighborhood };
  const hasPhoto = hasUsablePhoto(user.avatar);
  const dirty = JSON.stringify(draft) !== JSON.stringify({ hobbies: user.hobbies || [], traits: user.traits || [], bio: user.bio || '', neighborhood: user.neighborhood || NEIGHBORHOOD_OPTIONS[0] });

  const choosePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setNotice('');
    const invalid = validatePhotoFile(file);
    if (invalid) { setError(invalid); return; }
    setPhotoBusy(true); setError('');
    try {
      setPendingPhoto(await resizePhoto(file));
    } catch {
      setError('사진을 읽지 못했어요. 파일이 손상되지 않았는지 확인하고 다시 선택해 주세요.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const savePhoto = async () => {
    if (!pendingPhoto) return;
    if (await onCommit({ avatar: pendingPhoto }) === false) { setError('사진을 저장하지 못했어요. 다시 시도해 주세요.'); return; }
    setPendingPhoto(null); setError(''); setNotice('사진을 저장했어요.');
  };
  const deletePhoto = async () => {
    if (await onCommit({ avatar: '' }) === false) { setError('사진을 삭제하지 못했어요.'); return; }
    setConfirmDelete(false); setNotice('사진을 삭제했어요. 프로필 사진은 필수라 새 사진을 등록해 주세요.');
  };
  const toggle = (list: string[], set: (next: string[]) => void, value: string, max: number, label: string) => {
    setNotice('');
    if (list.includes(value)) { set(list.filter(item => item !== value)); setError(''); return; }
    if (list.length >= max) { setError(`${label}은 최대 ${max}개까지 고를 수 있어요.`); return; }
    set([...list, value]); setError('');
  };

  const checkPhoto = () => pendingPhoto ? '미리보기 중인 사진을 먼저 저장하거나 다시 선택해 주세요.' : hasPhoto ? null : '프로필 사진을 등록해 주세요. JPG·JPEG·PNG, 10MB 이하.';
  const checkInterests = () => !hobbies.length ? '취미를 1개 이상 골라 주세요.' : !traits.length ? '성향을 1개 이상 골라 주세요.' : null;

  const next = async () => {
    setNotice(''); setReasonText('');
    const problem = step === 'photo' ? checkPhoto() : step === 'interests' ? checkInterests() : step === 'bio' ? validateBio(bio) : null;
    if (problem) { setError(problem); return; }
    setError('');
    if (step === 'interests' && await onCommit({ hobbies, traits, neighborhood }) === false) { setError('저장하지 못했어요. 다시 시도해 주세요.'); return; }
    if (step === 'bio' && await onCommit({ bio: bio.trim() }) === false) { setError('저장하지 못했어요. 다시 시도해 주세요.'); return; }
    if (step === 'review') {
      const missing = missingProfileSteps({ ...user, ...draft, bio: bio.trim() });
      if (missing.length) { setStep(missing[0]); setError('아직 채우지 않은 필수 항목이 있어요.'); return; }
      onDone(); return;
    }
    setStep(SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1]);
  };
  const saveEdit = async () => {
    setNotice('');
    const problem = checkPhoto() || checkInterests() || validateBio(bio);
    if (problem) { setError(problem); return; }
    if (await onCommit({ ...draft, bio: bio.trim() }) === false) { setError('저장하지 못했어요. 다시 시도해 주세요.'); return; }
    setError(''); onDone();
  };
  const requestClose = () => { if (mode === 'edit' && dirty) setConfirmDiscard(true); else onClose(); };

  const photoSection = <section aria-label="프로필 사진" className="space-y-3">
    <div className="flex flex-col items-center gap-2">
      <img src={pendingPhoto || (hasPhoto ? user.avatar : undefined) || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='} alt={pendingPhoto ? '선택한 사진 미리보기' : hasPhoto ? '저장된 프로필 사진' : ''}
        className={`w-28 h-28 rounded-full object-cover ring-4 ${pendingPhoto ? 'ring-amber-200' : 'ring-purple-100'} bg-[#ede9fe]`} />
      <p data-photo-state={pendingPhoto ? 'preview' : hasPhoto ? 'saved' : 'empty'} className="text-[11px] text-gray-500">
        {photoBusy ? '사진을 준비하는 중…' : pendingPhoto ? '미리보기 · 아직 저장되지 않았어요' : hasPhoto ? '저장된 사진' : '등록된 사진이 없어요 (필수)'}
      </p>
    </div>
    <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" aria-label="프로필 사진 파일 선택" className="sr-only" onChange={choosePhoto} />
    {pendingPhoto ? <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => { setPendingPhoto(null); fileRef.current?.click(); }} className="rounded-xl bg-gray-100 py-2.5 text-xs font-bold">다시 선택</button>
      <button type="button" onClick={savePhoto} className="rounded-xl bg-[#6c2cf5] text-white py-2.5 text-xs font-bold">이 사진으로 저장</button>
    </div> : hasPhoto ? <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-gray-100 py-2.5 text-xs font-bold flex items-center justify-center gap-1"><Camera size={13} />사진 변경</button>
      <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-xl bg-rose-50 text-rose-600 py-2.5 text-xs font-bold">사진 삭제</button>
    </div> : <button type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-[#6c2cf5] text-white py-3 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"><Camera size={15} />사진 등록</button>}
    {confirmDelete && <div role="alertdialog" aria-label="사진 삭제 확인" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs space-y-2">
      <p>사진을 삭제하면 새 사진을 등록할 때까지 프로필이 미완성으로 표시되고 신청·공고 작성이 제한돼요.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg bg-white border px-3 py-1.5">취소</button><button type="button" onClick={deletePhoto} className="rounded-lg bg-rose-600 text-white px-3 py-1.5 font-bold">삭제하기</button></div>
    </div>}
    <p className="text-[11px] text-gray-400">JPG·JPEG·PNG, 10MB 이하. 원본 대신 작게 줄인 사진을 프로필에 저장해요.</p>
  </section>;

  const chipGroup = (label: string, options: string[], list: string[], set: (next: string[]) => void, max: number) => <fieldset>
    <legend className="text-sm font-bold mb-2">{label} <span className="text-[11px] font-normal text-gray-400">{list.length}/{max} · 1개 이상</span></legend>
    <div className="flex flex-wrap gap-1.5">{options.map(option => <button key={option} type="button" aria-pressed={list.includes(option)} onClick={() => toggle(list, set, option, max, label)}
      className={`rounded-full px-3 py-1.5 text-xs border ${list.includes(option) ? 'bg-[#6c2cf5] text-white border-[#6c2cf5]' : 'bg-white border-gray-200 text-gray-700'}`}>{option}</button>)}</div>
  </fieldset>;

  const interestsSection = <section aria-label="취미와 성향" className="space-y-4">
    {chipGroup('취미', HOBBY_OPTIONS, hobbies, setHobbies, MAX_HOBBIES)}
    {chipGroup('성향', TRAIT_OPTIONS, traits, setTraits, MAX_TRAITS)}
    <label className="block text-sm font-bold">활동 지역
      <select value={neighborhood} onChange={event => setNeighborhood(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-normal">
        {NEIGHBORHOOD_OPTIONS.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  </section>;

  const over = bio.length > BIO_MAX_CHARS;
  const bioSection = <section aria-label="자기소개 작성" className="space-y-1.5">
    <label htmlFor="profile-bio" className="block text-sm font-bold">자기소개</label>
    <textarea id="profile-bio" rows={6} value={bio} aria-invalid={over} onChange={event => { setBio(event.target.value); setError(''); setNotice(''); }}
      placeholder="어떤 동행을 좋아하는지 편하게 적어 주세요. 연락처·메신저 아이디는 적을 수 없어요."
      className={`w-full rounded-xl border px-3 py-2.5 text-sm bg-gray-50 focus:bg-white ${over ? 'border-rose-400' : 'border-gray-200'}`} />
    <p data-bio-count className={`text-right text-[11px] ${over ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>{bio.length}/{BIO_MAX_CHARS}</p>
  </section>;

  const reviewSection = <section aria-label="입력 내용 확인" className="space-y-3 text-sm">
    <div className="flex items-center gap-3"><img src={user.avatar} alt="저장된 프로필 사진" className="w-14 h-14 rounded-full object-cover" /><div><b>{user.maskedName}</b><p className="text-xs text-gray-500">{previewOf(draft).ageGroup} · {neighborhood}</p></div></div>
    <p className="text-xs"><b>취미</b> {hobbies.join(', ')}</p>
    <p className="text-xs"><b>성향</b> {traits.join(', ')}</p>
    <p className="text-xs whitespace-pre-wrap text-gray-600"><b className="text-gray-900">소개</b> {bio}</p>
    <p className="text-[11px] text-gray-500">신규 당도 15에서 시작해요. 인증 배지는 실제 인증을 마친 경우에만 표시돼요.</p>
  </section>;

  const current = SETUP_STEPS.indexOf(step);
  return <>
    <div role="dialog" aria-modal="true" aria-label={mode === 'setup' ? '프로필 만들기' : '프로필 편집'} data-profile-editor={mode} inert={previewOpen}
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      onKeyDown={event => { if (event.key === 'Escape' && !previewOpen) { event.stopPropagation(); requestClose(); } }}>
      <div className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] overflow-y-auto text-left shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 ref={titleRef} tabIndex={-1} className="text-[17px] font-bold outline-none">
            {mode === 'setup' ? `프로필 만들기 · ${current + 1}/${SETUP_STEPS.length} ${stepTitle[step]}` : '프로필 편집'}
          </h3>
          <button type="button" aria-label={mode === 'setup' ? '프로필 만들기 닫기' : '프로필 편집 닫기'} onClick={requestClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        {mode === 'setup' && <div className="px-5 pt-3 flex gap-1.5" aria-hidden>{SETUP_STEPS.map((item, index) => <div key={item} className={`h-1.5 flex-1 rounded-full ${index <= current ? 'bg-[#6c2cf5]' : 'bg-gray-200'}`} />)}</div>}
        {reasonText && <div role="alert" data-profile-reason className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-950 flex gap-2"><AlertCircle size={15} className="shrink-0" /><span>{reasonText}</span></div>}
        {error && <div role="alert" className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex gap-2"><AlertCircle size={15} className="shrink-0" /><span>{error}</span></div>}
        {notice && <p role="status" className="mx-5 mt-4 p-3 bg-purple-50 rounded-xl text-xs text-purple-700 flex gap-2"><Check size={15} className="shrink-0" />{notice}</p>}
        <div className="p-5 space-y-6">
          {mode === 'setup' ? <>
            {step === 'photo' && photoSection}
            {step === 'interests' && interestsSection}
            {step === 'bio' && bioSection}
            {step === 'review' && reviewSection}
            <button type="button" onClick={() => setPreviewOpen(true)} className="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700">공개 프로필 미리보기</button>
            <div className="flex gap-2">
              {current > 0 && <button type="button" onClick={() => { setError(''); setStep(SETUP_STEPS[current - 1]); }} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-bold">이전</button>}
              <button type="button" onClick={next} className="flex-[2] rounded-xl bg-[#6c2cf5] text-white py-3 text-sm font-bold">{step === 'review' ? '프로필 저장하고 시작하기' : '다음'}</button>
            </div>
            <button type="button" onClick={onClose} className="w-full text-xs text-gray-500 underline">나중에 이어서 하기</button>
            <p className="text-[11px] text-gray-400 text-center">완성 전에는 신청·공고 작성이 제한돼요. Me에서 이어서 작성할 수 있어요.</p>
          </> : <>
            {photoSection}{interestsSection}{bioSection}
            {confirmDiscard && <div role="alertdialog" aria-label="편집 취소 확인" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs space-y-2">
              <p>저장하지 않은 취미·성향·소개 변경이 사라져요. 사진 변경은 이미 저장됐어요.</p>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-lg bg-white border px-3 py-1.5">계속 편집</button><button type="button" onClick={onClose} className="rounded-lg bg-amber-700 text-white px-3 py-1.5 font-bold">변경 버리기</button></div>
            </div>}
            <div className="grid grid-cols-2 gap-2 sticky bottom-0 bg-white pt-2 pb-1">
              <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-xl border border-gray-200 py-3 text-sm font-bold">공개 미리보기</button>
              <button type="button" onClick={saveEdit} className="rounded-xl bg-[#6c2cf5] text-white py-3 text-sm font-bold">변경 저장</button>
            </div>
          </>}
        </div>
      </div>
    </div>
    {previewOpen && <UserProfileModal profile={previewOf({ ...draft, avatar: pendingPhoto || user.avatar })} variant={variant} selfPreview showVariantLabel={showVariantLabel}
      backLabel="편집으로 돌아가기" onClose={() => setPreviewOpen(false)} />}
  </>;
}
