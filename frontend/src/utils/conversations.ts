import type {
  Appointment,
  ChatRoom,
  JoinRequest,
  MeetupPost,
} from '../types.ts';
import { isOpenRequest, isRecruiting } from './postLifecycle.ts';

export const requestRoomId = (id: string) => `room-${id}`;
export const requestStatusLabel = {
  pending: '매칭 중 · 확정 전',
  reconfirming: '변경 조건 확인 필요',
  accepted: '매칭 확정',
  rejected: '신청 거절',
  cancelled: '신청 취소',
  matched_with_other: '다른 동행자와 확정',
  post_closed: '모집 마감으로 종료',
  post_expired: '모집 기간 만료',
  post_deleted: '공고 삭제로 종료',
  change_declined: '변경 조건 거절',
  match_cancelled: '확정 동행 취소',
};

export function roomAccess(
  room: ChatRoom,
  userId: string | undefined,
  requests: JoinRequest[],
  appointments: Appointment[],
  posts: MeetupPost[],
  now = new Date(),
) {
  if (!userId || !room.members.some((member) => member.id === userId))
    return { canView: false, canSend: false, label: '참여자만 볼 수 있어요' };
  const appointment = appointments.find(
    (item) => item.id === room.appointmentId,
  );
  if (appointment) {
    if (appointment.status === '동행 완료')
      return { canView: true, canSend: true, label: '동행 완료' };
    const active = ['매칭 확정', '매칭완료'].includes(appointment.status);
    return {
      canView: true,
      canSend: active,
      label: active
        ? '매칭 확정'
        : appointment.status === '동행 취소'
          ? '동행 취소'
          : '종료된 동행',
    };
  }
  const request = requests.find((item) => item.id === room.requestId);
  if (!request) return { canView: true, canSend: false, label: '종료된 대화' };
  if (!isOpenRequest(request))
    return {
      canView: true,
      canSend: false,
      label: requestStatusLabel[request.status],
    };
  const post = posts.find((item) => item.id === room.postId);
  if (!post || post.status === 'deleted')
    return { canView: true, canSend: false, label: '삭제된 공고' };
  if (post.status !== 'recruiting')
    return {
      canView: true,
      canSend: false,
      label: post.status === 'expired' ? '기간 만료' : '모집 마감',
    };
  if (!isRecruiting(post, now))
    return { canView: true, canSend: false, label: '기간 만료' };
  return {
    canView: true,
    canSend: true,
    label: requestStatusLabel[request.status],
  };
}

export function createRequestRoom(
  request: JoinRequest,
  post: MeetupPost,
): ChatRoom {
  return {
    id: requestRoomId(request.id),
    requestId: request.id,
    postId: post.id,
    postTitle: post.title,
    draft: '',
    members: [
      { id: request.hostId, displayName: post.author, avatar: post.avatar },
      {
        id: request.requesterId,
        displayName: request.requesterName,
        avatar: request.requesterAvatar,
      },
    ],
    messages: [
      {
        id: `intro-${request.id}`,
        senderId: request.requesterId,
        text: request.message,
        createdAt: new Date().toISOString(),
      },
      {
        id: `system-${request.id}`,
        senderId: 'system',
        text: '신청이 접수됐어요. 확정 전에도 대화할 수 있고, 작성자가 수락하면 동행이 확정됩니다.',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function acceptRequest(
  requests: JoinRequest[],
  post: MeetupPost | undefined,
  requestId: string,
  actorId: string | undefined,
  now = new Date(),
) {
  const target = requests.find((item) => item.id === requestId);
  if (
    !target ||
    !post ||
    target.postId !== post.id ||
    post.authorId !== target.hostId ||
    target.hostId !== actorId ||
    target.status !== 'pending' ||
    !isRecruiting(post, now) ||
    requests.some(
      (item) => item.postId === post.id && item.status === 'accepted',
    )
  )
    return null;
  return requests.map((item) =>
    item.postId !== post.id || !isOpenRequest(item)
      ? item
      : {
          ...item,
          status:
            item.id === requestId
              ? ('accepted' as const)
              : ('matched_with_other' as const),
        },
  );
}
