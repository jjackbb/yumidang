import { supabase } from '../lib/supabase';
import { externalServicesBlocked } from './demoMode';

/**
 * 정규화된 UI 페이지/모달 식별자 키
 * (Supabase public.ui_pages 테이블의 PK와 1:1 매핑)
 */
export type UIPageKey =
  | 'POST_DETAIL'       // 동행 상세 모달
  | 'CATEGORY_DETAIL'   // 카테고리 상세 모달
  | 'EVENT_DETAIL'      // 이벤트 상세 모달
  | 'CREATE_MEETUP'     // 동행 개설 모달
  | 'AUTH'              // 로그인/회원가입 모달
  | 'DASHBOARD'         // 동행 대시보드 모달
  | 'JOIN_REQUEST'      // 동행 신청서 모달
  | 'MATCH_REQUESTS'    // 받은 신청함 모달
  | 'ESCROW_PAYMENT'    // 에스크로 결제 모달
  | 'HOME_TAB'          // 홈 탭
  | 'EXPLORE_TAB'       // 탐색 탭
  | 'CHAT_TAB'          // 채팅 탭
  | 'MY_PAGE_TAB';      // 마이페이지 탭

export type UIActionType = 'back' | 'close' | 'backdrop' | 'swipe';

interface TrackBackParams {
  pageKey: UIPageKey;
  actionType?: UIActionType;
  sourcePageKey?: UIPageKey;
  durationMs?: number;
  metadata?: Record<string, any>;
}

/**
 * 특정 UI에서 뒤로가기/닫기를 눌렀을 때 정규화된 키로 Supabase에 이벤트를 기록합니다.
 */
export const trackBackEvent = async ({
  pageKey,
  actionType = 'back',
  sourcePageKey,
  durationMs,
  metadata = {},
}: TrackBackParams) => {
  if (externalServicesBlocked() || !supabase || import.meta.env.VITE_SUPABASE_ANALYTICS_ENABLED !== 'true') return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    const { error } = await supabase.from('ui_back_events').insert({
      page_key: pageKey,
      action_type: actionType,
      source_page_key: sourcePageKey || null,
      duration_ms: durationMs ? Math.round(durationMs) : null,
      user_id: userId,
      metadata,
    });

    if (error) {
      console.warn('[Analytics] Failed to track back event:', error.message);
    } else {
      console.log(`[Analytics] ✅ Recorded normalized back event: ${pageKey} (${actionType}, ${durationMs || 0}ms)`);
    }
  } catch (err) {
    console.warn('[Analytics] Error tracking back event:', err);
  }
};
