# 재신청·완료·평가 정책 구현 기록 — 2026-09-17

> 후속 상태: 회원가입 성별 분기, 여성 추천/기관 이메일 자격, 작성자 성별·서버 만 나이 정책은 원격 migration `20260917043418`로 추가 적용했다. 기존 4개 profile은 `legacy`, 원격 총량 4 Auth / 4 profile / 10 post를 보존했다. 구현·검증·배포 제한은 [SIGNUP-ELIGIBILITY-AUTHOR-DEMO-2026-09-17.md](SIGNUP-ELIGIBILITY-AUTHOR-DEMO-2026-09-17.md)를 기준으로 한다. 자동 생성 `STATE.md`는 이번 변경으로 수동 갱신하지 않았다.

## 적용 대상

- 프로젝트: `bndguguarijmghnkenvt` (`https://bndguguarijmghnkenvt.supabase.co`)
- 원격 migration: `20260917005621 retry_completion_dispute_review_policy`
- 로컬 SQL: `supabase/migrations/20260917005621_retry_completion_dispute_review_policy.sql`

## 구현 계약

### 재신청

- `(post_id, requester_id)` 전체 UNIQUE를 `status='pending'` 부분 UNIQUE로 교체했다.
- 철회 후 생성은 새 request ID를 반환한다. 이전 요청·메시지는 그대로 남고 기존 대화는 읽기 전용이다.
- 같은 사용자의 동시 신청은 공고 행 잠금과 부분 UNIQUE로 pending 1건만 만든다.
- 한 번이라도 거절된 공고는 `request_declined_history`로 재신청을 차단한다.

### 완료·분쟁

- 종료 시각 이후 최초 참여자 요청 하나가 appointment를 즉시 `completed`로 전환한다.
- `appointment_completion_confirmations`에는 최초 수동 행위자와 시각 1행만 보존한다. 재시도·동시 요청은 같은 결과를 반환한다.
- 미처리 appointment는 `ends_at+24h`부터 pg_cron이 `automatic` 완료한다. `cancelled`, `disputed`, `no_show`는 대상이 아니다.
- 완료 알림 시각부터 24시간 동안 수동 완료의 상대방 또는 자동 완료의 양쪽이 이의를 제기할 수 있다.
- 분쟁은 appointment당 1건이다. 일반 사용자는 판정할 수 없다. 운영자 `actual_meetup` 판정은 남은 평가 시간을 최소 24시간으로 복원하고, `no_show`는 평가 대상에서 제외한다.

### 평가

- 작성 기한은 `completed_at+7일`이며 두 참여자 모두 appointment 완료 직후 작성할 수 있다.
- 최초 24시간은 평가가 있어도 공개하지 않는다.
- 24시간 뒤 양쪽 평가가 있으면 상호 공개한다. 한쪽만 있으면 7일 기한에 제출된 평가만 공개한다.
- 분쟁 중에는 작성·공개·남은 기한을 동결한다.
- 당도 계산식은 추가하지 않았다.

## 검증 결과

- 로컬: TypeScript, 단위 테스트 96개, production build PASS.
- 원격 API: 기능 05 11단계, 06 10단계, 07 10단계, 08 9단계, 09 10단계 PASS.
- 브라우저: `run-20260917T010522-ay26` 17단계 PASS.
- 시간 전이: 실제 Cron 자동완료, 24시간 뒤 상호 공개, 7일 뒤 단독 공개, 실제 만남/불발 운영자 판정 PASS.
- 보안: C·익명 원본 접근 차단, raw review/dispute table 미공개, private scheduler/resolution 함수 authenticated 실행 불가 확인.

커밋·푸시·Vercel 배포는 수행하지 않았다.
