import React, { useState } from 'react';
import { X, Bell, Calendar, Sparkles, MessageCircle, UserCheck, ChevronRight, Send, Heart } from 'lucide-react';
import { NotificationItem } from '../types';
import { notificationFilterLabel, sortAndFilterNotifications, type NotificationFilter } from '../utils/notifications';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onOpenMatchRequests: (notificationId: string) => void;
  onOpenRoom: (roomId: string) => void;
  onOpenTarget?: (item: NotificationItem) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onOpenMatchRequests,
  onOpenRoom,
  onOpenTarget,
}) => {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  if (!isOpen) return null;
  const visible = sortAndFilterNotifications(notifications, filter);

  return (
    <div role="dialog" aria-modal="true" aria-label="알림 목록" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[28px] max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#6c2cf5]" />
            <h3 className="text-[17px] font-bold text-gray-900">알림</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-[#6c2cf5] hover:underline font-semibold"
            >
              모두 읽음
            </button>
            <button
              onClick={onClose}
              aria-label="알림 닫기"
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="sticky top-[64px] z-[9] flex gap-1.5 overflow-x-auto bg-white px-4 pb-2" role="group" aria-label="알림 종류 필터">
          {(Object.keys(notificationFilterLabel) as NotificationFilter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === value ? 'bg-[#6c2cf5] text-white' : 'bg-gray-100 text-gray-500'}`}>{notificationFilterLabel[value]}</button>)}
        </div>

        {/* List */}
        <div className="p-4 space-y-2.5">
          {visible.length === 0 && <p className="py-10 text-center text-sm text-gray-400">이 종류의 알림이 없어요.</p>}
          {visible.map((item) => (
            <div
              key={item.id}
              data-notification-id={item.id}
              className={`p-3.5 rounded-[20px] transition-all ${
                item.read
                  ? 'bg-white/80 text-gray-600 shadow-2xs'
                  : 'bg-[#fbfaff] text-gray-900 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.type === 'matching'
                      ? 'bg-[#f0edff] text-[#6c2cf5]'
                      : item.type === 'event'
                      ? 'bg-[#fff0eb] text-[#ff5d2b]'
                      : item.type === 'invitation' || item.type === 'new_post'
                      ? 'bg-rose-50 text-rose-500'
                      : 'bg-[#e8f5ff] text-[#0284c7]'
                  }`}
                >
                  {item.type === 'matching' && (
                    item.action === 'match_requests'
                      ? <UserCheck className="w-4 h-4" />
                      : <Calendar className="w-4 h-4" />
                  )}
                  {item.type === 'event' && <Sparkles className="w-4 h-4" />}
                  {item.type === 'chat' && <MessageCircle className="w-4 h-4" />}
                  {item.type === 'invitation' && <Send className="w-4 h-4" />}
                  {item.type === 'new_post' && <Heart className="w-4 h-4" />}
                  {(item.type === 'completion' || item.type === 'review') && <Calendar className="w-4 h-4" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-[13.5px] leading-snug">{item.title}</h5>
                    <span className="text-[11px] text-gray-400">{item.time}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                  {(item.targetType || item.roomId || item.action) && <button onClick={() => onOpenTarget ? onOpenTarget(item) : item.roomId ? onOpenRoom(item.roomId) : onOpenMatchRequests(item.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#6c2cf5]">내용 확인하기 <ChevronRight className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
