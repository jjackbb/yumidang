# 구현 하네스 실행 방법

대상: 유미당 기능 1~9 (회원가입 → 로그인 → 공고 → 상대 프로필 → 참여 요청 → 매칭 채팅 → 최종 확정 → 동행 완료 → 블라인드 상호 평가)

## 한 번에 실행

```bash
npm run test:harness        # 사전 검사 → 기능 1~9 원격 검사 → A/B/C 브라우저 전체 사이클 (약 15분)
npm run test:harness:api    # 브라우저 사이클 제외 (full-cycle은 NOT_RUN으로 기록)
```

실패하면 첫 실패 단계에서 멈추고 `docs/backend-implementation/STATE.md`에 마지막 통과 단계·실패 원인·재실행 명령이 남는다.

## 기능별 실행

| 명령 | 내용 |
|---|---|
| `npm run harness:preflight` | 대상 ref·publishable key·비밀키 미사용·테스트 인증 활성·마이그레이션 파일명 |
| `npm run harness:01` | 가입·프로필 미완성 복구·세션 복구·본인 행 RLS·시각 열 변조 차단·마스킹/만 나이 |
| `npm run harness:02` | 로그인 시 계정 미생성·잘못된 코드·재로그인·A/B 세션 분리·로그아웃 |
| `npm run harness:03` | 공고 원자적 생성·검증·목록/상세/필터/페이지·삭제·마감·정확한 장소 비공개 |
| `npm run harness:04` | 작성자 공개 프로필(마스킹 실명·만 나이)·익명 차단·삭제 공고 |
| `npm run harness:05` | 동시 요청 1건·철회 후 새 ID 재신청/새 채팅·이전 채팅 읽기 전용·거절 후 재신청 차단 |
| `npm run harness:06` | 참가자 채팅·Realtime 양방향·UUID 재시도·50개 페이지·읽기 전용 전환 |
| `npm run harness:07` | 원자적 최종 확정·동시 확정·정확한 장소 공개 범위 |
| `npm run harness:08` | 종료 전 거부·한 명 완료 즉시 확정·동시 요청 단일 audit·24시간 이의 제기·자동완료 경계 |
| `npm run harness:09` | 완료 후 양쪽 작성·24시간 비공개·7일 경계·분쟁 동결·원본 테이블 차단 |
| `npm run harness:full-cycle` | 철회→재신청→새 채팅→매칭→단일 완료→평가 보류→재로그인·제3자 차단 |

각 기능 파일은 필요한 run 전용 데이터를 스스로 만들어 단독 실행된다.

## 필요한 환경

- `.env.local`: `VITE_SUPABASE_URL=https://bndguguarijmghnkenvt.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`, `VITE_TEST_PHONE_AUTH=true`
- 원격 `test-phone-auth` Edge Function 활성 상태. 서버 만료 시각 **2026-09-23 18:30 KST** 이후에는 사전 검사가 실패한다. 임의로 연장하지 않는다.
- Node 22 (`--experimental-strip-types`), Playwright 모듈과 Chromium headless shell
  - 기본 경로: `/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`, `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/...`
  - 다른 경로면 `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`로 지정
- 선택: `HARNESS_APP_URL`(이미 떠 있는 앱 사용), `HARNESS_APP_PORT`(기본 4320), `HARNESS_HEADED=1`, `HARNESS_RUN_ID`
- 관리자 키·DB 비밀번호는 필요 없다. 모든 기능 검사는 publishable key와 각 사용자 세션으로만 수행한다.

## 사용하는 테스트 계정과 데이터

- A `010-9270-0001`, B `010-9270-0002`, C `010-9270-0003`: 하네스 전용 영구 테스트 계정. 프로필이 없으면 본인 세션으로 한 번 만든다. 이름·생년월일은 테스트 값이며 검증된 실명이 아니다.
- 기능 1은 가입 검증용으로 run마다 새 번호(`0199…`) 계정 1개를 만든다. 기능 2는 미가입 번호(`0198…`)로 로그인 거부만 확인하며 계정을 만들지 않는다.
- 공고 제목은 모두 `[run_id]`로 시작한다. 요청·메시지·확정·완료·평가는 그 공고에 묶인다.
- 삭제 상태 고정 공고 1건(`00000000-0000-4000-8000-00000000de1e`)은 관리자 SQL로 1회 준비한 테스트 데이터다(공고 삭제 기능이 범위 밖).

## 정리 정책

- 사용자 권한에는 삭제 경로가 없으므로 하네스는 데이터를 지우지 않는다. 기존 사용자·프로필·공고를 삭제하지 않는다.
- run 공고는 모집 마감(기본 1시간 이내) 또는 시작 시각이 지나면 기본 목록에서 자동으로 빠진다.
- 꼭 지워야 한다면 서버 SQL에서 `posts.title like '[run-…]%'` 조건으로 **해당 run만** 삭제한다(연쇄 삭제). 원격 `db reset`·전체 삭제는 금지.

## 증거

- `docs/backend-implementation/evidence/<run_id>/<단계>.json` — 단계별 PASS/FAIL/NOT_RUN, 계층(LOCAL/REMOTE/BROWSER), 소요 시간, 안전한 수치(지연 시간 등)
- 같은 파일이 있으면 쓰기를 거부한다(덮어쓰기 금지).
- 저장 전 토큰(JWT)·비밀키·전화번호·정확한 장소·실명 원본·생년월일을 검사해 포함되면 저장을 거부한다. 스크린샷은 정확한 장소·전화번호가 찍히므로 남기지 않는다.

## 정책 시간 전이(관리자 보조) 검사

실제 24시간·7일을 기다리지 않는 검증은 run 전용 fixture의 정책 시각만 관리자 SQL로 이동한 뒤 브라우저로 확인한다. 운영 데이터에는 적용하지 않는다.

```bash
POLICY_RUN_ID=<full-cycle-run-id> \
  node --experimental-strip-types --no-warnings tests/harness/policy-release-browser.mjs
```

- 먼저 해당 full-cycle appointment의 `completion_notified_at`과 `dispute_deadline_at`을 24시간 이후로 이동해야 한다.
- 단독 공개 fixture는 `completed_at+7일`이 지난 평가 1건을 사용한다.
- 자동 하네스의 작성 기한 경계는 서버 함수 `review_submission_open(completed_at, deadline_at, status, at)`으로 검사한다.
- 실제 자동완료는 활성 Cron job `yumidang-auto-complete-appointments`가 매분 `private.complete_due_appointments`를 호출한다.

## 프로필 사진 운영 회귀

아래 명령은 실제 원격 데이터를 변경한다. `bndguguarijmghnkenvt`와 `https://yumidang.vercel.app`을 다시 확인하고, 미사용 폐기용 `0199…` 번호만 사용한다. 전화번호·토큰·추천 코드를 로그나 증거 파일에 남기지 않는다.

```bash
CHECK_URL=https://yumidang.vercel.app/ \
LIVE_PROFILE_PHONE=<unused-0199-number> \
LIVE_PROFILE_GENDER=female \
node tests/browser/signup-profile-photo-production.cjs

CHECK_URL=https://yumidang.vercel.app/ \
LIVE_PROFILE_PHONE=<unused-0199-number> \
LIVE_PROFILE_GENDER=male \
LIVE_REFERRER_PHONE=<controlled-female-test-number> \
node tests/browser/signup-profile-photo-production.cjs

LIVE_OWNER_PHONE=<controlled-photo-test-number> \
LIVE_OTHER_PHONE=<different-controlled-test-number> \
node --experimental-strip-types --no-warnings tests/profile-images-remote.mjs
```

- Production 브라우저 검사는 신규 Auth/profile을 보존하지만 가입·교체 사진은 마지막 삭제 단계에서 정리한다.
- 중간 실패로 객체가 남으면 해당 테스트 계정으로 로그인해 `clear_my_profile_avatar` 성공 후 Storage API로 그 계정의 이전 경로만 삭제한다. 기존 사용자 객체나 `storage.objects` SQL DELETE는 사용하지 않는다.
- `profile-images`의 authenticated 전체 SELECT는 현재 계약이다. anonymous read와 타인 경로 INSERT/DELETE는 반드시 거부되어야 한다.
