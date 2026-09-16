import type { ChatRoom, JoinRequest, MeetupPost, NotificationItem, ReviewItem } from '../types';
import { DEMO_USER_ID } from './demoIdentity';
import { demoAccounts } from './demoAccounts';
import { mockAppointments, mockMeetupPosts, mockNotifications } from './mockData';
import { createRequestRoom, requestRoomId } from '../utils/conversations';
import { defaultNotificationSettings } from '../utils/relations';
import { defaultDemoSettings, type PrototypeData } from '../utils/prototypeStore';

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
  const posts: MeetupPost[] = mockMeetupPosts.map(post => {
    const matched = mockAppointments.some(item => item.postId === post.id);
    return {
      ...post, maxMembers: 2, recruitmentEndsAt: post.recruitmentEndsAt || post.startsAt,
      closedReason: matched ? 'matched' : post.closedReason,
      status: matched ? 'closed' : post.status,
      currentMembers: post.status === 'closed' || matched ? 2 : 1,
    };
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
      time: request.createdAt, read: false, type: 'matching',
      action: 'match_requests', roomId: requestRoomId(request.id),
    })),
    ...mockNotifications,
  ];
  const users = demoAccounts();
  return {
    posts, requests, rooms, appointments: mockAppointments, notifications, reviews,
    favorites: [], invitations: [], completions: [], appointmentReviews: [],
    notificationSettings: users.map(user => defaultNotificationSettings(user.id)), blocks: [],
    users, activeUserId: null, demo: defaultDemoSettings(), ui: { activeTab: 'home' },
  };
}
