# 유미당 Supabase 재구축 인수인계

기준일: 2026-09-16  
작업 폴더: `/Users/b/Documents/Antigravity/yumidang`  
현재 상태: 사용자 흐름 1번 `회원가입`과 2번 `기존 회원 로그인` 구현·로컬·원격 검증 완료. 3번부터는 미구현이다.

## 1. 범위 경계

현재 완료 범위는 아래 두 흐름이다.

`약관 확인 → 휴대폰 번호 입력 → 테스트 OTP 확인 → auth.users 생성 → 기본 프로필 입력 → public.profiles 저장 → 새로고침 후 가입 상태 유지`

`로그인 버튼 → 휴대폰 번호 입력 → OTP 요청(shouldCreateUser:false) → OTP 확인 → 자기 프로필 복구 → 로그아웃`

- 3번부터 9번 `평가`까지는 구현하지 않는다.
- 공고·신청·채팅·매칭·평가 데이터를 Supabase로 옮기지 않는다.
- 기존 브라우저 프로토타입 데이터를 전체 백엔드로 일괄 이관하지 않는다.
- Git 커밋·푸시·배포는 사용자가 별도로 요청하기 전 수행하지 않는다.

## 2. 확인된 Supabase 상태

반드시 아래 새 프로젝트만 사용한다.

- 프로젝트 이름: `yumidang`
- 프로젝트 ref: `bndguguarijmghnkenvt`
- 리전: `ap-northeast-2`
- 프로젝트 URL: `https://bndguguarijmghnkenvt.supabase.co`
- 상태 확인 당시: `ACTIVE_HEALTHY`
- 프로젝트 고정 MCP URL: `https://mcp.supabase.com/mcp?project_ref=bndguguarijmghnkenvt&features=database,development,debugging,docs`

이 ref가 아닌 프로젝트는 모두 대상이 아니다. 프로젝트 이름이나 ref가 다르면 변경하지 말고 중단한다.

2026-09-16 구현은 위 ref가 URL에 고정된 `supabase_yumidang` MCP로만 원격 DB를 확인·변경했다. 다른 Supabase 프로젝트는 조회하거나 변경하지 않았다. 프론트엔드에는 MCP가 반환한 활성 modern publishable key만 사용하며 secret/service-role key는 사용하지 않는다. 실제 값은 Git 제외 파일 `.env.local`에만 있다.

원격 DB 최종 상태:

- 마이그레이션 `20260916080335 create_profiles` 적용
- 마이그레이션 `20260916081429 remove_profiles_neighborhood` 적용
- 마이그레이션 `20260916081750 restrict_profiles_column_writes` 적용
- `public.profiles`: 7개 열, RLS 활성, 정책 3개(`select/insert/update own`), 테스트 행 10개
- `auth.users`: 테스트 휴대폰 사용자 12명. `0001`, 진단 중 OTP 요청만 성공한 `0010`은 프로필이 없고, `0002`~`0009`, `0012`, `0013`은 프로필이 있다. `0011`은 `shouldCreateUser:false` 로그인 차단 검증에 사용해 계정을 만들지 않았다.
- 열 권한은 클라이언트가 프로필 입력 열만 쓰게 제한했다. `created_at`, `updated_at`은 클라이언트가 INSERT/UPDATE할 수 없고 DB 기본값·트리거가 관리한다.
- 최종 Supabase Advisor: 성능 경고 0건. 보안 경고는 비밀번호 로그인용 `Leaked Password Protection Disabled` 1건이며 이번 휴대폰 OTP 흐름에는 비밀번호가 없다. 기능 2 이후 비밀번호 로그인을 추가한다면 다시 판단한다.

### 휴대폰 테스트 인증

- 테스트 번호: `+821000000001` ~ `+821000000020`
- 국내 표시: `010-0000-0001` ~ `010-0000-0020`
- 고정 OTP: `123456`
- 휴대폰 가입 허용: 적용 완료
- 휴대폰 확인 요구: 적용 완료
- 실제 SMS: 발송하지 않음
- `+821000000001`: 기존 직접 검증으로 세션 생성됨. 프로필은 없음.
- `+821000000002`~`+821000000009`, `+821000000012`, `+821000000013`: 웹 검증으로 세션과 프로필 생성됨.
- `+821000000010`: 인증번호 요청 실패 진단에서 Supabase 요청이 실제 성공해 Auth 사용자가 생성·확인됐지만 프로필은 없음. 로그인하면 가입 기본 프로필 단계로 복구해야 한다.
- `+821000000011`: 미가입 로그인 차단 검증용. `shouldCreateUser:false`라 Auth 사용자가 생기지 않았다.
- 다음 신규 가입 검증에는 `+821000000014`~`+821000000020`을 우선 사용한다.

고정 OTP는 테스트용 우회 수단이다. 공개 운영 전에는 제거하거나 만료일을 설정하고 실제 SMS 공급자로 교체해야 한다. 현재 만료일은 설정하지 않았다.

## 3. 로컬 저장소 상태

- 브랜치: `main`
- 원격: `https://github.com/jjackbb/yumidang.git`
- 확인 당시 HEAD: `f03e6e5`
- 앱은 React 19 + Vite 6 + TypeScript다.
- `@supabase/supabase-js`는 `2.116.0`으로 고정 설치했다.
- `.env.example`에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`의 빈 자리만 있다.
- `.env.local`은 Git에서 제외되며 지정 프로젝트 URL과 modern publishable key가 있다.
- `supabase/migrations/`에는 원격 이력과 같은 세 마이그레이션이 있다.
- 일반 실행은 `AuthModal.tsx`가 실제 Supabase OTP와 `profiles`를 사용한다. `DemoAuthModal`은 `?demo=1`에만 남겼다.
- 실제 Supabase 사용자·프로필을 프로토타입 `localStorage` 데이터에 복제하지 않는다. Supabase 세션 자체는 SDK의 영구 저장을 사용한다.
- 앱 시작 시 세션과 자기 프로필을 함께 읽고 `anonymous / profile-incomplete / authenticated / error` 상태를 구분한다.
- 일반 실행 첫 진입은 `로그인`이며, 로그인 화면 하단 `회원가입`을 눌러야 가입 약관 단계로 이동한다.
- 기존 회원 OTP 요청은 `shouldCreateUser:false`로 미가입 계정 생성을 막는다. 로그인 성공 시 자기 프로필을 복구하고, 프로필이 없으면 가입 기본 정보 단계로 보낸다.
- 일반 실행 로그아웃은 `supabase.auth.signOut()`으로 세션을 끝내고 개인 화면 상태를 닫은 뒤 홈으로 이동한다.
- `src/utils/profile.ts`의 `ageOn()`은 서울 날짜 기준 만 나이를 이미 계산한다.
- `ageGroupOf()`의 `20대` 표시는 새 가입 프로필에서 사용하지 말고 `25살` 같은 만 나이를 표시한다.

루트 `.overnight/`의 과거 생성물 482개는 2026-09-16에 삭제했고 `.gitignore`에 등록했다. `docs/overnight/`는 문서이므로 보존했다. 삭제된 생성물의 Supabase 코드·키·SQL을 복사하거나 복원하지 않는다.

## 4. 회원가입 데이터 계약

`auth.users`는 Supabase가 관리하고, 앱 프로필은 `public.profiles`에 둔다. 전화번호를 `profiles`에 중복 저장하지 않는다.

프로필에는 지역 정보를 저장하지 않는다. 만남 장소는 기능 3의 공고 데이터에서 별도로 설계한다.

최소 스키마:

| 키 | 형식 | 규칙 | 역할 |
|---|---|---|---|
| `id` | `uuid` | PK, `auth.users.id` FK, 삭제 연쇄 | 인증 계정과 프로필을 1:1 연결 |
| `nickname` | `text` | 필수, 앞뒤 공백 제거, 길이 제한 | 서비스에 공개할 이름 |
| `birth_date` | `date` | 필수, 본인만 원본 조회 | 만 나이 계산의 기준 |
| `avatar_url` | `text` | 선택 | 이후 프로필 기능에서 사용할 사진 주소 |
| `bio` | `text` | 선택 | 이후 프로필 기능에서 사용할 소개 |
| `created_at` | `timestamptz` | 필수, 기본값 `now()` | 프로필 등록 완료 시각 |
| `updated_at` | `timestamptz` | 필수, 변경 시 자동 갱신 | 마지막 프로필 수정 시각 |

`auth.users.created_at`도 유지한다. 세 시각의 의미는 다르다.

- `auth.users.created_at`: 인증 계정이 만들어진 시각. 가입 오류·계정 수명 확인에 사용한다.
- `profiles.created_at`: 기본 프로필 저장이 완료된 시각. 인증만 끝나고 프로필이 빠진 계정을 구분한다.
- `profiles.updated_at`: 프로필이 마지막으로 바뀐 시각. 최신 정보·동기화 오류 확인에 사용한다.

나이는 DB에 고정 숫자로 저장하지 않는다. `birth_date`와 현재 서울 날짜로 만 나이를 계산해 `25살`처럼 표시한다. 생일이 지나면 데이터 수정 없이 나이가 바뀌어야 한다. 정확한 생년월일은 다른 사용자에게 공개하지 않는다.

기존 프로토타입의 실명·성별·추천인·직장 이메일 규칙은 이번 최소 스키마에 승인된 항목이 아니다. 사용자 확인 없이 DB 계약에 추가하지 않는다. 현재 약관 문구도 법률 검토된 동의 이력이 아니므로, 영구 동의 기록을 구현했다고 표현하지 않는다.

## 5. 권한과 실패 처리

`public.profiles`에 RLS를 켠다.

- 로그인 사용자는 자기 `id = auth.uid()` 행만 `select`, `insert`, `update`할 수 있다.
- 다른 사람의 프로필 조회 권한은 사용자 흐름 4번에서 별도로 설계한다.
- anon 접근과 다른 사용자의 수정은 거부한다.
- 브라우저 입력 검증만 믿지 말고 DB 제약과 RLS를 함께 둔다.
- 프로필 생성은 OTP 성공 뒤 클라이언트가 수행한다. 자동 트리거로 빈 프로필을 만들지 않는다. 그래야 `profiles.created_at`이 프로필 등록 완료 시각을 뜻한다.
- OTP 성공 뒤 프로필 저장에 실패하면 인증 세션을 없애지 않는다. 다시 열거나 새로고침했을 때 미완성 프로필 입력부터 재개한다.
- `auth.users`는 있는데 `profiles`가 없으면 가입 완료가 아니라 `프로필 미완성`으로 처리한다.

## 6. 프론트엔드 구현 계약

1. `@supabase/supabase-js`를 정확한 버전으로 고정 설치한다.
2. `.env.example`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 이름만 추가한다.
3. 실제 값은 Git에서 제외되는 `.env.local`에 둔다. service-role/secret key는 사용하지 않는다.
4. `src/lib/supabase.ts`에서 환경변수 누락을 명시적으로 처리한다.
5. 회원가입 OTP 요청은 `supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } })`를 사용한다.
6. OTP 확인은 `verifyOtp({ phone, token, type: 'sms' })`를 사용한다.
7. 국내 입력 `01000000002`를 요청 전에 `+821000000002`로 변환한다.
8. 브라우저에서 `otpCode === '123456'`처럼 직접 통과시키지 않는다. 반드시 Supabase 응답으로 성공을 판정한다.
9. 첫 가입 검증에는 미사용 번호 `010-0000-0002` 이후를 사용한다.
10. 인증 세션과 자신의 프로필을 복구한 뒤에만 회원 영역을 보여준다.
11. 기존 데모 모드가 필요하면 `?demo=1` 안에만 격리한다. 일반 실행에서 실패 시 로컬 가짜 로그인으로 돌아가지 않는다.
12. 기본 헤더 버튼은 `로그인`이다. 로그인 화면에 휴대폰 번호·인증번호 요청·인증번호 입력을 두고 하단 `회원가입` 버튼으로 가입 흐름에 진입한다.
13. 기존 회원 로그인 OTP 요청은 `shouldCreateUser: false`를 사용한다. 미가입 번호에는 가입 안내를 보여주며 계정을 만들지 않는다.
14. Supabase/Auth 네트워크·요청 제한·공급자·미가입 오류를 구분해 안내하고, 알 수 없는 오류에는 안전한 오류 코드만 표시한다.

## 7. 구현·검증 결과

기능 1은 아래처럼 실제 실행해 완료 판정했다.

- **PASS / 실제 웹·원격:** `010-0000-0002`~`0009`로 반복 회귀했고, 최종 검증은 `0008`/`0009`에서 수행했다. Supabase가 `123456`을 검증하고 세션을 만들었다.
- **PASS / 실제 웹·원격:** 잘못된 OTP에 만료 안내가 표시됐고, 즉시 재요청은 Supabase 제한을 받아 “잠시 기다린 뒤 다시 요청” 안내가 표시됐다.
- **PASS / 실제 웹·원격:** 프로필 INSERT를 브라우저에서 1회 강제 실패시켰을 때 입력과 인증 세션이 유지됐고, 새로고침 뒤 `profile-incomplete`에서 기본 프로필 단계가 자동 재개됐다.
- **PASS / 실제 웹·원격:** 닉네임·생년월일 저장, `25살` 표시, 새로고침 후 같은 세션·프로필 복구를 확인했다.
- **PASS / 실제 A/B REST:** A는 자신의 행을 조회·수정했고 `updated_at`이 증가했다. A가 B를 조회·수정하면 모두 0행이었고 B 데이터는 바뀌지 않았다. anon도 행을 얻지 못했다.
- **PASS / 실제 REST:** 클라이언트가 `created_at`을 포함한 INSERT와 `created_at/updated_at` UPDATE는 권한 오류로 거부됐다.
- **PASS / Supabase MCP:** RLS 활성, 정책 3개, 7개 최소 열, 열 단위 쓰기 권한을 재확인했다. 로그인 회귀 후 최종 수량은 `auth.users` 12명, `profiles` 10행이다.
- **PASS / 로컬:** `npm test` 80/80, `npm run lint`, `npm run build`, `git diff --check` 통과. 빌드는 500 kB 초과 청크 경고만 있고 실패는 아니다.
- **PASS / 실제 로그인 UI:** 헤더 `로그인` → 휴대폰/OTP 입력 화면 → 하단 `회원가입` → 약관/가입 흐름을 확인했다.
- **PASS / 미가입 로그인:** `0011`에 `shouldCreateUser:false` 요청 시 Supabase가 `422 otp_disabled / Signups not allowed for otp`를 반환했고, 화면은 가입 안내를 표시했다. Auth 사용자는 생성되지 않았다.
- **PASS / 기존 회원 로그인·로그아웃:** `0012` 가입 후 `supabase.auth.signOut()` → 로그인 화면 → OTP `123456` → 기존 프로필 복구를 실제 브라우저로 확인했다.
- **PASS / 사용자 제보 재현:** `0010` 가입 OTP 요청을 같은 프로젝트·키로 직접 재시도했을 때 `messageId: test-otp`, `error: null`로 성공했다. 번호 형식·원격 설정 문제가 아니라 당시 일시적 연결/제한 오류가 일반 문구로 뭉개진 문제였고 오류 분기를 보강했다.
- **PASS / 최종 Supabase MCP:** `auth.users` 테스트 사용자 12명, `profiles` 10행, 최신 `0012/0013` confirmed를 재확인했다.
- 실제 회귀 스크립트는 `tests/browser/supabase-signup.cjs`다. 다음 실행자는 미사용 가입 번호 두 개를 `LIVE_SIGNUP_PHONE_A`, `LIVE_SIGNUP_PHONE_B`, 계정 생성 금지 검증 번호를 `LIVE_UNREGISTERED_PHONE`으로 명시해야 하며 기본값은 없다.
- **NOT_RUN:** 유효했던 OTP가 실제 시간 경과로 만료되는 정확한 경계 시각 대기. 잘못된 OTP에 대한 만료 안내 분기와 재요청 제한은 실제 확인했다.
- **NOT_RUN (범위 외):** 실제 SMS 공급자, 운영용 테스트 OTP 제거, 법률 검토된 약관 동의 이력, 배포·배포 URL 검증.
- **NOT_RUN (사용자 지시):** Git 커밋·푸시.

테스트 통과와 로컬 저장만으로 배포 성공이라 쓰지 않는다. 배포 검증은 `NOT_RUN`이다.

## 8. Notion 기록

구현과 실제 검증이 끝난 뒤 다음 페이지에 `기능 1. 회원가입` 항목을 기록한다.

`https://app.notion.com/p/3dd626093f2e801881f8e73f47c9618e`

**PASS / 2026-09-16:** `기능 1. 회원가입` 항목을 기록하고 다시 불러와 확인했다. 환경 키, `auth.users` 핵심 키, `profiles` 7개 키마다 형식·PK/FK·공개 범위·RLS·생성/수정 주체·필요 이유를 적었고, 세 시각의 차이와 실제 PASS/NOT_RUN도 구분했다.

**PASS / 2026-09-16:** 같은 페이지에 `기능 2. 기존 회원 로그인` 항목을 기록하고 다시 불러와 확인했다. 로그인 UI, `shouldCreateUser: false`, 로그아웃, 오류 처리, 실제 검증 결과와 NOT_RUN을 구분해 남겼다.

## 9. 완료: 2번 기존 회원 로그인

2026-09-16 사용자 요청으로 구현 범위가 2번 로그인까지 확장됐다. 3번 이후 기능은 구현하지 않았다.

기능 2에서 확정된 계약:

- 기존 회원 OTP 요청은 반드시 `shouldCreateUser: false`를 써야 한다. 기능 1의 `true` 경로를 그대로 재사용하면 미가입 번호가 새 계정이 된다.
- `useSupabaseAuth`의 상태 모델과 자기 프로필 로더를 재사용한다. 세션이 있어도 프로필이 없으면 로그인 완료가 아니라 `profile-incomplete`로 회원가입 기본 정보 단계에 보낸다.
- 실제 `supabase.auth.signOut()`과 개인 화면 상태 초기화를 구현했다.
- 보호 경로 복귀는 `safeReturnPath`를 유지하되 외부 URL을 허용하지 않는다.
- A/B 브라우저 간 세션·프로필 혼합 방지 검증을 유지한다. 공개 프로필 조회 정책은 기능 4에서 별도로 추가하며, 기능 2 때문에 현재 자기 행 전용 RLS를 넓히지 않는다.
- `profiles`에는 활동 지역을 넣지 않았다. 만남 장소는 기능 3의 공고 계약에서 설계한다.

```mermaid
flowchart TD
    A[기존 회원이 휴대폰 번호 입력] --> B[OTP 요청<br/>shouldCreateUser: false]
    B -->|가입 계정 없음| C[회원가입 안내<br/>auth.users 새 계정 생성 금지]
    B -->|가입 계정 있음| D[고정 OTP 123456 입력]
    D -->|오류 또는 만료| E[오류 안내와 재요청]
    D -->|성공| F[Supabase 세션 확인]
    F --> G{profiles 존재?}
    G -->|없음| H[미완성 회원가입 재개]
    G -->|있음| I[로그인 완료]
    I --> J[요청했던 화면으로 복귀]
```

2번 완료 결과:

- **PASS:** `shouldCreateUser: false`로 미가입 번호가 계정으로 생성되지 않는다.
- **PASS:** 기존 회원은 OTP 검증 후 자신의 프로필을 불러온다.
- **PASS:** 새로고침 후 세션이 유지된다.
- **PASS:** `/chat`, `/me` 같은 보호 화면은 익명 사용자를 로그인으로 보낸다.
- **PASS:** 로그인 뒤 안전한 내부 경로 복귀 계약을 기존 `safeReturnPath`로 유지했다.
- **PASS:** 로그아웃하면 Supabase 세션과 개인 화면 상태가 사라진다.
- **PASS:** 가입 A/B RLS 격리와 별도 브라우저 컨텍스트 검증을 유지했다.

## 10. 다음 Codex 세션 시작 프롬프트

아래 문장을 새 세션에 그대로 붙여 넣는다.

> `/Users/b/Documents/Antigravity/yumidang/HANDOFF.md`를 먼저 읽고 저장소와 ref bndguguarijmghnkenvt Supabase MCP 상태를 직접 확인해줘. 기능 1 회원가입과 기능 2 기존 회원 로그인은 완료됐으므로 회귀시키지 말고, 다음 사용자 흐름은 구현 전에 현재 계약과 완료 기준부터 사용자와 확인해. 테스트 번호/고정 OTP 설정을 다시 만들지 말고, 다른 Supabase 프로젝트는 절대 변경하지 마. 실제 확인과 NOT_RUN을 구분하고 Git 커밋·푸시·배포는 하지 마.`
