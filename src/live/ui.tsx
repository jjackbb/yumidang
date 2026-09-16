import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { PLACEHOLDER_AVATAR } from '../utils/profile';

export function Sheet({ label, onClose, children, z = 'z-40' }: { label: string; onClose: () => void; children: React.ReactNode; z?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div role="dialog" aria-modal="true" aria-label={label} className={`fixed inset-0 ${z} flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4`}>
    <div className="bg-white w-full max-w-[440px] rounded-t-[24px] sm:rounded-[24px] max-h-[92vh] overflow-y-auto shadow-2xl text-left">
      <div className="sticky top-0 bg-white/95 backdrop-blur px-5 py-3.5 flex items-center justify-between border-b border-gray-100 z-10">
        <h3 className="text-[16px] font-bold">{label}</h3>
        <button type="button" aria-label={`${label} 닫기`} onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>;
}

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) =>
  <div role="alert" className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700 flex items-center gap-2">
    <span className="flex-1">{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="shrink-0 font-bold underline">다시 시도</button>}
  </div>;

export const Notice = ({ children }: { children: React.ReactNode }) =>
  <p role="status" className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-purple-800">{children}</p>;

export const Skeleton = ({ rows = 3 }: { rows?: number }) =>
  <div aria-hidden="true" className="space-y-3 animate-pulse">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-gray-100" />)}</div>;

export const Avatar = ({ url, label, size = 'w-12 h-12' }: { url: string | null | undefined; label: string; size?: string }) =>
  <img src={url || PLACEHOLDER_AVATAR} alt={url ? `${label} 프로필 사진` : `${label} 기본 프로필 이미지`} className={`${size} rounded-full object-cover bg-purple-50 shrink-0`} />;

export const PrimaryButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
  <button type="button" {...props} className={`w-full py-3 rounded-xl bg-[#6c2cf5] text-white font-bold disabled:bg-purple-300 ${props.className || ''}`} />;

export const SecondaryButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
  <button type="button" {...props} className={`px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-50 ${props.className || ''}`} />;

export const StatusChip = ({ children, tone = 'purple' }: { children: React.ReactNode; tone?: 'purple' | 'gray' | 'green' | 'amber' }) => {
  const tones = { purple: 'bg-[#f0edff] text-[#6c2cf5]', gray: 'bg-gray-100 text-gray-600', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
};
