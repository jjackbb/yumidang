# 하네스 실행 보고서 — 기능 1~9

## 2026-09-17 재신청·완료·평가 정책 후속 적용

- 원격 migration `20260917005621 retry_completion_dispute_review_policy` 적용 완료.
- 로컬 `npm test` 96/96, `npm run lint`, production build 통과.
- 영향 범위 원격 하네스: 기능 05 `run-20260917T010006-4bgs` 11/11, 06 `run-20260917T010426-3rio` 10/10, 07 `run-20260917T010447-23fj` 10/10, 08 `run-20260917T010017-ufzz` 9/9, 09 `run-20260917T010103-74yq` 10/10 PASS.
- 브라우저 전체 흐름 `run-20260917T010522-ay26` 17/17 PASS: 철회 이력/읽기 전용 채팅 보존, 새 request ID/새 채팅, 한 명 완료, 양쪽 평가 작성, 24시간 비공개, 재로그인 및 C·익명 차단.
- 통제된 시간 전이 후 `policy-release-browser` PASS: 24시간 이후 상호 평가 공개와 `completed_at+7일` 단독 평가 공개를 A/B 인증 API 및 실제 Chromium에서 확인.
- 실제 Cron fixture가 다음 스케줄에서 `automatic` 완료됨을 확인했다. 수동 행위자는 null, 분쟁 창 24시간, 평가 창 7일이었다.
- 운영자 판정: `actual_meetup`은 남은 평가 시간(최소 24시간)을 복원하고, `no_show`는 평가 대상에서 제외했다. 두 private 함수는 authenticated 실행 불가다.
- Advisor 신규 항목은 의도적 전면 비공개 테이블(`appointment_disputes`, 기존 `appointment_reviews`)의 무정책 INFO와 인증·관계 검사를 수행하는 공개 RPC의 SECURITY DEFINER 경고다.

기준일: 2026-09-16 · 대상: Supabase `yumidang` / `bndguguarijmghnkenvt` / ap-northeast-2 · 실행: Claude Code

## 결론

- **기존 UI 통합 최종 run `run-codex-fc4`: `npm run harness:full-cycle`의 사용자 시나리오 17단계와 브라우저 콘솔 무오류 검사 전부 PASS** (2026-09-17, Codex). 별도 LiveApp이 아니라 기존 `App.tsx` 화면에서 실행했다.
- 최종 사전 검사 `run-codex-preflight1`: 7/7 PASS. 허용 ref, publishable key, Auth, 테스트 인증 활성, 마이그레이션 파일 버전을 재확인했다.
- 현재 로컬: `npm test` 95/95 PASS, `npm run lint` PASS, production build PASS(기존 500 kB 청크 경고), `git diff --check` PASS.
- **최종 run `run-20260916T115621-lu3w`: `npm run test:harness` 1회 실행으로 102단계 전부 PASS** (사전 검사 7, 기능 1~9 원격 83, A/B/C 브라우저 전체 사이클 17).
- 로컬: `npm test` 99/99 PASS, `npm run lint`(tsc) PASS, Vite production build PASS(기존 500 kB 청크 경고만), `git diff --check` PASS.
- 증거: `docs/development/backend-implementation/evidence/run-20260916T115621-lu3w/*.json`.

## 0단계 기준선 (변경 전)

| 항목 | 결과 |
|---|---|
| Git | `main`, HEAD `8346b80`, 사용자 변경 7개(계획 문서 03/05/06/07 수정, 08·09·프롬프트 미추적) |
| 환경변수(이름만) | `.env.local`: `VITE_SUPABASE_URL`(허용 ref URL), `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TEST_PHONE_AUTH` 존재. `SUPABASE_ACCESS_TOKEN`·`SUPABASE_SERVICE_ROLE_KEY`·`SUPABASE_DB_PASSWORD` 없음 |
| 원격 프로젝트 | `get_project` → yumidang, `ACTIVE_HEALTHY`, Postgres 17 |
| 원격 마이그레이션 | 3개 = 로컬 3개 일치 |
| 원격 스키마 | `profiles`(열 `nickname`!), RLS 정책 3개, 함수 1개, Realtime publication 없음, Auth 20명/프로필 18행 |
| Edge Function | `test-phone-auth` v2 ACTIVE, `verify_jwt=false`, 로컬 코드와 동일, 만료 2026-09-23 18:30 KST(활성) |
| 로컬 | `npm test` 88/88, lint, build PASS |
| 원격 기존 회귀 | `node tests/remote-test-phone-auth.mjs` PASS |
| 브라우저 기존 회귀 | `tests/browser/test-phone-auth-live.cjs`는 이미 프로필이 있는 번호를 기본값으로 써서 상태 의존적 → NOT_RUN(기능 1 하네스·전체 사이클로 대체) |

## 적용한 원격 변경 (모두 대상 ref 확인 후)

| 버전 | 이름 | 내용 |
|---|---|---|
| 20260916101123 | profiles_real_name_contract | `nickname→real_name` RENAME(18행 보존·열 권한 유지), `mask_real_name`, `korean_age`, `private` 스키마 |
| 20260916105220 | feature03_posts | `posts`, `post_private_details`, `create_post`, `list_posts`, `post_request_window` |
| 20260916105738 | feature04_post_author_profile | `get_post_author_profile` |
| 20260916105916 | feature05_join_requests | `join_requests`, 생성/취소/거절/목록/상대 프로필 RPC |
| 20260916110052 | feature06_matching_chat | `chat_messages`, 대화 RPC, Realtime publication |
| 20260916110758 | feature07_final_match | `appointments`, `confirm_match`, 장소 공개 정책 교체 |
| 20260916110943 | feature08_completion | `appointment_completion_confirmations`, `completed_at`, 완료 RPC |
| 20260916111030 | feature09_mutual_review | `appointment_reviews`(권한·정책 없음), 제출/상태 RPC, 기한 함수 |
| 20260916111437 | appointments_request_post_fk_index | 성능 Advisor 복합 FK 인덱스 |
| 20260916114036 | rpc_unavailable_errors_as_404 | 조회 불가 오류 HTTP 500 → 404 |
| Edge Function v3 | test-phone-auth | 로그인 모드 계정 미생성 (secrets·만료 미변경, `verify_jwt=false` 유지) |

관리자 SQL(MCP) 데이터 작업: 삭제 상태 고정 공고 1건 생성, 평가 기한 검증용 run 공고 1건 일정 8일 이동. 그 밖의 데이터 변경은 모두 publishable key + 사용자 세션.

## 최종 run 단계별 결과

| 단계 | 계층 | PASS/FAIL/NOT_RUN | 주요 확인 |
|---|---|---|---|
| preflight | LOCAL/REMOTE | 7/0/0 | 금지·타 프로젝트 ref 거부, publishable key, 브라우저 코드 비밀키 없음, Auth 헬스, 테스트 인증 활성, 마이그레이션 파일명 |
| feature-01-auth | REMOTE | 9/0/0 | 새 번호 세션·프로필 미완성, refresh 토큰 복구, 시각 열·타인 id 거부, 저장·트리거, 실명 제약, A/B/C 프로필, 타인·anon 차단, 마스킹·만 나이, 로그아웃 토큰 폐기 |
| feature-02-login | REMOTE | 6/0/0 | 미가입 로그인 거부·계정 미생성, 기존 번호 `shouldCreateUser:false`, 잘못된 코드, 동일 UUID, A/B 분리, refresh·로그아웃 |
| feature-03-posts | REMOTE | 11/0/0 | 기능 3 HANDOFF 참조 |
| feature-04-profile | REMOTE | 5/0/0 | 기능 4 HANDOFF 참조 |
| feature-05-requests | REMOTE | 10/0/0 | 기능 5 HANDOFF 참조 |
| feature-06-chat | REMOTE | 10/0/0 | Realtime 지연 B→A 741ms, A→B 674ms (Node 세션) |
| feature-07-match | REMOTE | 10/0/0 | 기능 7 HANDOFF 참조 |
| feature-08-completion | REMOTE | 7/0/0 | 기능 8 HANDOFF 참조 |
| feature-09-reviews | REMOTE | 10/0/0 | 기능 9 HANDOFF 참조 |
| full-cycle | BROWSER | 17/0/0 | 아래 표 |

### A/B/C 전체 사이클 (Chromium headless, 컨텍스트 4개: A·B·C·anon, 로컬 Vite + 원격 Supabase, API mock 없음)

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | A/B/C UI 로그인, 헤더 `마스킹 실명 · N살`, 세 세션 ID 상이 | PASS |
| 2 | A·B가 UI로 공고 작성(정확한 장소 필수), 서로의 공고 검색 | PASS |
| 3 | B·anon 목록·상세에 시·구·동만, HTML에 정확한 장소 없음 | PASS |
| 4 | B가 A의 마스킹 실명·만 나이 확인, HTML에 원본 실명·생년월일 없음, anon은 로그인 창 | PASS |
| 5 | B 참여 요청, 재요청 `already_existed`, 행 1개 | PASS |
| 6 | 두 브라우저 새로고침 없이 B→A, A→B 메시지 | PASS |
| 7 | A 확정 시트(저장된 장소·다른 신청 종료 안내) → 확정, 공고 closed | PASS |
| 8 | B 화면에 정확한 장소 새로 표시, C는 0행·화면 없음 | PASS |
| 9 | 종료 전 완료 버튼 비활성 + 서버 `too_early` | PASS |
| 10 | 종료 후 A 완료 → 즉시 5점 평가 제출, "상대 평가 대기" | PASS |
| 11 | B는 "제출했어요"만, HTML·RPC에 A 한마디 없음 | PASS |
| 12 | B 완료 → 두 화면 모두 `동행 완료` | PASS |
| 13–14 | B 블라인드 제출 → B·A 화면에 서로의 평가 동시 공개 | PASS |
| 15 | 새로고침 유지, 로그아웃 후 private 데이터 사라짐, `/me` 보호 → 로그인 → `/me` 복귀, 외부 `next` 무시 → `/`, 재로그인 후 상태 유지 | PASS |
| 16 | C·anon: 요청·채팅·appointment·장소·완료 0행, 평가 원본·평가/대화 RPC 거부 | PASS |
| 17 | A·B 서로의 원본 실명·생년월일 조회 0행, HTML에 실명·생년월일·전화번호 없음 | PASS |
| — | 4개 브라우저 모두 페이지 오류 없음(권한 거부 4xx 콘솔 로그만 제외) | PASS |

## 수동·관리자 보조 검증

| 검사 | 결과 |
|---|---|
| 원격 SQL: 마스킹 3예시, 윤년·생일 경계 나이 | PASS |
| 원격 SQL: RLS 8개 테이블 활성, 테이블 권한(anon은 `posts` SELECT만), anon 실행 가능 함수는 `list_posts`·`post_request_window`뿐, publication 4개 테이블 | PASS |
| 평가 기한: run 공고 일정 8일 이동 후 늦은 제출 거부·한쪽 평가 자동 공개 없음 (`run-dev-deadline-verify`) | PASS |
| Auth 사용자 수: 로그인 거부 검사 번호(`+82198…`) 0명, 미사용 기존 번호 0011 0명, 가입 검사 번호는 기능 1 실행 횟수(4)와 일치 | PASS |
| 조회 불가 RPC HTTP 상태 404 (`PT404`) | PASS |
| `?demo=1` 프로토타입 첫 화면 렌더·오류 없음 | PASS (스모크) |
| 기존 원격 인증 회귀 `tests/remote-test-phone-auth.mjs` (`real_name`으로 갱신 후) | PASS |

## 실패와 수정 기록 (순서대로)

| run | 실패 | 원인 | 수정 |
|---|---|---|---|
| (작업 중) | 워킹 트리 비어짐 | GitHub Desktop 브랜치 전환이 변경분을 `stash@{0}`로 이동 | 사용자 선택으로 main에 `stash apply`, stash 보존. 원격 기능 3 마이그레이션 로컬 파일 본문 복구 |
| run-dev-05 | 마감 공고 요청 NOT_RUN | 단독 실행 시 공유 데이터 없음 | 하네스가 자체 마감 공고 생성 |
| run-dev-06 | Realtime 미수신 | 하네스 헬퍼 토큰 미설정·리스너 준비 전 전송 | 토큰 명시·`postgres_changes` 준비 대기 (앱·DB 무변경) |
| run-dev-fc1 | 브라우저 채팅 미수신 | A 화면 구독 준비 전 B 전송 → 접속 공백 메시지 누락 | **앱 수정**: 구독 준비 시 재조회, `data-realtime` 노출 |
| run-dev-fc2 | C 콘솔 HTTP 500 | `P0002` → PostgREST 500 | 신규 마이그레이션 `PT404` |
| run-…114144-vth5 | 2단계 공고 미검색 | 같은 run 공고 20개 초과로 첫 페이지 밖 | 하네스를 제목 검색으로 |
| run-…114511-rrbb | 2단계 공고 미검색 | **앱 결함**: 세션 복구 순간 화면 재마운트로 입력한 검색어 소실 | 세션 복구 완료 전에는 화면을 그리지 않도록 수정 → `run-final-fc` PASS → 최종 run PASS |
| run-ui-fc10 | 10단계 평가 제출 후 닫기 | 하단 `닫기`와 상단 `평가창 닫기`가 부분 이름 locator에 함께 매칭 | 하단 버튼 locator에 `exact: true` 적용 |
| run-codex-fc2 / fc3 | 최종 콘솔 검사 | 사진 없는 라이브 계정의 아바타가 일부 기존 UI에서 `src=""`로 렌더링 | 참여 신청 모달과 공개 후기 카드에 공용 중립 기본 아바타 적용 |
| run-codex-fc4 | - | 위 수정 포함 최종 회귀 | 17단계 + 콘솔 무오류 검사 PASS |

## Supabase Advisor (최종)

- 보안 WARN 16: 상태 변경·마스킹 RPC가 SECURITY DEFINER로 authenticated에 노출. **의도된 유일한 쓰기·마스킹 경로**다. 모두 `search_path=''`, `auth.uid()`와 관계로 주체 계산, anon 실행 불가, 반환 열 명시. 원본 테이블 쓰기 권한은 열지 않았다.
- 보안 INFO 1: `appointment_reviews` 정책 없음 — 의도적 전면 차단.
- 보안 WARN 1: 유출 비밀번호 보호 비활성 — 기존 경고, 테스트 인증 내부 비밀번호 경로. 운영 전 공유 코드 제거 필요.
- 성능 INFO 4: 신규 인덱스 미사용(데이터 적음). 복합 FK 미인덱스 경고는 해결.

## NOT_RUN

- 실제 SMS, 실제 OTP/7일 경과 대기, 브라우저 시계 조작 시나리오
- 20개 단위 실제 페이지 경계(크기 1 keyset으로 동일 로직만), 목록 오류·빈 결과 화면 수동 확인
- 채팅 전송 실패 후 UI 재시도 버튼, Me 화면의 취소·거절 버튼 브라우저 클릭(같은 RPC는 REMOTE PASS)
- 기존 프로토타입 브라우저 스크립트 `tests/browser/conversations.cjs`, `post-lifecycle.cjs`: 일반 실행 로컬 프로토타입을 전제로 해 새 구조와 맞지 않음. `supabase-signup.cjs`, `test-phone-auth-live.cjs`: `real_name`으로 갱신했지만 미사용 번호 지정이 필요해 이번에 실행하지 않음
- Vercel 재배포·공개 URL, Git 커밋·푸시 (사용자 요청 전 금지)

## 남은 위험

- 테스트 인증 서버 만료 2026-09-23 18:30 KST 이후 하네스 사전 검사 실패(연장은 사용자 결정).
- 현재 Vercel 배포본은 이전 코드로 `nickname`을 저장하려 해 가입이 실패한다. 새 빌드 배포 필요.
- 테스트 데이터가 원격에 누적된다(run당 가입 계정 1개, 공고 약 20개). 공고는 1시간 안에 기본 목록에서 빠진다. 삭제는 RUNBOOK의 run 한정 SQL로만.
- 실행 중 개발 서버가 Git에 추적 중인 `node_modules/.vite/deps` 파일을 갱신했다(기존 저장소가 해당 폴더를 추적). 되돌리지 않았다.

## 재실행

```bash
npm run test:harness            # 전체
npm run harness:full-cycle      # 브라우저 사이클만
```
