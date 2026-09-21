# 기능 6. 매칭 단계 채팅 구현 인수인계

기준일: 2026-09-16 · 계획 원문: `06-matching-chat.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격 Realtime/두 브라우저 검증 PASS**

## 실제 변경 파일

- `supabase/migrations/20260916110052_feature06_matching_chat.sql` — 원격 적용 (version `20260916110052`)
- 기능 7 마이그레이션이 `private.can_send_message`를 `matched` 대화까지 확장, `get_conversation`에 `appointment_id` 채움
- 화면: `src/live/Chat.tsx`(대화 목록·대화방·전송 상태), `src/live/realtime.ts`(구독·준비 신호), `src/live/format.ts`(`mergeMessages`, `timeKey`)
- 테스트: `tests/harness/feature-06-chat.mjs`, `tests/harness/helpers/realtime.mjs`, `tests/harness/full-cycle.mjs`(6단계), `tests/live.test.ts`

## `public.chat_messages` (별도 chat_rooms 없음)

| 키 | 형식 | 필수 | 제약·기본값 | 의미 |
|---|---|:-:|---|---|
| `id` | uuid | O | PK. 클라이언트가 메시지당 1회 생성, 재시도에 재사용 | 중복 저장·표시 방지 |
| `join_request_id` | uuid | O | FK → `join_requests.id` CASCADE | 대화 식별자 |
| `sender_id` | uuid | O | FK → `profiles.id` CASCADE, RLS로 `= auth.uid()` | 보낸 사람 |
| `content` | text | O | 공백 제거 1~1,000자 | 본문(텍스트로만 렌더링) |
| `created_at` | timestamptz | O | 기본 `now()`, 클라이언트 쓰기 권한 없음 | 서버 전송 시각·정렬 |

인덱스 `(join_request_id, created_at desc, id desc)`, `(sender_id)`. 수정·삭제 없음(권한 없음).

## 권한과 이유

| 사용자·상태 | 기록 조회 | 새 메시지 |
|---|:-:|:-:|
| `pending` 요청의 신청자·작성자, 동행 시작 전 | O | O |
| `matched` 요청의 두 사람 (기능 7) | O | O |
| `withdrawn`/`declined`/`not_selected` 또는 시작 후 pending | O | X |
| 관계없는 회원·anon | X | X |

- SELECT 정책: `private.request_role(join_request_id) is not null`.
- INSERT 정책: `sender_id = auth.uid()` AND `private.can_send_message(join_request_id)`. 열 권한은 `id, join_request_id, sender_id, content`만.
- 전송은 전역 잠금 없이 메시지별 즉시 INSERT다. PK 충돌(재시도)이면 같은 발신자·본문의 저장 행을 다시 읽어 완료 처리한다.
- `get_conversation`/`list_conversations`: 상대의 마스킹 실명·사진, 공고 요약, 서버 판단 `can_send`만 반환. 정확한 장소·원본 개인정보는 자동 첨부하지 않는다.
- Realtime publication: `chat_messages`, `join_requests`(기능 7·8에서 `appointments`, `appointment_completion_confirmations` 추가). 이벤트도 SELECT RLS로 걸러진다.
- 화면은 구독 준비(`Subscribed to PostgreSQL`) 신호를 받으면 최신 50개를 다시 읽어 접속 공백 동안 온 메시지를 보강하고, `data-realtime="ready"`로 표시한다.

## 실행 명령과 실제 결과

최종 통합 run: `npm run test:harness` → `run-20260916T115621-lu3w` 전 단계 PASS (증거 `docs/development/backend-implementation/evidence/run-20260916T115621-lu3w/`).

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:06` — 헤더(마스킹·can_send, C 거부), Node 세션 A↔B Realtime 양방향 도착·C 이벤트 0건, 같은 UUID 재시도 PK 거부·행 1개·이벤트 1개, 기록 순서·C/anon 조회 0, 발신자 위조/외부인/anon/공백/1001자/created_at 지정/수정/삭제 거부, 구독 해제 후 미수신, 55개 → 50+5 페이지 중복·누락 없음, 취소·거절·시작 후 읽기 전용 | REMOTE | PASS (10/10) |
| 전체 사이클 6단계 — 두 브라우저가 새로고침 없이 B→A, A→B 수신 | BROWSER | PASS (지연 시간은 run 증거 파일) |
| 기능 7 연동 — `matched` 대화 계속 전송, `not_selected` 읽기 전용 | REMOTE | PASS |
| 전송 실패 후 같은 ID 재시도 UI | BROWSER | NOT_RUN (API 수준 PK 재시도만 검증) |

## 실패와 수정

1. `run-dev-06`: Node 하네스 구독이 토큰 설정 없이·DB 리스너 준비 전에 전송해 이벤트 미수신 → 헬퍼가 액세스 토큰을 명시하고 `postgres_changes` 준비 신호를 기다리도록 수정(DB·앱 권한 변경 없음). 진단 스크립트로 Realtime 자체는 정상 전달 확인.
2. `run-dev-fc1` 전체 사이클: A 화면 구독 준비 전에 B가 보낸 메시지를 A가 새로고침 없이 받지 못함 → **앱 수정**: 구독 준비 시 최신 메시지·헤더 재조회, 준비 상태 속성 노출. 하네스는 두 화면 준비 후 전송. 재실행 PASS.

## 남은 위험

- 읽음 표시·알림·첨부·자동 개인정보 필터 없음. 화면에 "최종 확정 전 상세 주소·연락처 공유 자제" 안내만 있다.
- 재실행: `npm run harness:06`
