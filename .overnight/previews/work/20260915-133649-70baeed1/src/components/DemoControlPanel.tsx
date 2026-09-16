import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { ABVariant, CurrentUser, DemoSettings } from '../types';
import { formatSchedule } from '../utils/calendar';
import { fromKoreaInputValue, koreaInputValue } from '../utils/demoMode';

const HOUR = 3_600_000;
const variantLabels: { key: keyof DemoSettings['variants']; label: string }[] = [
  { key: 'profile', label: '02 상대 프로필' },
  { key: 'postForm', label: '04 공고 작성' },
  { key: 'review', label: '07 평가' },
];

interface DemoControlPanelProps {
  users: CurrentUser[];
  activeUserId: string | null;
  now: Date;
  settings: DemoSettings;
  onSwitchUser: (id: string | null) => void;
  onSetTimeOffset: (offsetMs: number) => void;
  onSetTime: (iso: string) => void;
  onChangeVariant: (key: keyof DemoSettings['variants'], value: ABVariant) => void;
  onReset: () => void;
}

/** Review-only controls, visually separate from service buttons. Visible only with `?demo=1`. */
export function DemoControlPanel({ users, activeUserId, now, settings, onSwitchUser, onSetTimeOffset, onSetTime, onChangeVariant, onReset }: DemoControlPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const active = users.find(user => user.id === activeUserId);
  const shifted = settings.timeOffsetMs !== 0;
  const sectionRef = useRef<HTMLElement>(null);
  // Full-height screens (chat) subtract this bar so their input never slides under the bottom nav.
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--demo-bar-h', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty('--demo-bar-h'); };
  }, []);

  return <section ref={sectionRef} aria-label="체험 설정" data-demo-panel className="bg-amber-50 border-b border-amber-200 text-amber-950 text-xs">
    <div className="flex items-center gap-2 px-4 py-2 min-w-0">
      <FlaskConical size={14} className="shrink-0" aria-hidden />
      <p className="flex-1 min-w-0 truncate">
        <b>체험 모드</b> · <span data-demo-role>{active ? active.maskedName : '로그아웃 상태'}</span> · <span data-demo-time={now.toISOString()}>{formatSchedule(now.toISOString())}{shifted ? ' (시간 이동)' : ''}</span>
      </p>
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-200/70 px-2 py-1 font-bold focus-visible:outline-2 focus-visible:outline-amber-700">
        체험 설정 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
    </div>
    {open && <div className="px-4 pb-3 space-y-3">
      <p className="text-[11px] leading-relaxed text-amber-900">예시 데이터로 보는 프론트 체험이에요. 외부 인증·분석·DB 전송은 막혀 있고, 역할 전환은 같은 브라우저 저장소에서 사용자만 바꿔요(실제 기기 간 동기화 아님).</p>
      <fieldset>
        <legend className="font-bold mb-1.5">역할 전환</legend>
        <div className="flex flex-wrap gap-1.5">
          {users.map(user => <button key={user.id} type="button" aria-pressed={user.id === activeUserId} data-demo-user={user.id} onClick={() => onSwitchUser(user.id)}
            className={`rounded-full px-2.5 py-1 border ${user.id === activeUserId ? 'bg-amber-900 text-white border-amber-900' : 'bg-white border-amber-300'}`}>
            {user.maskedName}{user.isSample ? '' : ' · 새 가입'}
          </button>)}
          <button type="button" aria-pressed={!activeUserId} onClick={() => onSwitchUser(null)} className={`rounded-full px-2.5 py-1 border ${!activeUserId ? 'bg-amber-900 text-white border-amber-900' : 'bg-white border-amber-300'}`}>로그아웃 상태로 보기</button>
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-bold mb-1.5">시간 전환 (한국 시간)</legend>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button type="button" onClick={() => onSetTimeOffset(settings.timeOffsetMs + HOUR)} className="rounded-lg bg-white border border-amber-300 px-2 py-1">+1시간</button>
          <button type="button" onClick={() => onSetTimeOffset(settings.timeOffsetMs + 24 * HOUR)} className="rounded-lg bg-white border border-amber-300 px-2 py-1">+1일</button>
          <button type="button" onClick={() => onSetTimeOffset(settings.timeOffsetMs + 7 * 24 * HOUR)} className="rounded-lg bg-white border border-amber-300 px-2 py-1">+7일</button>
          <button type="button" disabled={!shifted} onClick={() => onSetTimeOffset(0)} className="rounded-lg bg-white border border-amber-300 px-2 py-1 disabled:opacity-50">실제 시각으로</button>
        </div>
        <form className="flex flex-wrap gap-1.5 mt-1.5" onSubmit={event => { event.preventDefault(); const iso = fromKoreaInputValue(timeInput); if (iso) onSetTime(iso); }}>
          <label className="sr-only" htmlFor="demo-time-input">체험 시각 지정</label>
          <input id="demo-time-input" type="datetime-local" value={timeInput || koreaInputValue(now)} onChange={event => setTimeInput(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1" />
          <button type="submit" className="rounded-lg bg-amber-900 text-white px-2 py-1">이 시각으로 이동</button>
        </form>
      </fieldset>
      <fieldset>
        <legend className="font-bold mb-1.5">A/B 비교 (같은 데이터 유지)</legend>
        <div className="grid grid-cols-1 gap-1.5">
          {variantLabels.map(({ key, label }) => <div key={key} role="radiogroup" aria-label={`${label} 안`} className="flex items-center justify-between gap-2">
            <span>{label}</span>
            <span className="flex gap-1">{(['A', 'B'] as ABVariant[]).map(value => <button key={value} type="button" role="radio" aria-checked={settings.variants[key] === value} onClick={() => onChangeVariant(key, value)}
              className={`rounded-md px-2.5 py-0.5 border ${settings.variants[key] === value ? 'bg-amber-900 text-white border-amber-900' : 'bg-white border-amber-300'}`}>{value}안</button>)}</span>
          </div>)}
        </div>
      </fieldset>
      {confirmReset
        ? <div role="alertdialog" aria-label="체험 데이터 초기화 확인" className="rounded-xl bg-white border border-amber-300 p-3">
            <p>체험용 공고·신청·대화·설정을 예시 상태로 되돌려요. 일반 사용 저장 데이터는 건드리지 않아요.</p>
            <div className="flex gap-2 mt-2 justify-end">
              <button type="button" onClick={() => setConfirmReset(false)} className="rounded-lg border border-amber-300 px-2.5 py-1">취소</button>
              <button type="button" onClick={() => { onReset(); setConfirmReset(false); setTimeInput(''); }} className="rounded-lg bg-red-600 text-white px-2.5 py-1 font-bold">초기화 실행</button>
            </div>
          </div>
        : <button type="button" onClick={() => setConfirmReset(true)} className="flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 font-bold"><RotateCcw size={13} />체험 데이터 초기화</button>}
    </div>}
  </section>;
}
