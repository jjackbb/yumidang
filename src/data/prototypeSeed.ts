import type { Appointment, AppointmentReview, ChatRoom, CompletionConfirmation, EventBannerItem, FavoriteFriend, Invitation, JoinRequest, MeetupPost, NotificationItem, ReviewItem } from '../types';
import { demoSchedule, eventsStartingInWeek, koreaDateParts, weekOfMonth } from '../utils/calendar';
import { formatMeetupRange } from '../utils/meetupLifecycle';
import { sampleEventsForMonth } from './events';
import { DEMO_USER_ID } from './demoIdentity';
import { demoAccounts } from './demoAccounts';
import { mockAppointments, mockMeetupPosts, mockNotifications } from './mockData';
import { createRequestRoom, requestRoomId } from '../utils/conversations';
import { defaultNotificationSettings } from '../utils/relations';
import { defaultDemoSettings, type PrototypeData } from '../utils/prototypeStore';

const EVENT_CATEGORY: Record<EventBannerItem['kind'], string> = { 전시: '전시', 축제: '축제', 공연: '공연', 팝업: '쇼핑' };

/** Two example posts written for one event starting this week, so event detail → related posts has data. */
function eventLinkedPosts(): MeetupPost[] {
  const { year, month, day } = koreaDateParts();
  const weekEvents = eventsStartingInWeek(sampleEventsForMonth(year, month), year, month, weekOfMonth(day));
  const event = weekEvents[1] || weekEvents[0];
  if (!event) return [];
  const make = (id: string, authorId: string, author: string, avatar: string, offset: number, hour: number, extra: Partial<MeetupPost>): MeetupPost => {
    const startsAt = demoSchedule(offset, hour), endsAt = demoSchedule(offset, hour + 2);
    return {
      id, eventId: event.id, category: EVENT_CATEGORY[event.kind], title: `${event.title} 함께 둘러봐요`, author, authorId, avatar,
      startsAt, endsAt, recruitmentEndsAt: startsAt, time: formatMeetupRange(startsAt, endsAt),
      description: '예시 행사를 천천히 둘러보고 인상 깊었던 부분을 이야기 나눠요. 입장권은 각자 준비해요.',
      location: `${event.tag} 행사장 주변`, publicLocation: `${event.tag} 행사장 입구`, secretLocation: '행사장 안내데스크 옆 벤치',
      partnerGender: 'any', partnerPreferences: '천천히 관람하는 걸 좋아하시는 분', currentMembers: 1, maxMembers: 2,
      tags: ['행사동행', event.kind], status: 'recruiting', ...extra,
    };
  };
  return [
    make('post-event-1', 'user-sol', '윤*솔', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', 2, 18, {}),
    make('post-event-2', 'user-hoon', '강*훈', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', 3, 11, {
      title: `${event.title} 오전 관람 동행`, partnerGender: 'female', partnerPreferences: '여성 동행자와 오전에 조용히 관람하고 싶어요',
    }),
  ];
}

/** Fresh example state shared by the ordinary prototype and the explicit demo reset. */
export function createSeedData(): PrototypeData {
  const reviews: ReviewItem[] = [
    {
      id: 'rev-sample-1', appointmentId: 'apt-sample-1', appointmentTitle: '삼청동 한옥 카페 디저트 투어 1:1 동행',
      reviewerName: '이*진', reviewerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120', targetName: '나',
      rating: 5, badges: ['시간 약속을 칼같이 지켜요', '대화가 편안하고 즐거워요'],
      comment: '처음 해보는 1:1 디저트 투어였는데 너무 친절하게 대해주셔서 어색함 전혀 없이 즐겁게 다녀왔습니다!', isBlind: false, createdAt: '3일 전',
    },
    {
      id: 'rev-sample-2', appointmentId: 'apt-sample-2', appointmentTitle: '주말 성수동 서울숲 산책 1:1 동행',
      reviewerName: '박*민', reviewerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', targetName: '나',
      rating: 5, badges: ['친절하고 배려심이 넘쳐요', '시간 약속을 칼같이 지켜요'],
      comment: '매너가 정말 좋으세요. 시간 약속도 칼같이 지켜주셔서 덕분에 기분 좋은 하루였습니다.', isBlind: false, createdAt: '1주일 전',
    },
  ];
  const requests: JoinRequest[] = [
    {
      id: 'req-init-1', postId: 'post-demo-host', hostId: DEMO_USER_ID, postTitle: '성수동 디저트 오마카세 같이 가실 분',
      requesterId: 'user-req-1', requesterName: '김*수', requesterAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
      requesterSugar: 78, message: '안녕하세요! 디저트 카페 투어 정말 좋아하는데 혼자 가기 아쉬웠어요. 약속 시간 잘 지키겠습니다 :)', status: 'pending', createdAt: '10분 전',
    },
    {
      id: 'req-init-2', postId: 'post-demo-host', hostId: DEMO_USER_ID, postTitle: '성수동 디저트 오마카세 같이 가실 분',
      requesterId: 'user-req-2', requesterName: '이*은', requesterAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
      requesterSugar: 85, message: '성수동 거주 중인 30대입니다. 매너 있게 좋은 대화 나누며 달콤한 시간 보내요!', status: 'pending', createdAt: '30분 전',
    },
    {
      id: 'req-sent-demo', postId: 'post-exhibition-open', hostId: 'user-seojin', postTitle: '주말 사진전 함께 보고 감상 나눠요',
      requesterId: DEMO_USER_ID, requesterName: '조*미', requesterAvatar: mockAppointments[0].partnerAvatar,
      requesterSugar: 50, message: '사진전을 천천히 보고 감상을 나누고 싶어요!', status: 'pending', createdAt: '1시간 전',
    },
  ];
  const posts: MeetupPost[] = [...mockMeetupPosts.map(post => {
    const matched = mockAppointments.some(item => item.postId === post.id);
    return {
      ...post, maxMembers: 2, recruitmentEndsAt: post.recruitmentEndsAt || post.startsAt,
      closedReason: matched ? 'matched' : post.closedReason,
      status: matched ? 'closed' : post.status,
      currentMembers: post.status === 'closed' || matched ? 2 : 1,
    };
  }), ...eventLinkedPosts()];
  posts.push({
    id: 'post-minsu-invite', authorId: 'user-req-1', author: '김*수', avatar: requests[0].requesterAvatar,
    category: '산책', title: '저녁 서울숲 산책 같이 해요', description: '퇴근 뒤 한 시간 정도 천천히 걸으며 이야기 나눠요.',
    startsAt: demoSchedule(4, 19), endsAt: demoSchedule(4, 20), recruitmentEndsAt: demoSchedule(3, 19),
    time: formatMeetupRange(demoSchedule(4, 19), demoSchedule(4, 20)), location: '성동구 서울숲', publicLocation: '서울숲역 3번 출구', secretLocation: '서울숲 방문자센터 앞',
    partnerGender: 'any', partnerPreferences: '편안한 속도로 산책하실 분', currentMembers: 1, maxMembers: 2, tags: ['산책', '저녁'], status: 'recruiting',
  });
  const rooms: ChatRoom[] = [
    ...requests.flatMap(request => { const post = posts.find(item => item.id === request.postId); return post ? [createRequestRoom(request, post)] : []; }),
    ...mockAppointments.map(item => {
      const post = posts.find(post => post.id === item.postId);
      const partnerId = item.participantIds?.find(id => id !== DEMO_USER_ID) || `partner-${item.id}`;
      return {
        id: `room-${item.id}`, appointmentId: item.id, postId: item.postId || '', postTitle: post?.title || item.title, draft: '',
        members: [{ id: DEMO_USER_ID, displayName: '조*미', avatar: mockAppointments[0].partnerAvatar }, { id: partnerId, displayName: post?.author || item.partnerName, avatar: post?.avatar || item.partnerAvatar }],
        messages: [{ id: `system-${item.id}`, senderId: 'system', text: `확정된 동행입니다. ${post?.title || item.title}의 일정과 장소를 여기서 확인해요.`, createdAt: new Date().toISOString(), isSample: true }],
      };
    }),
  ];
  const notifications: NotificationItem[] = [
    ...requests.filter(request => request.hostId === DEMO_USER_ID).map((request): NotificationItem => ({
      id: `notif-${request.id}`,
      title: `${request.requesterName}님이 동행을 신청했어요`,
      description: `"${request.postTitle}" 공고의 신청 내용을 확인해 보세요.`,
      time: request.createdAt, createdAt: new Date().toISOString(), recipientId: request.hostId, read: false, type: 'matching',
      action: 'match_requests', roomId: requestRoomId(request.id),
    })),
    ...mockNotifications.map((item, index): NotificationItem => ({ ...item, recipientId: DEMO_USER_ID, createdAt: new Date(Date.now() - (index + 1) * 3600000).toISOString() })),
  ];
  const users = demoAccounts();
  const historyAppointments: Appointment[] = [
    { ...mockAppointments[1], id: 'appt-history-seojin', postId: undefined, title: '서*진 님과의 지난 전시 동행', participantIds: [DEMO_USER_ID, 'user-seojin'],
      scheduledAt: demoSchedule(-5, 11), endsAt: demoSchedule(-5, 13), dateTime: formatMeetupRange(demoSchedule(-5, 11), demoSchedule(-5, 13)), status: '동행 완료', dDay: '완료됨' },
    { ...mockAppointments[2], id: 'appt-history-hoon', postId: undefined, title: '강*훈 님과의 지난 산책 동행', participantIds: [DEMO_USER_ID, 'user-hoon'],
      scheduledAt: demoSchedule(-8, 14), endsAt: demoSchedule(-8, 15), dateTime: formatMeetupRange(demoSchedule(-8, 14), demoSchedule(-8, 15)), status: '동행 완료', dDay: '완료됨' },
  ];
  const completionAt = (appointment: Appointment, userId: string): CompletionConfirmation => ({
    appointmentId: appointment.id, userId, confirmedAt: appointment.endsAt || new Date().toISOString(),
  });
  const completions: CompletionConfirmation[] = [
    completionAt(historyAppointments[0], DEMO_USER_ID), completionAt(historyAppointments[0], 'user-seojin'),
    completionAt(historyAppointments[1], DEMO_USER_ID), completionAt(historyAppointments[1], 'user-hoon'),
  ];
  const appointmentReviews: AppointmentReview[] = [
    { id: 'appointment-review-history-seojin-yumi', appointmentId: historyAppointments[0].id, reviewerId: DEMO_USER_ID, revieweeId: 'user-seojin', rating: 5, positiveItems: ['시간 약속을 잘 지켜요'], negativeItems: [], comment: '전시를 편하게 함께 볼 수 있었어요.', submittedAt: historyAppointments[0].endsAt!, variant: 'A' },
    { id: 'appointment-review-history-seojin-partner', appointmentId: historyAppointments[0].id, reviewerId: 'user-seojin', revieweeId: DEMO_USER_ID, rating: 5, positiveItems: ['대화가 편안해요'], negativeItems: [], comment: '작품 이야기를 즐겁게 나눴어요.', submittedAt: historyAppointments[0].endsAt!, variant: 'B' },
    // One-sided example: it remains private even after the seven-day window.
    { id: 'appointment-review-history-hoon-yumi', appointmentId: historyAppointments[1].id, reviewerId: DEMO_USER_ID, revieweeId: 'user-hoon', rating: 4, positiveItems: ['친절하고 배려해요'], negativeItems: [], comment: '', submittedAt: historyAppointments[1].endsAt!, variant: 'A' },
  ];
  const favorites: FavoriteFriend[] = [
    { ownerId: DEMO_USER_ID, targetId: 'user-sol', savedAt: new Date(Date.now() - 86400000).toISOString(), notifyNewPosts: true },
    { ownerId: DEMO_USER_ID, targetId: 'user-hoon', savedAt: new Date(Date.now() - 172800000).toISOString(), notifyNewPosts: true },
  ];
  const invitedAt = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
  const invitations: Invitation[] = [
    { id: 'invite-saved-only', postId: 'post-5', senderId: 'user-sol', recipientId: DEMO_USER_ID, receivedAt: invitedAt(5), status: 'received' },
    { id: 'invite-met-only', postId: 'post-3', senderId: 'user-seojin', recipientId: DEMO_USER_ID, receivedAt: invitedAt(3), status: 'received' },
    { id: 'invite-both', postId: 'post-4', senderId: 'user-hoon', recipientId: DEMO_USER_ID, receivedAt: invitedAt(7), status: 'viewed' },
    { id: 'invite-stranger', postId: 'post-minsu-invite', senderId: 'user-req-1', recipientId: DEMO_USER_ID, receivedAt: invitedAt(1), status: 'received' },
  ];
  notifications.unshift(...invitations.map((item): NotificationItem => ({
    id: `notif-${item.id}`, recipientId: item.recipientId, createdAt: item.receivedAt,
    title: `${users.find(user => user.id === item.senderId)?.maskedName || '회원'}님이 동행에 초대했어요`,
    description: posts.find(post => post.id === item.postId)?.title || '초대받은 공고의 현재 상태를 확인해 주세요.',
    time: item.id === 'invite-stranger' ? '1시간 전' : '오늘', read: item.status === 'viewed', type: 'invitation', targetType: 'invitation', targetId: item.id,
  })));
  return {
    posts, requests, rooms, appointments: [...mockAppointments, ...historyAppointments], notifications, reviews,
    favorites, invitations, completions, appointmentReviews,
    notificationSettings: users.map(user => defaultNotificationSettings(user.id)), blocks: [],
    users, activeUserId: null, demo: defaultDemoSettings(), ui: { activeTab: 'home' },
  };
}
