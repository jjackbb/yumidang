# Notion 업데이트 대체 기록

기준일: 2026-09-17  
대상 프로젝트: `yumidang` / `bndguguarijmghnkenvt`  
Notion 직접 반영: `NOT_RUN` (현재 Codex 세션에 Notion 연결 도구 없음)

이 문서는 실행 프롬프트가 지정한 Notion 페이지에 직접 기록할 수 없을 때 사용하는 로컬 대체 기록이다. 기능별 상세 키·제약·RLS/RPC 계약은 `docs/backend-plans/02-login-HANDOFF.md`부터 `09-mutual-review-HANDOFF.md`까지, 실제 실행 증거는 `docs/backend-implementation/evidence/`에 있다.

## 기능 1~9 구현 및 검증 요약

| 기능 | 주요 데이터/계약 | 공개 범위와 보호 | 실제 결과 |
|---|---|---|---|
| 1 회원가입 | `profiles.id` PK/FK, `real_name`, `birth_date`, 선택 `avatar_url`/`bio`, DB 시각 | 원본 실명·생년월일·전화번호 비공개. 본인 행 RLS, 서버 마스킹/만 나이 | REMOTE PASS |
| 2 로그인 | Supabase Auth 세션, 미완성 프로필 복구, 내부 `next`만 허용 | 미가입 로그인 계정 생성 차단, 로그아웃 시 private 상태 제거 | REMOTE/BROWSER PASS |
| 3 공고 | `posts` + `post_private_details`, 작성 RPC 원자 저장, `capacity=2` | 공개 시·구·동과 비공개 정확한 장소 분리 | REMOTE/BROWSER PASS |
| 4 상대 프로필 | `post_id` 기반 공개 프로필 RPC | 로그인 사용자에게 마스킹 실명·만 나이·사진·소개만 반환 | REMOTE/BROWSER PASS |
| 5 참여 요청 | pending 부분 UNIQUE, 철회 후 새 request ID, 거절 이력 재신청 차단 | 이전 요청·채팅 보존/읽기 전용. 작성자/신청자만 조회 | REMOTE/BROWSER PASS |
| 6 매칭 채팅 | `chat_messages`, client UUID 중복 방지, `join_request_id` 대화 키 | 두 참가자만 읽기/쓰기, 종료 후 읽기 전용, Realtime | REMOTE/BROWSER PASS |
| 7 최종 확정 | `appointments`, post/request UNIQUE, 확정 RPC 트랜잭션 | 작성자만 선택. 선택된 두 사람만 정확한 장소 조회 | REMOTE/BROWSER PASS |
| 8 동행 완료 | 최초 수동 actor audit 또는 `ends_at+24h` Cron 자동완료, 24시간 분쟁 창 | 한 명 완료 즉시 전체 완료. 분쟁 판정은 private 운영자 함수 | REMOTE/BROWSER PASS |
| 9 상호 평가 | `completed_at+7일`, 최초 24시간 보류, 분쟁 중 시계 동결 | 양쪽 평가는 보류 종료 후, 단독 평가는 기한에 공개. 원본 테이블 직접 차단 | REMOTE/BROWSER PASS |

## 기존 UI 통합 추가 계약

- 마이그레이션 `20260916131906_existing_ui_gender_category_author_cards`는 원격 적용 이력과 같은 버전으로 로컬에 존재한다.
- `profiles.gender`: 선택 당시 `female|male`, 과거 계정은 `null`; 비공개이며 참여 조건 서버 검사에만 사용한다.
- `posts.partner_gender`: `any|female|male`, 기본 `any`; 작성자가 정하고 `create_join_request`가 서버에서 검사한다.
- `get_post_author_cards(uuid[])`: 로그인 목록 카드에 `post_id`, `author_id`, 마스킹 이름, 선택 사진만 최대 200건 반환한다. 원본 실명·생년월일·전화번호는 반환하지 않는다.
- 기존 UI의 `지금` 카테고리를 DB CHECK에 포함했다.

## 최종 증거

- `run-codex-preflight1`: 사전 검사 7/7 PASS.
- `run-codex-fc4`: 기존 UI A/B/C/익명 전체 흐름 17단계와 콘솔 무오류 검사 PASS.
- 후속 정책 원격 migration: `20260917005621 retry_completion_dispute_review_policy`.
- 로컬: 96/96 tests, TypeScript, production build, `git diff --check` PASS.
- 실제 SMS, Vercel 재배포/공개 URL, Git commit/push는 `NOT_RUN`이다.
