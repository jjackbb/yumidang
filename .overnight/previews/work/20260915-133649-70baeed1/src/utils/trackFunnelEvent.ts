import { supabase } from '../lib/supabase';
import { UIPageKey } from './trackBackEvent';
import { externalServicesBlocked } from './demoMode';

export type FunnelStep =
  | 'POST_DETAIL_VIEW'        // 가설 1: 공고 상세 확인
  | 'CREATE_MEETUP_SUBMIT'    // 가설 1: 동행 공고 개설 완료
  | 'JOIN_REQUEST_OPEN'       // 가설 2: 신청 모달 진입
  | 'JOIN_REQUEST_SUBMIT'     // 가설 2: 1:1 동행 신청서 제출 완료
  | 'MATCH_ACCEPT';           // 가설 3: 호스트의 동행 수락 (1:1 매칭 확정)

interface TrackFunnelParams {
  step: FunnelStep;
  pageKey?: UIPageKey;
  targetPostId?: string;
  metadata?: Record<string, any>;
}

/**
 * 3대 핵심 가설 검증용 퍼널 이벤트를 Supabase user_funnel_events에 기록합니다.
 */
export const trackFunnelEvent = async ({
  step,
  pageKey,
  targetPostId,
  metadata = {},
}: TrackFunnelParams) => {
  if (externalServicesBlocked()) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    const { error } = await supabase.from('user_funnel_events').insert({
      funnel_step: step,
      page_key: pageKey || null,
      user_id: userId,
      target_post_id: targetPostId || null,
      metadata,
    });

    if (error) {
      console.warn('[Funnel Analytics] Failed to track funnel step:', error.message);
    } else {
      console.log(`[Funnel Analytics] 🚀 Recorded step: ${step} (${targetPostId || 'general'})`);
    }
  } catch (err) {
    console.warn('[Funnel Analytics] Error:', err);
  }
};
