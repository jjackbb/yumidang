import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, UserRoundX, X } from 'lucide-react';
import type { BlockRelation, CurrentUser } from '../types';

type Preview = 'reports' | 'restriction' | 'delete' | null;

export function SafetySettingsPanel({ userId, blocks, users, onUnblock }: { userId: string; blocks: BlockRelation[]; users: CurrentUser[]; onUnblock: (targetId: string) => void }) {
  const [preview, setPreview] = useState<Preview>(null);
  const mine = blocks.filter(item => item.blockerId === userId);
  const detail = preview === 'reports'
    ? { title: '신고 처리·이의제기', body: '접수 상태와 운영팀 답변을 확인하고 이의를 제기하는 화면의 앞단입니다. 실제 신고 접수나 심사 결과는 만들지 않아요.' }
    : preview === 'restriction'
      ? { title: '권한·계정 제한', body: '위치·마이크 권한 거절 상태와 계정 이용 제한 사유, 복구 요청 진입을 확인하는 앞단입니다.' }
      : { title: '회원 탈퇴', body: '탈퇴 시 프로필과 이용 권한이 사라지는 영향 안내 앞단입니다. 보존 기간·신고 기록·복구 정책이 확정되지 않아 실제 계정 삭제는 실행하지 않아요.' };
  return <section aria-label="안전과 계정 설정" className="rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
    <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-[#6c2cf5]" />안전·계정 설정</h2>
    <div className="mt-3 divide-y divide-gray-100 text-xs">
      <div className="py-3"><div className="flex items-center justify-between"><b>차단한 사용자</b><span className="text-gray-400">{mine.length}명</span></div>{mine.length ? <div className="mt-2 space-y-2">{mine.map(item => <div key={`${item.blockerId}-${item.blockedId}`} className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5"><span>{users.find(user => user.id === item.blockedId)?.maskedName || '탈퇴한 사용자'}</span><button type="button" onClick={() => onUnblock(item.blockedId)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-[#6c2cf5]">차단 해제</button></div>)}</div> : <p className="mt-1 text-[11px] text-gray-400">차단한 사용자가 없어요.</p>}</div>
      {([['reports', '신고 처리·이의제기'], ['restriction', '권한·계정 제한'], ['delete', '회원 탈퇴']] as const).map(([id, label]) => <button type="button" key={id} onClick={() => setPreview(id)} className="flex w-full items-center justify-between py-3 text-left font-semibold"><span>{label}</span><ChevronRight size={15} className="text-gray-400" /></button>)}
    </div>
    {preview && <div role="dialog" aria-modal="true" aria-label={detail.title} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"><div className="w-full max-w-[400px] rounded-t-3xl bg-white p-5 sm:rounded-3xl"><div className="flex items-center justify-between"><h3 className="font-bold">{detail.title}</h3><button type="button" onClick={() => setPreview(null)} aria-label="설정 안내 닫기"><X size={18} /></button></div><div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 p-4"><UserRoundX className="shrink-0 text-amber-700" size={20} /><p className="text-xs leading-relaxed text-amber-950">{detail.body}</p></div><button type="button" onClick={() => setPreview(null)} className="mt-4 w-full rounded-xl bg-gray-100 py-3 text-sm font-bold">설정으로 돌아가기</button></div></div>}
  </section>;
}

