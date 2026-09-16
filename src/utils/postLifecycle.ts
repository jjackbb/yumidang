import type {
  Appointment,
  ChatRoom,
  ConditionChange,
  JoinRequest,
  MeetupPost,
  NotificationItem,
  PostConditions,
} from '../types.ts';
import { formatMeetupRange, isValidMeetupRange } from './meetupLifecycle.ts';

export interface LifecycleState {
  posts: MeetupPost[];
  requests: JoinRequest[];
  rooms: ChatRoom[];
  appointments: Appointment[];
  notifications: NotificationItem[];
}
export const partnerGenderLabel = {
  any: '성별 무관',
  female: '여성만 신청 가능',
  male: '남성만 신청 가능',
} as const;
export const isOpenRequest = (request: JoinRequest) =>
  ['pending', 'reconfirming'].includes(request.status);
export const isConfirmedAppointment = (item: Appointment) =>
  ['매칭 확정', '매칭완료'].includes(item.status);
export const recruitmentDeadline = (post: MeetupPost) =>
  post.recruitmentEndsAt || post.startsAt;
export const isRecruiting = (post: MeetupPost, now = new Date()) =>
  post.status === 'recruiting' &&
  Number.isFinite(Date.parse(recruitmentDeadline(post) || '')) &&
  Date.parse(recruitmentDeadline(post)!) > now.getTime();
export const postStatusLabel = (post: MeetupPost) =>
  post.status === 'deleted'
    ? '삭제된 공고'
    : post.status === 'expired'
      ? '모집 기간 만료'
      : post.status === 'closed'
        ? post.closedReason === 'matched' || post.currentMembers === 2
          ? '매칭 확정 · 모집 마감'
          : post.closedReason === 'cancelled'
            ? '동행 취소 · 모집 종료'
            : '모집 마감'
        : '모집 중';
export function conditionsOf(post: MeetupPost): PostConditions {
  const {
    title,
    category,
    description,
    startsAt,
    endsAt,
    recruitmentEndsAt,
    location,
    publicLocation,
    secretLocation,
    partnerPreferences,
    partnerGender,
    companionType,
    proDetails,
  } = post;
  return {
    title,
    category,
    description,
    startsAt,
    endsAt,
    recruitmentEndsAt,
    location,
    publicLocation,
    secretLocation,
    partnerPreferences,
    partnerGender: partnerGender || 'any',
    companionType: companionType || 'free',
    proDetails,
  };
}
export function conditionChanges(
  before: PostConditions,
  after: PostConditions,
): ConditionChange[] {
  const changes: ConditionChange[] = [];
  const compare = (
    label: string,
    oldValue: string | undefined,
    newValue: string | undefined,
  ) => {
    if ((oldValue || '').trim() !== (newValue || '').trim())
      changes.push({
        label,
        before: oldValue || '미입력',
        after: newValue || '미입력',
      });
  };
  compare('공고 제목', before.title, after.title);
  compare('활동 종류', before.category, after.category);
  compare('활동 내용', before.description, after.description);
  compare(
    '동행 일정',
    formatMeetupRange(before.startsAt, before.endsAt),
    formatMeetupRange(after.startsAt, after.endsAt),
  );
  compare(
    '공개 만남 장소',
    [before.location, before.publicLocation].filter(Boolean).join(' · '),
    [after.location, after.publicLocation].filter(Boolean).join(' · '),
  );
  if ((before.secretLocation || '') !== (after.secretLocation || ''))
    changes.push({
      label: '상세 만남 장소',
      before: '확정 후 공개',
      after: '상세 장소가 변경됐어요. 공개 장소와 조건을 먼저 확인해 주세요.',
    });
  compare(
    '상대 성별 조건',
    partnerGenderLabel[before.partnerGender || 'any'],
    partnerGenderLabel[after.partnerGender || 'any'],
  );
  compare('상대 조건', before.partnerPreferences, after.partnerPreferences);
  if (
    before.companionType !== after.companionType ||
    JSON.stringify(before.proDetails) !== JSON.stringify(after.proDetails)
  )
    changes.push({
      label: '동행 구성',
      before: before.companionType === 'pro' ? 'PRO 동행' : '무료 동행',
      after:
        after.companionType === 'pro'
          ? 'PRO 구성 변경 · 공고에서 확인'
          : '무료 동행',
    });
  return changes;
}

// Intervals are [start, end): back-to-back meetings are not overlaps.
export function overlappingAppointments(
  appointments: Appointment[],
  participants: string[],
  startsAt?: string,
  endsAt?: string,
  excludeId?: string,
) {
  if (!isValidMeetupRange(startsAt, endsAt)) return [];
  return appointments.filter(
    (item) =>
      item.id !== excludeId &&
      isConfirmedAppointment(item) &&
      item.participantIds?.some((id) => participants.includes(id)) &&
      isValidMeetupRange(item.scheduledAt, item.endsAt) &&
      Date.parse(startsAt!) < Date.parse(item.endsAt!) &&
      Date.parse(item.scheduledAt!) < Date.parse(endsAt!),
  );
}
function announce(
  state: LifecycleState,
  roomIds: string[],
  title: string,
  description: string,
  now: Date,
): LifecycleState {
  const ids = new Set(roomIds);
  return {
    ...state,
    rooms: state.rooms.map((room) =>
      !ids.has(room.id)
        ? room
        : {
            ...room,
            messages: [
              ...room.messages,
              {
                id: crypto.randomUUID(),
                senderId: 'system',
                text: description,
                createdAt: now.toISOString(),
              },
            ],
          },
    ),
    notifications: [
      ...roomIds.map((roomId) => ({
        id: crypto.randomUUID(),
        roomId,
        title,
        description,
        time: '방금',
        read: false,
        type: 'matching' as const,
      })),
      ...state.notifications,
    ],
  };
}
export function closePost(
  state: LifecycleState,
  postId: string,
  mode: 'closed' | 'expired' | 'deleted',
  actorId?: string,
  now = new Date(),
): LifecycleState | null {
  const post = state.posts.find((item) => item.id === postId);
  if (!post || post.status === 'deleted') return null;
  if (mode === 'expired') {
    if (post.status !== 'recruiting' || isRecruiting(post, now)) return null;
  } else if (
    post.authorId !== actorId ||
    (mode === 'closed' && !isRecruiting(post, now))
  )
    return null;
  if (
    state.appointments.some(
      (item) =>
        item.postId === postId &&
        (isConfirmedAppointment(item) || item.status === '동행 완료'),
    )
  )
    return null;
  const endedIds = new Set(
    state.requests
      .filter((item) => item.postId === postId && isOpenRequest(item))
      .map((item) => item.id),
  );
  const status =
    mode === 'expired'
      ? 'post_expired'
      : mode === 'deleted'
        ? 'post_deleted'
        : 'post_closed';
  const text =
    mode === 'expired'
      ? '모집 마감 시각이 지나 공고와 미확정 신청이 만료됐어요.'
      : mode === 'deleted'
        ? '작성자가 공고를 삭제했어요. 이전 대화는 계속 확인할 수 있어요.'
        : '작성자가 모집을 마감했어요. 확정되지 않은 신청은 종료됩니다.';
  const next: LifecycleState = {
    ...state,
    posts: state.posts.map((item) =>
      item.id !== postId
        ? item
        : {
            ...item,
            status: mode,
            closedReason: mode === 'closed' ? 'manual' : item.closedReason,
            currentMembers: 1,
          },
    ),
    requests: state.requests.map((item) =>
      endedIds.has(item.id) ? { ...item, status } : item,
    ),
  };
  return announce(
    next,
    state.rooms
      .filter((room) => endedIds.has(room.requestId || ''))
      .map((room) => room.id),
    mode === 'expired'
      ? '모집 기간 만료'
      : mode === 'deleted'
        ? '공고 삭제'
        : '모집 마감',
    text,
    now,
  );
}
export function expirePosts(
  state: LifecycleState,
  now = new Date(),
): LifecycleState | null {
  let next = state;
  for (const post of state.posts) {
    if (post.status === 'recruiting' && !isRecruiting(post, now))
      next = closePost(next, post.id, 'expired', undefined, now) || next;
  }
  return next === state ? null : next;
}
export function updateRecruitingPost(
  state: LifecycleState,
  candidate: MeetupPost,
  actorId: string | undefined,
  now = new Date(),
): LifecycleState | null {
  const old = state.posts.find((item) => item.id === candidate.id);
  if (
    !old ||
    old.authorId !== actorId ||
    !isRecruiting(old, now) ||
    state.appointments.some(
      (item) => item.postId === old.id && isConfirmedAppointment(item),
    )
  )
    return null;
  const deadline = Date.parse(recruitmentDeadline(candidate) || '');
  if (
    !isValidMeetupRange(candidate.startsAt, candidate.endsAt) ||
    !Number.isFinite(deadline) ||
    deadline <= now.getTime() ||
    deadline > Date.parse(candidate.startsAt!)
  )
    return null;
  const meaningful =
    conditionChanges(conditionsOf(old), conditionsOf(candidate)).length > 0;
  const updated = {
    ...old,
    ...conditionsOf(candidate),
    tags: candidate.tags,
    time: formatMeetupRange(candidate.startsAt, candidate.endsAt),
    revision: (old.revision || 0) + (meaningful ? 1 : 0),
  };
  const changedIds = new Set<string>();
  const requests = state.requests.map((request) => {
    if (request.postId !== old.id || !isOpenRequest(request)) return request;
    if (!meaningful) return { ...request, postTitle: updated.title };
    changedIds.add(request.id);
    const baseline = request.conditionSnapshot || conditionsOf(old);
    const changes = conditionChanges(baseline, conditionsOf(updated));
    return {
      ...request,
      postTitle: updated.title,
      conditionSnapshot: changes.length ? baseline : conditionsOf(updated),
      status: changes.length ? ('reconfirming' as const) : ('pending' as const),
      reconfirmation: changes.length
        ? { revision: updated.revision, changes, status: 'pending' as const }
        : undefined,
    };
  });
  return announce(
    {
      ...state,
      posts: state.posts.map((item) => (item.id === old.id ? updated : item)),
      requests,
    },
    state.rooms
      .filter((room) => changedIds.has(room.requestId || ''))
      .map((room) => room.id),
    '공고 조건 변경',
    '공고 조건이 변경됐어요. 신청자가 최신 조건에 동의한 뒤 작성자가 수락할 수 있어요.',
    now,
  );
}
export function confirmChangedConditions(
  state: LifecycleState,
  requestId: string,
  revision: number,
  agree: boolean,
  actorId: string | undefined,
  now = new Date(),
): LifecycleState | null {
  const request = state.requests.find((item) => item.id === requestId);
  const post = state.posts.find((item) => item.id === request?.postId);
  if (
    !request ||
    request.requesterId !== actorId ||
    request.status !== 'reconfirming' ||
    !request.reconfirmation ||
    request.reconfirmation.revision !== revision ||
    request.reconfirmation.status !== 'pending' ||
    !post ||
    !isRecruiting(post, now) ||
    post.revision !== revision
  )
    return null;
  const requests = state.requests.map((item) =>
    item.id !== requestId
      ? item
      : {
          ...item,
          status: agree ? ('pending' as const) : ('change_declined' as const),
          conditionSnapshot: agree
            ? conditionsOf(post)
            : item.conditionSnapshot,
          reconfirmation: {
            ...request.reconfirmation!,
            status: agree ? ('accepted' as const) : ('declined' as const),
          },
        },
  );
  return announce(
    { ...state, requests },
    state.rooms
      .filter((room) => room.requestId === requestId)
      .map((room) => room.id),
    agree ? '변경 조건 동의' : '변경 조건 거절',
    agree
      ? '신청자가 변경 조건에 동의했어요. 작성자가 수락하면 확정됩니다.'
      : '신청자가 변경 조건을 거절해 신청이 종료됐어요.',
    now,
  );
}
export function cancelAppointment(
  state: LifecycleState,
  appointmentId: string,
  reason: string,
  actorId: string | undefined,
  now = new Date(),
): LifecycleState | null {
  const target = state.appointments.find((item) => item.id === appointmentId);
  if (
    !target ||
    !actorId ||
    !target.participantIds?.includes(actorId) ||
    !isConfirmedAppointment(target) ||
    !reason.trim()
  )
    return null;
  const roomIds = state.rooms
    .filter((room) => room.appointmentId === appointmentId)
    .map((room) => room.id);
  const requestIds = new Set(
    state.rooms
      .filter((room) => room.appointmentId === appointmentId)
      .map((room) => room.requestId),
  );
  const next: LifecycleState = {
    ...state,
    rooms: state.rooms.map((room) =>
      !roomIds.includes(room.id)
        ? room
        : {
            ...room,
            messages: room.messages.map((message) =>
              message.proposal?.status === 'pending'
                ? {
                    ...message,
                    proposal: { ...message.proposal, status: 'cancelled' },
                  }
                : message,
            ),
          },
    ),
    appointments: state.appointments.map((item) =>
      item.id !== appointmentId
        ? item
        : {
            ...item,
            status: '동행 취소',
            cancellation: {
              actorId,
              reason: reason.trim(),
              createdAt: now.toISOString(),
            },
          },
    ),
    posts: state.posts.map((item) =>
      item.id !== target.postId
        ? item
        : {
            ...item,
            status: 'closed',
            closedReason: 'cancelled',
            currentMembers: 1,
          },
    ),
    requests: state.requests.map((item) =>
      requestIds.has(item.id)
        ? {
            ...item,
            status: 'match_cancelled',
            cancellationReason: reason.trim(),
          }
        : item,
    ),
  };
  return announce(
    next,
    roomIds,
    '확정 동행 취소',
    `동행이 취소됐어요. 사유: ${reason.trim()}. 기존 대화는 확인할 수 있어요.`,
    now,
  );
}
