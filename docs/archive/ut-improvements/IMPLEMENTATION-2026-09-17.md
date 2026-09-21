# 2026-09-17 유저테스트 개선 구현 결과

## 판정 요약

- 구현 완료: P0 핵심 흐름, P1 참여 판단 정보, P2 입력·모달 편의를 현재 계약 안에서 보완했다.
- 로컬 검증: PASS. TypeScript, 118개 단위·통합 테스트, Production build, 핵심 및 기존 브라우저 회귀를 통과했다.
- 원격 검증: Supabase expansion 및 A/B/제3자 RLS·Realtime·RPC 검증 PASS. Git push와 Vercel Production 배포는 NOT_RUN이다.
- 실제 사용자 만족: 검증하지 않았다. 아래 결과는 구현·회귀 판정이며 사용자 만족의 증거가 아니다.

## 고정 대상과 시작 기준선

- 브랜치: `main`
- 로컬 HEAD / `origin/main`: `2433add0ac2c45521849864b454e5fcdc03236ab`
- 허용 Supabase: `bndguguarijmghnkenvt`
- `.vercel/project.json`: `jjackbb-projects/yumidang` (`yumidang6` 아님)
- 확인 당시 Vercel Production: READY, Git SHA `2433add0ac2c45521849864b454e5fcdc03236ab`
- 공개 Production bundle의 Supabase ref: `bndguguarijmghnkenvt`만 확인
- 시작 전부터 존재한 문서 이동·README·재검사 문서 변경은 사용자 작업으로 간주해 되돌리거나 덮어쓰지 않았다.

## UT 근거와 변경 전후

| 우선순위 | 변경 전 감사 | 변경 후 |
| --- | --- | --- |
| P0 개인정보·안전 문구 | 로그인 화면에 테스트 전화/OTP 보조 UI가 있었고, 구현되지 않은 SOS·운영 개입 문구가 일부 남아 있었다. | 일반 인증 UI의 테스트 개인정보와 자동 입력을 제거했다. 원격 브라우저 테스트는 번호·OTP를 환경변수로만 주입하며 결과에 원문을 기록하지 않는다. 안전 안내는 실제 신고·차단·채팅과 112 안내만 설명한다. |
| P0 인증 진입 | 가입/로그인 버튼 의미와 닫기 시 작성 내용 보호가 불충분했다. | 단계별 주요 버튼을 명확히 하고, 일반/체험 인증 모달에 외부 영역·Escape 닫기와 작성 중 확인을 추가했다. 기존 Auth 보안 계약은 바꾸지 않았다. |
| P0 신청 알림 | 일반 모드 알림이 영속 DB 레코드와 읽음 상태로 이어지지 않았다. | 수신자 전용 `notifications` 테이블, 신청 생성 trigger, 읽음 RPC, RLS, Realtime 구독과 화면 동기화를 additive migration/클라이언트에 구현했다. |
| P0 일정 검증 | 프런트 검증은 있었고 서버는 `posts_schedule_order` 제약으로 `starts_at < ends_at`을 이미 강제했다. | 기존 서버 제약을 유지하고, 단계식 입력에서도 동일·역전 종료 시각을 거부하는 브라우저 회귀를 확인했다. |
| P0 등록 후 위치 | 등록 완료 뒤 새 글을 다시 찾아야 했다. | 저장된 공고 상세을 즉시 열고 성공 상태를 표시한다. |
| P0 평가·시각·복귀 | 양쪽 평가 제출 후에도 상대 대기 문구가 나올 수 있었고 일부 ISO 시각과 뒤로가기 경로가 불명확했다. | 양쪽 제출/24시간 이의기간 문구를 분리하고, 서버 시각을 KST 사용자 형식으로 표시하며, 상세 닫기·브라우저 뒤로가기 흐름을 보완했다. |
| P1 판단 정보 | 일반 모드 목록·상세·채팅의 작성자 성별/만 나이가 불완전했고 탐색 필터가 없었다. | 로그인 사용자에게 서버가 마스킹한 이름, 성별, 현재 만 나이만 반환한다. 목록 필터는 탐색 편의임을 명시하고 서버 신청 자격과 분리했다. 날짜·시간·공개 지역도 채팅 헤더에 보완했다. |
| P1 실제 데이터 | 신청자 당도와 일부 프로필 수치가 기본값으로 보일 수 있었다. | 서버 계약에 없는 당도·인증·후기는 만들지 않고 `정보 없음`/빈 상태로 표시한다. 공개된 후기만 결합하며 당도 도움말은 현재 반영 범위와 미확정 정책을 구분한다. |
| P1 채팅·상태 | 첫 대화 작성을 돕는 선택지가 없고 움직임 축소 환경 처리가 없었다. | 인사말 3개는 초안만 채우고 자동 전송하지 않는다. 공통 상태 용어를 유지하고 `prefers-reduced-motion`을 존중한다. |
| P2 탐색·입력 | 하단 `U` 레이블, 모달 닫기 불일치, 한 화면 공고 입력의 인지 부담이 있었다. | `둘러보기`로 통일했다. 주요 모달의 닫기/외부/Escape와 작성 중 확인을 보강했다. 일반 공고는 2단계로 나누고 마지막 단계에서 일정·공개 지역·상세 장소 입력 여부·상대 조건을 요약하며 이전 이동 시 입력을 보존한다. |

제외 범위인 Instagram, MBTI, 공개 페널티, 응답 시간, 채팅 이미지, 신규 개인정보 필드, 초대 정책, 제재/감점, 자연어 AI 검색, 신규 지도/캘린더 공급자, 제휴 기능은 구현하지 않았다. 미확정 정책 29개도 추측하지 않았다.

## 주요 변경 파일

- 앱 흐름: `src/App.tsx`, `src/live/useLiveBackend.ts`, `src/live/api.ts`, `src/live/adapters.ts`, `src/types.ts`
- 화면: `src/components/AuthModal.tsx`, `DemoAuthModal.tsx`, `ExploreView.tsx`, `ChatView.tsx`, `CreateMeetupModal.tsx`, `JoinRequestModal.tsx`, `CompanionRequests.tsx`, `ReviewModal.tsx`, `SafetyRulesModal.tsx`, `NotificationModal.tsx`, `PostDetailModal.tsx`, `UserProfileModal.tsx`, `BottomNav.tsx` 및 관련 상세 모달
- 공통 로직: `src/utils/calendar.ts`, `src/utils/explore.ts`, `src/utils/reviews.ts`, `src/index.css`
- DB: 적용된 `supabase/migrations/20260917122744_ut_notifications_and_discovery.sql`, `20260917141449_notifications_join_request_index.sql`
- 테스트: `tests/utImprovements.test.ts`, `tests/harness/ut-notifications.mjs`, 관련 `tests/*.test.ts`, `tests/browser/ut-improvements.cjs` 및 변경 UI를 사용하는 기존 브라우저 스위트
- 증거: `docs/archive/ut-improvements/evidence/`

## 로컬 검증

| 검사 | 결과 |
| --- | --- |
| `npm run lint` | PASS |
| `npm test` | PASS, 118/118 |
| `npm run build` | PASS. Vite chunk-size 경고만 있으며 빌드 오류 없음 |
| `git diff --check` | PASS |
| `tests/browser/ut-improvements.cjs` | PASS, 5/5 |
| `tests/browser/explore-post-me.cjs` | PASS, 8/8 |
| `tests/browser/conversations.cjs` | PASS, 6/6 |
| `tests/browser/post-lifecycle.cjs` | PASS, 9/9 |
| `tests/browser/demo-foundation.cjs` | PASS, 5/5 |

브라우저 스위트를 처음 병렬로 실행했을 때 각 스크립트의 증거 파일 쓰기를 Vite가 감지해 다른 페이지를 재로드하면서 3개 사례가 timeout 됐다. 제품 콘솔 오류는 없었고, 영향을 받은 스위트를 순차 재실행해 위 최종 PASS를 확인했다.

## 원격 Supabase 적용과 검증

적용 migration은 [`20260917122744_ut_notifications_and_discovery.sql`](../../supabase/migrations/20260917122744_ut_notifications_and_discovery.sql)이다. 파일 version은 MCP가 원격 이력에 기록한 실제 version과 맞췄다.

- 대상 ref: `bndguguarijmghnkenvt`만 허용
- 새 객체: `public.notifications`, 수신자 SELECT RLS, 신청 알림 trigger, 본인 읽음 처리 RPC 2개, 인증 사용자용 공고 작성자 탐색 카드 RPC 1개, Realtime publication 등록
- 권한: `anon`에는 테이블/RPC 권한이 없다. `authenticated`는 자신의 알림 SELECT와 본인 범위 RPC 실행만 가능하다. 알림 직접 INSERT/UPDATE/DELETE 권한은 부여하지 않는다.
- 개인정보: 탐색 RPC는 마스킹 이름, 사진 경로, 성별, 현재 만 나이만 반환한다. 전화번호, 생년월일, 정확한 장소는 반환하지 않는다.
- 데이터 영향: 기존 테이블 행을 수정·삭제하지 않고 기존 신청을 알림으로 backfill하지 않는다. migration 직후 알림 테이블은 비어 있어야 하며, 적용 이후 새로 INSERT되는 신청부터 trigger가 알림을 만든다.
- 잠금·운영 영향: 새 테이블/함수/trigger를 생성한다. 기존 `join_requests`를 스캔하거나 기존 요청 행과 Storage 객체를 건드리지 않는다.
- 적용 전 확인: 프로젝트 URL은 `https://bndguguarijmghnkenvt.supabase.co`, 관련 table/function/trigger/policy는 모두 0, Realtime publication 중복도 0이었다.
- 적용 결과: 원격 migration `20260917122744_ut_notifications_and_discovery` 성공. 적용 직후 알림은 0행으로 기존 신청 backfill이 없었다.

### 실제 A/B/제3자 검증

`tests/harness/ut-notifications.mjs`를 publishable key와 세 개의 기존 테스트 사용자 세션으로 실행했다. 원문 전화번호·OTP·JWT·사용자 UUID는 출력하거나 증거에 저장하지 않았다.

- 기존 사용자 A/B/C 로그인: PASS
- 기존 공개 공고 조회: PASS
- A가 B의 신규 공고에 신청한 뒤 알림 1행 생성: PASS
- 작성자 B의 직접 SELECT와 Realtime 수신: PASS
- 신청자 A, 제3자 C, 익명 사용자의 조회 차단: PASS
- A의 단건 읽음 RPC와 C의 전체 읽음 RPC가 B의 알림을 변경하지 못함: PASS
- B의 단건 읽음 RPC만 `read_at`을 저장: PASS
- 관계 검증: 알림 수신자와 공고 작성자가 다른 행 0개

검증을 위해 식별 가능한 제목의 공고 1행, 신청 1행, 읽음 처리된 알림 1행을 새로 생성했다. 기존 행은 수정·삭제하지 않았고 테스트 행도 삭제하지 않았다.

### 적용 후 advisor

- Security WARN 3건: 인증 사용자에게 의도적으로 공개한 `SECURITY DEFINER` RPC 3개가 탐지됐다. 모든 함수는 기본 `PUBLIC`/`anon` 실행을 회수하고 `auth.uid()` 검사 또는 수신자 조건을 사용한다. 실제 A/B/C 권한 검증도 PASS했다. [Supabase linter 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- Performance INFO 1건: `notifications.join_request_id` 외래키에 단독 선행 인덱스가 없다는 권고에 따라 [`20260917141449_notifications_join_request_index.sql`](../../supabase/migrations/20260917141449_notifications_join_request_index.sql)을 적용했다. 요청 시점 로컬 파일 `20260917123159_notifications_join_request_index.sql`의 SQL만 실행했고, MCP가 원격 이력에 부여한 실제 version `20260917141449`에 로컬 파일명을 맞췄다. 인덱스는 valid/ready이며 알림 행 수는 적용 전후 1행으로 동일하고 외래키 미인덱스 finding은 0건이 됐다. [Supabase linter 안내](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- 적용 직후 사용 통계가 아직 없어 `notifications_join_request_idx`에 `unused_index` INFO가 새로 표시된다. 즉시 제거하지 않고 실제 쿼리·FK 정리 부하가 쌓인 뒤 재평가한다. 기존의 무관한 `private.referral_signup_audit` 외래키 INFO 1건도 그대로다. [Supabase linter 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

### 비파괴 복구 방법

예상하지 못한 정책·권한·기존 기능 문제가 발견되면 코드 push/배포로 진행하지 않는다. 이미 migration이 성공한 뒤 문제가 확인되면 새 알림 테이블의 행을 삭제하거나 기존 데이터를 보정하지 않고, 후속 forward migration으로 trigger를 비활성화하고 RPC 실행 권한 및 Realtime publication을 회수한다. 클라이언트는 기존 Production SHA에 유지한다. 테이블/스키마 제거가 필요한 완전 철회는 이번 허용 범위 밖이며 별도 영향 검토와 명시 승인을 받는다.

## NOT_RUN / BLOCKED

- NOT_RUN: Git commit/push. 현재 사용자 문서 재배치 변경과 구현 변경이 함께 있는 dirty worktree라 커밋 범위도 적용 후 다시 확인한다.
- NOT_RUN: Vercel Production 배포와 Production 브라우저 검사. 배포 직전 별도 승인이 필요하다.
- BLOCKED: 없음. push와 배포는 실패가 아니라 승인 대기다.

Supabase 원격 상태가 달라졌으므로 `HANDOFF.md`를 실제 상태에 맞게 갱신했다. Git과 Vercel Production은 계속 기준 SHA에 머물러 있다.

## 남은 정책 질문과 운영 위험

- 제품 결정 문서의 미확정 29개 질문은 그대로 남겼다.
- 일반 모드 클라이언트가 사용할 `notifications` 테이블과 탐색 RPC의 DB expansion은 적용·검증됐다. 클라이언트 코드는 아직 배포되지 않아 기존 Production 동작에는 연결되지 않는다.
- Realtime은 보조 갱신이며 15초 polling과 focus reload도 유지한다. 연결 장애 시 알림이 지연될 수 있으나 영속 레코드는 유지된다.
- 탐색 필터는 신청 자격이 아니다. 실제 신청 가능 여부는 기존 서버의 작성자 조건 검증이 계속 결정한다.
- chunk-size 경고는 기존 단일 bundle 구조의 성능 위험이며 이번 기능 정확성의 배포 차단 오류는 아니다.

## 사용자 가치 가설

- 신청 알림이 새로고침 뒤에도 남고 읽음 상태가 저장되면 호스트의 신청 누락이 줄어들 것이다.
- 성별·만 나이·일정·공개 지역과 탐색 필터가 구분돼 보이면 신청 전 판단 시간이 줄어들 것이다.
- 등록 직후 상세 이동, 평가 상태 문구, 인사말 초안, 단계식 입력이 다음 행동의 불확실성과 오입력을 줄일 것이다.

이 가설들은 코드/브라우저 PASS와 별개이며, 다음 실제 사용자 테스트에서 완료율·이탈 지점·오해 여부로 확인해야 한다.
