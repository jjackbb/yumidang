import React from 'react';
import { Bell } from 'lucide-react';

export function NotificationSettingsCard({ strangerInvitations, onChange }: { strangerInvitations: boolean; onChange: (enabled: boolean) => void }) {
  return <section aria-label="알림 설정" className="bg-white rounded-2xl p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)]">
    <div className="flex items-center gap-2"><Bell size={17} className="text-[#6c2cf5]" /><h2 className="text-sm font-bold">알림 설정</h2></div>
    <div className="mt-3 flex items-start justify-between gap-3">
      <div><p className="text-xs font-bold">처음 보는 사람의 초대 알림</p><p className="mt-1 text-[11px] leading-relaxed text-gray-500">내가 저장하지 않았고, 전에 동행한 적도 없는 사람의 초대만 적용돼요. 꺼도 Me의 받은 초대에는 계속 남아요.</p></div>
      <button type="button" role="switch" aria-checked={strangerInvitations} onClick={() => onChange(!strangerInvitations)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${strangerInvitations ? 'bg-[#6c2cf5]' : 'bg-gray-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${strangerInvitations ? 'left-6' : 'left-1'}`} />
        <span className="sr-only">{strangerInvitations ? '켜짐' : '꺼짐'}</span>
      </button>
    </div>
    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">서비스 안에서는 푸시와 종을 나누지 않고 ‘알림’ 하나로 관리해요. 기본값은 켜짐입니다.</p>
  </section>;
}
