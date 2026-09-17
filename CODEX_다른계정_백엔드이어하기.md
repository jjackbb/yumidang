# 다른 계정의 Codex CLI — Claude 백엔드 작업 이어받기

작성: 2026-09-17. 이 파일 작성자는 구현을 재개하지 않았으며 세션 기록·현재 파일을 읽어 인수인계만 준비했다.

## 사용자 목적과 최우선 제약

Claude Code의 ‘supabase 적용 구현 세션’이 사용량 제한으로 중단됐다. 기능 1 감사부터 2~9 원격 Supabase 적용, A/B/C 테스트, 기존 화면을 통한 전체 사이클, 결과 문서화까지 이어서 완료한다.

사용자의 마지막 구현 지시: **‘기존 UI 유지 + 백엔드 연결’로 진행.** 홈과 기존 UI/UX를 다른 앱 화면으로 교체하면 안 된다. 앞서 별도 LiveApp 화면으로 바꿔 사용자가 문제를 제기했고, 기존 App.tsx 화면에 연결하는 방향으로 수정 중이었다.

이번 세션의 노션 명세 정리는 별도 작업이다. 루트의 노션 질문지·재확인 파일을 전부 구현 요구사항으로 자동 편입하지 않는다. 특히 새 정책과 기존 구현 계획의 완료 조건 등이 다르면 해당 정책 충돌만 사용자에게 확인하고 관련 없는 테스트 복구는 계속한다. 미확정 정책을 구현하지 않는다.

## 첫 번째로 할 일

1. git status와 기존 수정 사항을 확인한다. 이미 변경된 파일을 초기화하지 않는다.
2. docs/backend-plans/CLAUDE-CODE-02-09-HARNESS-PROMPT.md 전체와 그 문서가 지정한 자료를 읽는다. 현재 인수인계의 최신 ‘기존 UI 유지’ 지시가 우선한다.
3. docs/backend-implementation/STATE.md, state.json, RUNBOOK.md, HARNESS-REPORT.md 및 최신 증거를 확인한다. 존재·내용을 실행 시 재확인한다.
4. 먼저 전체 사이클의 locator 실패를 확인하고 최소 수정 후 해당 전체 사이클을 끝까지 실행한다. 기능을 처음부터 다시 만들지 않는다.

## 확인된 중단 지점

- Claude 세션 ID: ce077c6c-8133-4bec-822b-ff50c3569594
- 원 기록: /Users/b/.claude/projects/-Users-b-Documents-Antigravity-yumidang/ce077c6c-8133-4bec-822b-ff50c3569594.jsonl
- 세션 말미 2026-09-16 16:05 UTC에 주간 한도 도달 메시지. 이후 테스트 알림에서 full-cycle FAIL이 보고됨.
- 현재 STATE.md와 세션 기록이 일치: 사전 검사·기능 1~9는 저장된 과거 실행 결과 PASS. 전체 사이클 run-ui-fc10은 PASS 9 / FAIL 1.
- 실패 단계: 10. after the end time A confirms completion and immediately submits a review
- 오류: 평가 dialog 안 getByRole('button', { name: '닫기' })가 ‘평가창 닫기’와 ‘닫기’ 버튼 2개에 매칭되어 strict mode violation.
- 현재 tests/harness/full-cycle.mjs 233행·259행에 해당 locator가 남아 있음.
- src/components/ReviewModal.tsx에는 aria-label='평가창 닫기'인 상단 버튼과 하단 ‘닫기’가 있음.
- 후보 수정: 의도한 하단 버튼이면 name:'닫기', exact:true, 상단이면 정확한 accessible name을 사용. DOM을 확인한 뒤 선택하며 .first()로 무작정 통과시키거나 화면을 재설계하지 않는다.
- 증거: docs/backend-implementation/evidence/run-ui-fc10/full-cycle.json
- 이 오류 뒤의 전체 흐름은 이 파일 작성자가 성공을 확인하지 않았다. 앞 9단계 성공만으로 최종 완료로 표시하지 않는다.

## 현 작업 트리의 중요한 변경

- src/App.tsx에서 기존 화면과 백엔드를 연결 중.
- src/live/useLiveBackend.ts, src/live/adapters.ts 신규.
- src/live/api.ts, errors.ts 변경.
- src/live/LiveApp.tsx, Appointment.tsx, Chat.tsx, CreatePost.tsx, MePage.tsx, PostDetail.tsx, PostList.tsx, format.ts, realtime.ts, ui.tsx 삭제 상태. 기존 UI 복원 과정의 변경일 수 있으므로 무조건 복구하지 않는다.
- AuthModal/CreateMeetupModal/JoinRequestModal/ReviewModal, auth 관련 파일, postForm, 여러 tests/harness 및 단위 테스트 변경.
- supabase/migrations/20260916131906_existing_ui_gender_category_author_cards.sql 신규. 원격 적용 여부를 파일 존재만으로 판단하지 않는다.
- 다수 run-ui-fc*/api* 증거 존재. run별 결과를 구분한다.
- 노션 인수인계·스냅샷·재확인 파일은 다른 작업 산출물이므로 보존한다.

## 인프라·권한 범위

- 현재 저장소 실행 프롬프트의 허용 Supabase ref: bndguguarijmghnkenvt
- URL: https://bndguguarijmghnkenvt.supabase.co
- 첫 원격 읽기 및 변경 직전 각각 대상을 확인한다.
- 과거 다른 프로젝트 ref fiaxchvyywpqbwbcuzfz / sdfyostmwedvonwmmnej 로 실제 네트워크 요청하지 않는다.
- 테스트 번호·고정 OTP를 사용하는 통제된 테스트 인증이다. 실제 SMS 검증이라고 표현하지 않는다.
- test-phone-auth 활성 만료 시각이 지났으면 원 실행 지시대로 임의 연장하지 말고 필요한 조치를 보고한다.
- 원격 reset, 전체 데이터 삭제, 기존 Auth 사용자 삭제 금지. 테스트 정리는 기존 하네스의 자기 run 범위만 허용.
- 기존 미커밋 변경 보존. commit/push/PR/배포는 사용자 요청 전 수행하지 않는다.
- 키·세션·refresh token·auth.json 내용을 로그·보고서에 출력하지 않는다. 환경값은 필요한 프로세스에만 전달한다.
- 새 CODEX_HOME에서는 기존 계정의 MCP 로그인·플러그인·설정이 자동 승계되지 않을 수 있다. 가용 도구를 확인하고 필요한 경우 별도 연결한다. 기존 auth.json을 복사해 계정을 섞지 않는다.

## 실행과 완료 기준

package.json에서 확인한 명령:

```sh
npm run harness:preflight
npm run harness:full-cycle
npm run lint
npm test
npm run build
```

전체 사이클의 직전 실행은 HARNESS_APP_URL=http://127.0.0.1:4340/ 를 사용했다. tests/harness/helpers/browser.mjs의 ensureAppServer와 RUNBOOK을 읽어 서버 필요 여부·현재 포트를 확인한다. 포트가 지금도 살아 있다고 가정하지 않는다. run_id는 새로 만들어 기존 증거를 덮어쓰지 않는다.

관련 변경이 있으면 harness:01~09 중 영향을 받는 검사를 재실행한다. 저장된 PASS를 현재 소스로 다시 실행한 PASS처럼 쓰지 않는다. STATE.md/state.json은 자동 생성 결과이므로 PASS로 직접 편집하지 않는다.

실제 기존 화면에서 로그인→공고→신청→대화→수락→완료→블라인드 평가→양측 평가 공개→재접속 및 관계없는 사용자 권한 검증까지 통과해야 한다. 실패가 이어지면 실제 결함과 하네스 결함을 구분해 수정한다. Supabase 실패 시 데모 데이터로 우회하지 않는다.

최종 결과를 기능별 HANDOFF·RUNBOOK·HARNESS-REPORT 및 루트 인수인계에 맞춰 갱신하고, 실제 실행/기록에서만 확인/NOT_RUN을 구분한다. 계획서를 구현 결과로 덮어쓰지 않는다.

## 별도 계정으로 실행 — 사용자가 터미널에서 수행

아래는 ~/.codex-yumidang-secondary를 별도 Codex 저장소로 쓰는 예다. 기존 다른 계정용 경로가 있으면 그 경로를 사용한다. 기존 ~/.codex에는 logout하거나 인증 파일을 복사하지 않는다.

```sh
mkdir -p "$HOME/.codex-yumidang-secondary"
chmod 700 "$HOME/.codex-yumidang-secondary"
env CODEX_HOME="$HOME/.codex-yumidang-secondary" codex -c 'cli_auth_credentials_store="file"' login
```

브라우저에서 **이어받을 다른 GPT 계정**으로 로그인한다. 기본 브라우저가 기존 계정이면 계정을 전환하거나 로그인 URL을 해당 계정의 브라우저 프로필에서 연다. 인증은 사용자가 직접 수행한다.

로그인 확인 및 실행:

```sh
env CODEX_HOME="$HOME/.codex-yumidang-secondary" codex -c 'cli_auth_credentials_store="file"' login status
env CODEX_HOME="$HOME/.codex-yumidang-secondary" codex -c 'cli_auth_credentials_store="file"' -C /Users/b/Documents/Antigravity/yumidang 'CODEX_다른계정_백엔드이어하기.md를 읽고 Claude가 중단한 기존 UI 유지 + Supabase 백엔드 연결 작업을 이어서 완료해. 현재 변경을 보존하고 최신 상태를 확인한 뒤 전체 사이클 테스트의 중단 지점부터 진행해.'
```

file 저장 모드를 로그인·상태 확인·실행에 동일하게 적용해 인증을 지정 CODEX_HOME에 둔다. auth.json은 인증정보이므로 공유·Git 추가하지 않는다. 조직 관리 설정이 해당 옵션을 강제하면 그 요구사항을 따른다.

CODEX_HOME은 인증·설정·세션 저장소를 구분하지만 작업 폴더는 같다. 두 에이전트가 같은 코드를 동시에 수정하지 않도록 구현 작업은 새 CLI 한쪽에서 진행한다. Claude 기록을 codex resume로 직접 이어받는 것이 아니라, 이 인수인계와 기존 파일을 읽는 새 세션으로 시작한다.

공식 확인 자료(2026-09-17 조회):
- https://learn.chatgpt.com/docs/auth — file 인증 저장은 CODEX_HOME 아래 auth.json.
- https://learn.chatgpt.com/docs/config-file/config-advanced — CODEX_HOME은 설정·로컬 상태 위치.

계정 로그인/새 CLI 실행과 원격 테스트 재실행은 이 파일 작성 시 NOT_RUN. 이 파일만으로 완료를 주장하지 않는다.
