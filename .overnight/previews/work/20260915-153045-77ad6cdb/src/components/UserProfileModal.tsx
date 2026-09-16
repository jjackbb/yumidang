import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Flag, ShieldCheck, ShieldOff, Star } from 'lucide-react';
import type { ABVariant, PublicUserProfile } from '../types';

export interface ProfileActions {
  /** Viewer is logged in and looking at someone else. */
  canInteract: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  onToggleFavorite: () => void;
  onReport: () => void;
  onBlock: () => void;
  onLoginRequired: () => void;
}

interface UserProfileModalProps {
  profile: PublicUserProfile;
  onClose: () => void;
  backLabel?: string;
  /** 02 A: summary first, details on expand. 02 B: one continuous scroll. */
  variant?: ABVariant;
  /** Owner previewing how others see them: no save/report/block. */
  selfPreview?: boolean;
  actions?: ProfileActions;
  showVariantLabel?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const sugarText = (profile: PublicUserProfile) => profile.sugarContent === null
  ? '당도 정보 없음'
  : `당도 ${profile.sugarContent}${profile.isSample ? ' · 샘플 수치' : ''}`;

function Verification({ profile }: { profile: PublicUserProfile }) {
  if (profile.isKycVerified || profile.isPhoneVerified)
    return <span data-verification="verified" className="flex items-center gap-1 text-emerald-700"><ShieldCheck size={14} />{profile.isKycVerified ? '본인확인 완료' : '휴대폰 인증 완료'}{profile.isSample ? ' (예시)' : ''}</span>;
  return <span data-verification="none" className="text-gray-500">인증 전</span>;
}

function Chips({ values, empty }: { values: string[]; empty: string }) {
  return <div className="flex flex-wrap gap-2">{values.length
    ? values.map(value => <span key={value} className="bg-[#f0edff] text-[#6c2cf5] text-xs rounded-full px-3 py-1.5">{value}</span>)
    : <p className="text-xs text-gray-400">{empty}</p>}</div>;
}

function Reviews({ profile }: { profile: PublicUserProfile }) {
  return profile.reviews.length ? <>{profile.reviews.map(review => <article key={review.id} className="py-3 border-t border-gray-100">
    <div className="flex justify-between text-xs"><span className="font-bold">{review.author}</span><span className="flex items-center gap-1 text-amber-600"><Star size={13} fill="currentColor" />{review.rating.toFixed(1)}</span></div>
    <p className="text-xs text-gray-600 leading-relaxed mt-2">{review.comment}</p>
  </article>)}</> : <p className="text-xs text-gray-400">아직 공개된 동행 후기가 없어요.</p>;
}

export function UserProfileModal({ profile, onClose, backLabel = '공고로 돌아가기', variant = 'A', selfPreview = false, actions, showVariantLabel = false }: UserProfileModalProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  // Captured during the first render, before the dialog underneath turns inert and drops focus.
  const [previousFocus] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    backRef.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const average = profile.reviews.length ? profile.reviews.reduce((sum, item) => sum + item.rating, 0) / profile.reviews.length : null;
  const reviewSummary = profile.reviews.length ? `후기 ${profile.reviews.length}개 · ★ ${average!.toFixed(1)}` : '공개된 후기 없음';
  const basics = [profile.neighborhood, profile.ageGroup].filter(Boolean).join(' · ') || '등록된 기본 정보가 없어요.';

  const header = <section className="bg-white rounded-3xl p-5" aria-label="기본 정보">
    <div className="flex items-center gap-4">
      <img src={profile.avatar} alt={`${profile.displayName}님의 프로필 사진`} className="w-20 h-20 object-cover rounded-full bg-purple-50 shrink-0" />
      <div className="min-w-0"><h2 className="font-bold text-xl">{profile.displayName}</h2><p data-profile-basics className="text-xs text-gray-500 mt-1">{basics}</p></div>
    </div>
    <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
      <span data-profile-sugar className="rounded-full bg-[#f0edff] text-[#6c2cf5] font-bold px-3 py-1.5">🍯 {sugarText(profile)}</span>
      <Verification profile={profile} />
    </div>
  </section>;

  const actionBar = !selfPreview && actions && <section aria-label="관심친구와 안전" className="bg-white rounded-3xl p-4 space-y-2">
    {actions.canInteract ? <>
      <button type="button" aria-pressed={actions.isFavorite} onClick={actions.onToggleFavorite} disabled={actions.isBlocked}
        className={`w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${actions.isFavorite ? 'bg-[#f0edff] text-[#6c2cf5]' : 'bg-[#6c2cf5] text-white'}`}>
        {actions.isFavorite ? '★ 관심친구 저장됨 · 해제하기' : '☆ 관심친구로 저장'}
      </button>
      <p className="text-[11px] text-gray-500 leading-relaxed">저장은 나만 볼 수 있어요. 상대에게 알리지 않고, 누가 저장했는지 공개하지 않아요.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={actions.onReport} className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700"><Flag size={13} />신고하기</button>
        <button type="button" onClick={actions.onBlock} disabled={actions.isBlocked} className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-rose-600 disabled:opacity-50"><ShieldOff size={13} />{actions.isBlocked ? '차단한 사용자' : '차단하기'}</button>
      </div>
    </> : <button type="button" onClick={actions.onLoginRequired} className="w-full rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-700">로그인하고 관심친구 저장·신고하기</button>}
  </section>;

  return <div role="dialog" aria-modal="true" aria-label={selfPreview ? '내 공개 프로필 미리보기' : `${profile.displayName}님의 상세 프로필`}
    data-profile-variant={variant} data-profile-id={profile.id}
    className="fixed inset-0 z-[60] flex justify-center bg-black/60 sm:p-4 sm:items-center"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div ref={panelRef} className="w-full max-w-[440px] bg-[#f8f9fc] h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto sm:rounded-[28px] text-left shadow-2xl">
      <header className="sticky top-0 bg-white/95 backdrop-blur-md p-4 border-b border-gray-100 z-10 flex items-center justify-between gap-2">
        <button ref={backRef} onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-gray-800 rounded-lg focus-visible:outline-2 focus-visible:outline-purple-500">
          <ArrowLeft size={19} /> {backLabel}
        </button>
        {showVariantLabel && <span className="shrink-0 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5">체험 설정 · 02 {variant}안</span>}
      </header>
      <div className="p-5 space-y-4">
        {selfPreview && <p className="text-[11px] text-[#6c2cf5] bg-[#f0edff] rounded-xl px-3 py-2">다른 회원에게 이렇게 보여요. 휴대폰 번호·실명·생년월일은 공개되지 않아요.</p>}
        {profile.isSample && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl px-3 py-2">프로토타입 예시 프로필 · 인증과 후기는 시연용입니다.</p>}

        {variant === 'A' ? <>
          {header}
          <section aria-label="요약" className="bg-white rounded-3xl p-5 space-y-3">
            <div><h3 className="text-sm font-bold mb-2">관심사와 취미</h3><Chips values={profile.hobbies} empty="아직 등록된 정보가 없어요." /></div>
            <div><h3 className="text-sm font-bold mb-1">자기소개</h3><p className={`text-sm text-gray-600 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>{profile.bio || '아직 자기소개를 작성하지 않았어요.'}</p></div>
            <p data-review-summary className="text-xs text-gray-500">{sugarText(profile)} · {reviewSummary}</p>
            <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}
              className="w-full flex items-center justify-center gap-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700">
              {expanded ? <>상세 접기 <ChevronUp size={14} /></> : <>상세 펼치기 <ChevronDown size={14} /></>}
            </button>
          </section>
          {expanded && <div id={detailsId} className="space-y-4">
            <section className="bg-white rounded-3xl p-5"><h3 className="text-sm font-bold mb-2">나의 성향</h3><Chips values={profile.traits} empty="아직 등록된 정보가 없어요." /></section>
            <section className="bg-white rounded-3xl p-5"><h3 className="text-sm font-bold mb-3">받은 동행 후기 <span className="text-[#6c2cf5]">{profile.reviews.length}</span></h3><Reviews profile={profile} /></section>
          </div>}
        </> : <>
          {header}
          <section className="bg-white rounded-3xl p-5"><h3 className="text-sm font-bold mb-2">자기소개</h3><p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{profile.bio || '아직 자기소개를 작성하지 않았어요.'}</p></section>
          <section className="bg-white rounded-3xl p-5 space-y-4">
            <div><h3 className="text-sm font-bold mb-2">관심사와 취미</h3><Chips values={profile.hobbies} empty="아직 등록된 정보가 없어요." /></div>
            <div><h3 className="text-sm font-bold mb-2">나의 성향</h3><Chips values={profile.traits} empty="아직 등록된 정보가 없어요." /></div>
          </section>
          <section className="bg-white rounded-3xl p-5"><h3 className="text-sm font-bold mb-3">받은 동행 후기 <span className="text-[#6c2cf5]">{profile.reviews.length}</span></h3><p data-review-summary className="text-xs text-gray-500 mb-1">{reviewSummary}</p><Reviews profile={profile} /></section>
        </>}
        {!profile.isSample && profile.sugarContent !== null && <p className="text-[11px] text-gray-400">당도 합산·하한·갱신 시점은 논의 중이라 자동으로 바뀌지 않아요.</p>}
        {actionBar}
      </div>
    </div>
  </div>;
}
