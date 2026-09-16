# Claude Code 실행 프롬프트 — 기능 1 감사 후 기능 2~9 통합 구현

아래 작업을 `/Users/b/Documents/Antigravity/yumidang`에서 수행해줘.

## 최종 목표

1. 기능 1 회원가입이 최신 합의와 실제 원격 Supabase 기준으로 올바르게 구현됐는지 먼저 감사하고, 발견한 결함을 수정한다.
2. 기능 2는 현재 구현 여부를 실제 코드와 원격 동작으로 판정하고 부족한 부분만 수정한다.
3. 기능 3~9를 계획 문서 순서대로 구현한다.
4. 두 명의 테스트 사용자 A/B와 익명 또는 관계없는 사용자 C로 전체 흐름을 반복 검증할 수 있는 실행 하네스를 만든다.
5. 마지막에 A/B가 한 사이클을 실제 원격 DB와 두 브라우저에서 끝까지 수행한다.

전체 흐름:

`회원가입 → 로그인 → 공고 작성·조회 → 상대 프로필 확인 → 참여 요청 → 매칭 채팅 → 최종 확정 → 동행 완료 확인 → 블라인드 상호 평가 → 양쪽 평가 공개`

이 작업은 한 Claude Code 세션에서 끝까지 진행하되, 기능을 한꺼번에 뒤섞어 만들지 마. `1번 감사 게이트 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 전체 회귀` 순서로 화면·서버·DB·권한·실패 처리·테스트를 연결해. 각 단계가 다음 단계의 데이터 계약이 된다.

일상적인 구현 선택이나 테스트 재실행 때문에 사용자에게 반복 확인을 요구하지 말고 계속 진행해. 잘못된 Supabase 프로젝트, 필요한 인증 정보 부재, 기존 데이터 전체 삭제나 원격 DB reset처럼 되돌리기 어려운 작업이 필요한 경우에만 중단하고 구체적으로 보고해.

## 먼저 읽을 자료와 우선순위

다음 순서로 읽고 현재 상태를 직접 확인해.

1. 이 프롬프트
2. `/Users/b/Documents/Antigravity/yumidang/HANDOFF.md`
3. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/02-login.md`
4. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/02-login-HANDOFF.md`
5. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/03-browse-posts.md`
6. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/04-view-profile.md`
7. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/05-join-request.md`
8. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/06-matching-chat.md`
9. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/07-final-match.md`
10. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/08-complete-appointment.md`
11. `/Users/b/Documents/Antigravity/yumidang/docs/backend-plans/09-mutual-review.md`
12. 현재 `src/`, `supabase/`, `tests/`, `package.json`, Git 변경 상태

우선순위는 **이 프롬프트와 최신 사용자 결정 → 번호별 계획 문서 → 현재 코드와 원격 관찰 → 최신 루트 HANDOFF → 과거 프로토타입 문서**다. `docs/overnight/`, 과거 분석 문서, 데모 데이터는 참고 자료일 뿐 새 백엔드의 계약으로 복사하지 마.

계획 문서는 구현 결과로 덮어쓰지 말고 보존해. 실제 결과는 기능별 `*-HANDOFF.md`에 따로 기록해.

## 현재 확인된 충돌 — 반드시 감사할 것

문서의 완료 선언을 그대로 믿지 말고 아래 충돌을 실제로 확인해.

1. 루트 `HANDOFF.md`는 기능 1과 2가 완료됐다고 하지만 `02-login-HANDOFF.md`는 구현 대기로 남아 있다. 기능 2를 무조건 다시 만들지 말고 실제 코드·원격 Auth·브라우저 동작으로 감사한 뒤 누락만 고쳐.
2. 현재 원격/로컬 기능 1 스키마와 앱은 `profiles.nickname`을 사용하는 흔적이 있다. 최신 결정은 닉네임이 아니라 **실명 원본 `real_name`을 비공개 저장하고 다른 사용자에게는 마스킹된 이름만 제공**하는 것이다. 이 불일치는 기능 1 감사에서 수정해야 한다.
3. 기능 3 계획은 공고 작성 UI를 범위 밖으로 두었지만, 이후 사용자는 작성자가 공고 작성 시 정확한 장소를 입력하도록 확정했다. 실제 한 사이클에도 공고 생성이 필요하다. 이번 구현에는 **최소 공고 작성 + `posts`와 `post_private_details`의 원자적 저장**을 포함해. 공고 수정·삭제는 추가하지 마.
4. 계획서나 기존 UI의 `닉네임`, `20대`, 공개 원본 이름 표현은 각각 `마스킹된 실명`, `25살 같은 만 나이`, 비공개 원본 정책으로 고쳐.

이 네 항목은 새 범위 추측이 아니라 최신 결정과 기존 계획 사이의 충돌 해소다. 처리 내용과 마이그레이션 이유를 HANDOFF에 남겨.

## 고정 인프라와 금지 사항

- 작업 대상 Supabase 프로젝트 이름: `yumidang`
- 허용 프로젝트 ref: `bndguguarijmghnkenvt`
- 허용 URL: `https://bndguguarijmghnkenvt.supabase.co`
- 리전: `ap-northeast-2`
- 테스트 인증: 테스트 번호와 고정 OTP `123456`
- 실제 SMS 인증으로 표현하지 말 것

첫 원격 조회와 첫 원격 변경 직전에 각각 대상 ref를 확인해. 다른 ref면 즉시 중단해.

- `fiaxchvyywpqbwbcuzfz`에 원격 요청·변경 금지
- `sdfyostmwedvonwmmnej`에 원격 요청·변경 금지
- 위 ref 문자열이 로컬의 차단 회귀 테스트 fixture에 있는 것은 허용하지만 실제 네트워크 대상으로 사용하지 마.
- service-role/secret/session/refresh token을 브라우저 코드, Git, 문서, 테스트 출력, 스크린샷에 남기지 마.
- 브라우저에는 publishable key만 사용해.
- 원격 `supabase db reset`, 전체 데이터 삭제, 기존 Auth 사용자 삭제 금지
- 기존 마이그레이션 수정 금지. 새 변경은 새 마이그레이션으로 추가해.
- 현재 Git 변경을 `reset`, `checkout`, `clean`, 덮어쓰기로 없애지 마.
- 사용자 요청 전 Git commit, push, PR, Vercel 배포 금지
- 테스트 실패를 localStorage 가짜 데이터나 mock 성공으로 우회하지 마.
- 일반 실행과 `?demo=1`을 분리하고, 일반 실행에서는 Supabase 실패 시 데모 데이터로 돌아가지 마.

`test-phone-auth`의 활성 만료 시각이 지났다면 임의로 연장하지 말고 중단 사유와 필요한 조치만 보고해. 활성 상태라면 기존 설정을 다시 만들지 마.

## 구현 하네스

기존 Node 테스트와 브라우저 스크립트를 재사용하되, 기능 1~9를 안전하게 반복 실행할 수 있는 하네스를 추가해. 파일명은 저장소 구조에 맞게 조정할 수 있지만 다음 역할은 반드시 있어야 한다.

```text
tests/harness/
  preflight.*              # 환경·대상 ref·필수 설정·기준선 검사
  feature-01-auth.*        # 가입 감사와 회귀
  feature-02-login.*
  feature-03-posts.*
  feature-04-profile.*
  feature-05-requests.*
  feature-06-chat.*
  feature-07-match.*
  feature-08-completion.*
  feature-09-reviews.*
  full-cycle.*             # A/B/C 전체 흐름
  helpers/                 # 세션·API·브라우저·증거·정리 공통 코드

docs/backend-implementation/
  STATE.md                 # 기능별 pending/running/pass/fail/not_run과 재개 지점
  RUNBOOK.md               # 실행 방법과 필요한 환경
  HARNESS-REPORT.md        # 실제 명령·결과·증거·제약
```

`npm run test:harness`처럼 한 명령으로 사전 검사부터 전체 흐름까지 실행할 수 있게 만들고, 필요한 세부 명령도 제공해. 하나의 거대한 테스트 파일로 만들지 말고 기능별 실패 지점을 알 수 있게 나눠.

하네스 요구사항:

1. 시작 시 대상 URL/ref가 정확하지 않으면 원격 작업을 거부한다.
2. 테스트 실행마다 고유 `run_id`를 사용해 공고·요청·메시지·평가를 구분한다.
3. A와 B는 서로 독립된 브라우저 컨텍스트와 실제 Supabase 세션을 사용한다.
4. C는 익명 또는 관계없는 로그인 사용자로 권한 침범을 검사한다.
5. 기능 동작은 publishable key와 각 사용자 세션으로 검증한다. 관리자 권한으로 사용자 행동 성공을 대신하지 마.
6. 테스트 준비·정리에 관리자 권한이 필요하면 서버/CLI에서만 쓰고 브라우저에 전달하지 않는다.
7. 정리는 이번 `run_id`가 만든 데이터만 대상으로 한다. 기존 사용자·프로필·공고를 삭제하지 않는다.
8. 두 브라우저, 원격 DB, Realtime을 실행하지 않은 검사는 `NOT_RUN`으로 기록한다.
9. 토큰·OTP 요청 응답·비밀값·정확한 장소·원본 실명·생년월일·전화번호를 증거 파일에 남기지 않는다.
10. 기존 증거 파일을 덮어쓰지 말고 run별 새 경로에 저장한다.
11. 재실행해도 중복 데이터와 잘못된 상태 전이가 생기지 않게 한다.
12. 실패하면 상태 파일에 마지막 통과 단계, 실패 원인, 재실행 명령을 기록한 뒤 원인을 고치고 계속한다.

## 0단계 — 사전 검사와 기준선

코드를 바꾸기 전에 다음을 기록해.

- 현재 브랜치, HEAD, `git status --short`
- 현재 환경변수의 **이름과 존재 여부만** 확인. 값은 출력하지 않기
- Supabase CLI 또는 사용 가능한 MCP에서 대상 ref와 상태 확인
- 로컬 마이그레이션과 원격 마이그레이션 목록 비교
- 현재 원격 테이블·함수·RLS·정책·권한·Realtime publication 상태
- `npm test`, `npm run lint`, `npm run build` 기준선
- 기존 기능 1/2 원격 테스트와 브라우저 테스트의 현재 결과

기존 실패가 있으면 이번 변경 전 실패인지 기록하고, 작업 범위와 관계있는 실패는 고쳐. 무관한 실패는 근거와 함께 분리하되 최종 전체 회귀에서 다시 확인해.

## 1단계 — 기능 1 감사와 수정 게이트

기능 2 이후를 시작하기 전에 기능 1을 실제로 검증해. `HANDOFF.md`의 PASS 문구만으로 통과시키지 마.

### 최신 기능 1 계약

- 휴대폰 인증 뒤 실제 `auth.users`와 Supabase 세션을 사용
- 제어된 테스트 인증은 실제 SMS나 번호 소유 확인이 아님
- `profiles.id = auth.users.id`
- `profiles.real_name`: 실명 원본, 본인과 허가된 서버 로직 외 비공개
- `profiles.birth_date`: 정확한 생년월일 원본, 타인에게 반환 금지
- `profiles.avatar_url`, `profiles.bio`: 선택
- `profiles.created_at`, `profiles.updated_at`: DB가 관리
- `auth.users.created_at` 유지
- 프로필 지역 정보 없음
- 전화번호를 profiles에 복사하지 않음
- 나이는 저장하지 않고 서울 날짜 기준 만 나이로 계산
- 다른 사용자에게 `real_name`, `birth_date`, 전화번호 원본을 반환하지 않음
- 실명 입력은 신분증 검증을 뜻하지 않으며 인증 배지를 만들지 않음

### 실명 마스킹

- `변종` → `변*`
- `변종현` → `변*현`
- `변종현미` → `변**미`
- 원본 실명은 클라이언트가 타인 조회 응답으로 받지 않게 서버에서 마스킹

현재 `nickname`을 사용한다면 데이터를 보존하는 신규 마이그레이션으로 `real_name` 계약으로 전환하고 다음을 함께 고쳐.

- DB 열·제약·COMMENT·column grant
- 프론트 입력 라벨과 타입
- 자기 프로필 조회와 저장
- 공개 프로필용 마스킹 함수/RPC 계약
- 테스트와 문서

기존 테스트 값이 실제 이름이 아니면 테스트 데이터로만 유지하고 검증된 실명이라고 표현하지 마. 기능 1 감사에서 가입, 프로필 미완성 복구, 새로고침 세션 복구, 본인 행 RLS, 타인·anon 차단, 시스템 시각 열 변조 차단을 다시 검증해.

기능 1이 통과하거나 결함이 수정돼 재검증되기 전에는 기능 2로 넘어가지 마.

## 2단계 — 기능 2 로그인

`02-login.md`의 완료 기준을 그대로 사용해. 현재 구현이 있으면 감사·보완하고 중복 구현하지 마.

- 로그인 OTP 요청은 미가입 계정 생성을 막아야 함
- Supabase 세션과 서버 사용자 검증 사용
- 프로필이 없으면 기능 1 입력 재개
- 새로고침 세션 복구
- `/chat`, `/me` 같은 허용된 내부 경로만 복귀
- 외부 URL·임의 스킴 차단
- 로그아웃과 계정 전환 시 이전 사용자의 private 상태 제거
- A/B 세션 분리

구현·검증 결과로 `02-login-HANDOFF.md`를 최신화해. 과거의 `구현 대기` 문구를 실제 결과와 구분해.

## 3단계 — 공고 작성·목록·상세

`03-browse-posts.md`를 기본 계약으로 사용하되 실제 한 사이클에 필요한 최소 공고 작성을 함께 구현해.

- `posts`: 공개 가능한 정보만 저장
- `post_private_details`: 정확한 장소 분리 저장
- 공개 위치: `서울특별시 성동구 성수동`처럼 시·구·동까지만
- 정확한 장소: 작성 시 필수 입력, 작성자에게 보임, 일반 목록·상세 응답에는 없음
- `posts`와 `post_private_details`는 한 RPC/트랜잭션에서 함께 생성
- 작성자는 `auth.uid()`로 결정
- `capacity = 2`
- 익명도 삭제되지 않은 공개 공고 목록·상세 조회 가능
- 검색·날짜·카테고리·공개 지역 필터와 페이지 연결
- 기존 프론트 샘플 데이터 대신 일반 실행에서 Supabase 사용
- 공고 수정·삭제 UI는 이번 범위 밖

A와 B가 각각 최소 한 개의 공고를 작성해 서로의 공고를 볼 수 있게 검증해.

## 4단계 — 상대 프로필

`04-view-profile.md`를 따른다.

- 로그인 사용자만 공고 작성자의 안전한 공개 프로필 조회
- 서버가 `post_id → author_id`를 계산
- 마스킹된 실명, `25살` 같은 만 나이, 사진, 소개만 반환
- 원본 `real_name`, `birth_date`, 전화번호, 인증 메타데이터 반환 금지
- 타인의 원본 `profiles` 직접 SELECT 금지
- 사진·소개가 없어도 안전한 기본 상태 표시

계획서의 `닉네임` 표현이 남아 있다면 마스킹된 실명으로 해석하고 구현 기록에서 정정해.

## 5단계 — 참여 요청

`05-join-request.md`를 따른다.

- 신청자는 `auth.uid()`, 대상은 `post_id` 관계에서 서버가 계산
- 자기 공고 신청 금지
- 같은 공고 중복 신청 방지
- `pending` 화면명은 `매칭 대화 중`
- `withdrawn`은 신청 취소
- `declined`는 신청 거절
- 작성자와 요청자만 관련 요청 조회
- 요청 목록 응답에도 원본 실명·생년월일·전화번호 금지
- 생성·취소·거절은 전용 RPC와 허용된 상태 전이만 사용

## 6단계 — 매칭 채팅

`06-matching-chat.md`를 따른다.

- 별도 `chat_rooms` 없이 `join_request_id`를 대화 식별자로 사용
- 두 참가자만 메시지 조회·전송
- `pending`과 선택된 `matched` 요청만 전송 가능
- 종료된 요청은 이전 기록 읽기 전용
- 메시지 ID는 클라이언트 UUID를 받아 재시도 중복 방지
- 두 브라우저에서 새로고침 없이 Realtime 전달 확인
- 전역 mutation lock으로 모든 메시지를 막지 말고 메시지별 즉시 경로 사용
- 원본 개인정보와 정확한 장소를 채팅 조회 응답에 자동 첨부하지 않음

## 7단계 — 최종 동행 확정

`07-final-match.md`를 따른다.

- 공고 작성자만 `pending` 요청 중 한 명 선택
- 신청자의 참여 요청과 확정 전 취소 가능성을 최소 동의로 사용
- 확정 RPC 한 트랜잭션에서 다음을 처리
  1. appointment 생성
  2. 선택 요청 `matched`
  3. 나머지 pending 요청 `not_selected`
  4. 공고 `closed`
- 동시 확정에도 한 appointment만 생성
- 정확한 장소는 `appointments`에 복사하지 않음
- 확정된 작성자와 선택된 신청자만 기존 `post_private_details.exact_location` 조회
- 선택되지 않은 신청자와 관계없는 사용자는 정확한 장소 조회 불가

## 8단계 — 개인별 동행 완료

`08-complete-appointment.md`를 따른다.

- `posts.ends_at` 이후 서버 시각 기준으로만 완료 확인
- 각 참가자는 자기 완료만 확인
- `(appointment_id, user_id)`로 중복 방지
- 첫 번째 완료 확인만으로 appointment를 `completed`로 바꾸지 않음
- 두 번째 완료 확인과 `completed_at` 기록은 같은 트랜잭션
- 자기 완료 확인 직후 상대 완료 여부와 관계없이 자기 평가 작성 자격 생성
- 상대가 완료하지 않았어도 본인 평가 작성 가능
- 완료 확인 취소·삭제 없음

## 9단계 — 블라인드 상호 평가

`09-mutual-review.md`를 따른다.

- 별점 `1~5` 필수
- 선택 한마디 `300자 이하`
- 평가자 본인의 완료 확인 뒤 제출 가능
- 평가 제출 기한 기본값: `posts.ends_at + 7일` 미만
- `(appointment_id, reviewer_id)` UNIQUE
- 평가 대상은 두 참가자 관계에서 서버가 계산하고 `reviewee_id`를 클라이언트가 지정하지 않음
- 제출 후 수정·삭제 금지
- 한 평가만 있으면 상대 평가의 별점·한마디를 화면·RPC·프로필·알림·Realtime으로 노출하지 않음
- 두 평가가 모두 제출되면 두 참가자에게 동시에 공개
- 기한이 지나도 한쪽 평가 자동 공개 금지
- 공개 프로필 후기·평균 별점·당도 계산은 이번 범위 밖

원본 평가 테이블을 브라우저가 직접 읽지 않게 하고 안전한 상태 조회 RPC로 `own_review`, `peer_submitted`, 공개 조건을 충족한 경우의 `peer_review`만 반환해.

## 마이그레이션과 보안 기준

- 마이그레이션은 기능 의존 순서대로 작은 파일로 추가해.
- 로컬 SQL과 원격 적용 이력을 일치시켜.
- 모든 테이블에 필요한 PK/FK/UNIQUE/CHECK/index와 RLS를 둬.
- 클라이언트가 작성자·요청자·발신자·완료자·평가자를 임의 지정하지 못하게 `auth.uid()`와 서버 관계에서 계산해.
- 여러 행의 상태를 함께 바꾸는 기능은 RPC 트랜잭션과 행 잠금을 사용해.
- SECURITY DEFINER가 필요하면 `search_path`를 고정하고 실행 권한을 최소화해.
- direct table grant는 필요한 최소 SELECT만 허용하고 상태 변경은 전용 RPC로 제한해.
- 마이그레이션 뒤 Supabase security/performance advisor를 확인하고 새 경고를 해결하거나 근거와 함께 기록해.

## 전체 A/B/C 완료 시나리오

기능별 검증 뒤 다음 전체 흐름을 실제 원격 DB와 두 브라우저로 실행해.

1. A와 B가 독립 세션으로 로그인한다.
2. A와 B가 각각 공고를 작성하고 서로의 공개 공고를 확인한다.
3. 목록·상세에는 시·구·동만 보이고 정확한 장소가 없는지 확인한다.
4. B가 A의 공고에서 A의 마스킹된 실명·만 나이 프로필을 본다.
5. B가 A 공고에 참여 요청을 보내고 중복 요청이 차단된다.
6. A와 B가 해당 요청의 채팅에서 양방향 메시지를 새로고침 없이 주고받는다.
7. A가 B를 최종 동행자로 확정한다.
8. B에게만 정확한 장소가 새로 보이고, C에게는 계속 보이지 않는다.
9. 종료 전 완료 확인이 거부된다.
10. 종료 시각 뒤 A가 완료를 확인하고 즉시 자기 평가를 제출한다.
11. B는 A 평가의 존재 여부만 알 수 있고 별점·한마디는 보지 못한다.
12. B가 완료를 확인하면 appointment가 `completed`가 된다.
13. B가 A의 내용을 보지 못한 채 평가를 제출한다.
14. 두 평가 제출 뒤 A와 B에게 서로의 평가가 동시에 공개된다.
15. 새로고침·로그아웃·재로그인 뒤에도 원격 상태가 유지된다.
16. C와 익명 사용자는 private 요청·채팅·appointment·정확한 장소·완료·평가를 볼 수 없다.
17. A/B가 상대의 원본 실명·생년월일·전화번호를 직접 조회하지 못한다.

종료 시각 테스트는 운영 데이터를 조작하지 말고 이번 run의 테스트 공고 일정만 제어해. 브라우저 시계 변경만으로 서버 검사를 통과시키지 마.

## 검증 기준

각 기능에서 최소 다음을 확인해.

- 정상 흐름
- 익명 접근
- 관계없는 사용자 접근
- 다른 참가자 명의 조작
- 중복 클릭과 네트워크 재시도
- 두 탭 또는 두 브라우저 동시 실행
- 새로고침과 재로그인 복구
- 서버 시각 경계
- RLS를 우회하려는 직접 REST/SDK 요청
- 응답과 로그의 개인정보 누출
- 실패 뒤 부분 데이터가 남지 않는지

최종적으로 실행:

- 전체 단위 테스트
- TypeScript 검사
- production build
- 기능별 원격 통합 검사
- A/B/C 브라우저 전체 사이클
- `git diff --check`
- Supabase advisor

로컬 테스트 합격을 원격 Supabase 합격으로 쓰지 말고, mock 브라우저 합격을 실제 두 사용자 검증으로 쓰지 마. 각 결과에 `LOCAL`, `REMOTE`, `BROWSER`, `PASS`, `FAIL`, `NOT_RUN`을 명시해.

## 문서와 인수인계

각 기능이 끝날 때 다음 파일을 만들거나 최신화해.

- `02-login-HANDOFF.md`
- `03-browse-posts-HANDOFF.md`
- `04-view-profile-HANDOFF.md`
- `05-join-request-HANDOFF.md`
- `06-matching-chat-HANDOFF.md`
- `07-final-match-HANDOFF.md`
- `08-complete-appointment-HANDOFF.md`
- `09-mutual-review-HANDOFF.md`

각 HANDOFF에는 다음을 포함해.

- 실제 변경 파일
- 실제 적용한 마이그레이션과 원격 적용 여부
- 데이터 키별 형식·필수 여부·PK/FK/UNIQUE/CHECK
- 누가 생성·조회·변경할 수 있는지
- RLS/RPC 이유
- 실행 명령과 실제 결과
- A/B/C 검증 결과
- 실패와 수정 내용
- `PASS`, `FAIL`, `NOT_RUN`
- 남은 위험과 재실행 방법

루트 `HANDOFF.md`도 최종 실제 상태로 갱신하되 과거 기록과 최신 결과를 구분해. 계획 문서의 `PLAN_ONLY`를 구현 완료 기록으로 바꾸지 마.

## Notion 기록

지정 페이지:

`https://app.notion.com/p/3dd626093f2e801881f8e73f47c9618e`

기능별 구현과 원격 검증이 끝난 뒤 기능 1~9를 구분해 기록해. 각 DB 키마다 다음을 설명해.

- 키 이름과 사용자 화면에서의 의미
- 자료형과 필수 여부
- PK/FK/UNIQUE/CHECK/default
- 어떤 기능과 연결되는지
- 누가 생성·수정·조회하는지
- 공개 정보인지 비공개 정보인지
- RLS 또는 RPC가 필요한 이유
- 시각 키가 필요한 이유
- 실제 검증 결과와 `NOT_RUN`

Notion 도구나 인증이 없으면 구현을 멈추지 말고 `docs/backend-implementation/NOTION-UPDATE.md`에 같은 내용을 작성해. 이 경우 Notion을 수정했다고 쓰지 마.

## 완료 조건과 최종 보고

다음이 모두 충족돼야 완료라고 보고해.

1. 기능 1 감사와 최신 실명 계약 보정 완료
2. 기능 2~9 화면·Supabase·RLS·RPC 연결 완료
3. 기능별 하네스와 전체 사이클 하네스 실행 가능
4. 로컬 테스트·lint·build 통과
5. 대상 원격 프로젝트의 마이그레이션·권한 검증 완료
6. A/B 두 브라우저 전체 흐름 통과
7. C/anon 차단 검증 통과
8. 기능별 HANDOFF와 전체 HARNESS-REPORT 작성
9. Notion 업데이트 또는 로컬 대체 문서 작성

최종 답변은 다음 순서로 작성해.

1. 실제 완료한 사용자 흐름
2. 기능 1 감사에서 발견하고 고친 문제
3. DB 마이그레이션과 보안 요약
4. 하네스 실행 명령
5. 실제 테스트 결과
6. Notion 반영 여부
7. `NOT_RUN`과 남은 위험
8. Git 변경 파일 요약

완료되지 않은 항목이 있으면 전체 완료라고 표현하지 말고, 마지막으로 통과한 기능과 정확한 재개 명령을 남겨.
