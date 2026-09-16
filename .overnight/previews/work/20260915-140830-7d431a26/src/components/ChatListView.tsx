import React from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';
import type {
  Appointment,
  ChatRoom,
  CurrentUser,
  JoinRequest,
  MeetupPost,
} from '../types';
import { roomAccess } from '../utils/conversations';

export function ChatListView({
  rooms,
  user,
  requests,
  appointments,
  posts,
  onOpenRoom,
  onOpenAuth,
}: {
  rooms: ChatRoom[];
  user: CurrentUser | null;
  requests: JoinRequest[];
  appointments: Appointment[];
  posts: MeetupPost[];
  onOpenRoom: (id: string) => void;
  onOpenAuth: () => void;
}) {
  if (!user)
    return (
      <div className="text-center p-8 pt-14 space-y-4">
        <MessageCircle className="mx-auto text-[#6c2cf5]" size={36} />
        <h2 className="font-bold text-lg">로그인하고 동행 대화를 확인하세요</h2>
        <p className="text-sm text-gray-500">
          내가 신청하거나 받은 동행의 채팅방을 볼 수 있어요.
        </p>
        <button
          onClick={onOpenAuth}
          className="bg-[#6c2cf5] text-white rounded-xl px-6 py-3 font-bold text-sm"
        >
          로그인
        </button>
      </div>
    );
  const visible = rooms
    .filter(
      (room) =>
        roomAccess(room, user.id, requests, appointments, posts).canView,
    )
    .sort((a, b) =>
      (b.messages.at(-1)?.createdAt || '').localeCompare(
        a.messages.at(-1)?.createdAt || '',
      ),
    );
  return (
    <section className="px-5 py-5 pb-24 text-left">
      <h1 className="text-xl font-bold">동행 채팅</h1>
      <p className="text-xs text-gray-500 mt-2 mb-5">
        신청한 상대와 대화하고, 확정 후에도 같은 방에서 이어가요.
      </p>
      {visible.length === 0 && (
        <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">
          아직 연결된 대화가 없어요.
          <br />
          관심 있는 공고에 동행을 신청해 보세요.
        </div>
      )}
      <div className="space-y-3">
        {visible.map((room) => {
          const partner = room.members.find((member) => member.id !== user.id)!;
          const state = roomAccess(
            room,
            user.id,
            requests,
            appointments,
            posts,
          );
          return (
            <button
              key={room.id}
              data-room-id={room.id}
              onClick={() => onOpenRoom(room.id)}
              className="w-full text-left rounded-2xl border border-gray-100 p-4 flex gap-3 items-start hover:bg-purple-50/40"
            >
              <img
                src={partner.avatar}
                alt=""
                className="w-11 h-11 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">
                    {partner.displayName}
                  </span>
                  <span
                    className={`text-[10px] rounded-full px-2 py-1 ${state.canSend ? 'bg-purple-50 text-[#6c2cf5]' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {state.label}
                  </span>
                </div>
                <h2 className="font-semibold text-xs mt-2 line-clamp-2">
                  {posts.find((post) => post.id === room.postId)?.title ||
                    room.postTitle}
                </h2>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {room.messages.at(-1)?.text || '대화를 시작해 보세요.'}
                </p>
              </div>
              <ChevronRight size={14} className="text-gray-400 mt-3 shrink-0" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
