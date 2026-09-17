# Claude Code 인수인계 — UT 개선 후속 적용·출시

작성일: 2026-09-17 KST  
작업 폴더: `/Users/b/Documents/Antigravity/yumidang`  
현재 단계: **UT 개선 로컬 구현 완료, Supabase Expansion 적용·권한 검증 완료, 인덱스·Git·Vercel은 승인 대기**

> 이 문서는 최신 상태와 작업 경계를 전달하는 인수인계다. 이 파일을 읽었다는 사실이나 “이어서 진행해”라는 일반 요청만으로 아래의 개별 원격 변경 승인을 받은 것으로 간주하지 않는다.

## 1. Claude Code에 처음 전달할 문장

```text
/Users/b/Documents/Antigravity/yumidang/docs/handoffs/CLAUDE_CODE_UT_개선_후속_인수인계_2026-09-17.md를 먼저 끝까지 읽고, 현재 작업 트리와 원격 상태를 읽기 전용으로 다시 확인해줘. 기존 변경을 버리거나 정리하지 말고, 완료된 Supabase migration을 다시 적용하지 마. 가장 먼저 승인 대기 중인 후속 인덱스의 필요성·대상·현재 미적용 상태를 확인해 보고하고 사용자 승인을 기다려. 인덱스 적용, Git commit, push, Vercel Production 배포는 각각 별도 승인 단계로 취급해. 미확정 정책 29개는 구현하지 말고 PASS·NOT_RUN·사용자 가치 가설을 구분해줘.
```

## 2. 작업 원칙

- 사용자 판단이 정책·우선순위·외부 변경 승인보다 우선한다.
- 먼저 사실을 확인하고, 사용자 보고·로컬 확인·원격 확인·추정을 구분한다.
- 합의된 구현은 화면·서버/RPC·저장·권한·실패 UI·테스트가 연결된 수직 기능으로 마무리한다.
- 기존 데이터를 초기화하거나 과거 migration을 수정하지 않는다. DB 변경은 forward-only migration으로 처리한다.
- 한 단계의 PASS를 다음 단계의 자동 승인으로 사용하지 않는다.
- 테스트 합격을 실제 사용자 만족이나 서비스 성과로 표현하지 않는다.
- 사용자의 기존 변경, 문서 이동, 증거 파일을 임의로 `reset`, `checkout`, `restore`, stash, 삭제하지 않는다.

## 3. 고정 대상

- Git 저장소: `/Users/b/Documents/Antigravity/yumidang`
- 브랜치: `main`
- GitHub 원격: `https://github.com/jjackbb/yumidang.git`
- 허용 Supabase: `bndguguarijmghnkenvt` 하나만
- 허용 Vercel: `jjackbb-projects/yumidang` 하나만
- Production URL: `https://yumidang.vercel.app`
- 현재 로컬 HEAD / `origin/main`: `2433add0ac2c45521849864b454e5fcdc03236ab`
- 현재 Vercel Production SHA: `2433add0ac2c45521849864b454e5fcdc03236ab`

다른 Supabase/Vercel 프로젝트를 조회·수정하거나 `yumidang6` 프로젝트를 만들지 않는다. 실제 작업 직전 ref·project ID·공개 bundle의 Supabase URL을 다시 확인한다.

## 4. 우선 읽을 자료

1. 이 파일
2. `/Users/b/Documents/Antigravity/yumidang/HANDOFF.md`
3. `docs/ut-improvements/IMPLEMENTATION-2026-09-17.md`
4. `docs/backend-implementation/STATE.md`
5. `docs/backend-implementation/RUNBOOK.md`
6. `supabase/migrations/20260917122744_ut_notifications_and_discovery.sql`
7. `supabase/migrations/20260917123159_notifications_join_request_index.sql`
8. `tests/harness/ut-notifications.mjs`
9. `docs/product-decisions/README.md`

과거 `docs/archive/completed-prompts/2026-09-17/` 문서는 실행 지시가 아니라 역사 기록이다.

## 5. 완료된 상태

### 5.1 로컬 UT 개선

다음 개선은 코드와 테스트에 반영됐다.

- 참여 신청 알림 생성·표시·읽음 영속화
- 작성자 성별·만 나이 표시 및 탐색 필터
- 공고 등록 후 새 공고 상세 이동
- 평가 상태, KST 시각, 브라우저 뒤로가기
- 자동 전송하지 않는 채팅 인사말 초안 3개
- 입력을 보존하는 2단계 공고 작성
- 미구현 SOS 안내와 인증 화면 테스트 개인정보 제거
- 서버에 없는 당도·후기 등 수치를 생성하지 않는 빈 상태
- 모달 닫기·외부 클릭·Escape·접근성·reduced motion 보완
- 테스트 전화번호·OTP를 원격 테스트 환경변수로만 주입

최종 기록된 로컬 검증:

- `npm run lint`: PASS
- `npm test`: 118/118 PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- 브라우저 회귀: 33/33 PASS
- 기존 Vite 500KB 초과 chunk 경고는 유지되며 빌드 실패는 아니다.

Claude는 이 결과를 과거 보고로 취급하고, 새로운 변경을 한 경우 관련 검사를 다시 실행한다.

### 5.2 Supabase Expansion

적용 완료 migration:

`20260917122744_ut_notifications_and_discovery`

로컬 파일:

`supabase/migrations/20260917122744_ut_notifications_and_discovery.sql`

적용·검증 기록:

- 적용 직전 대상 ref `bndguguarijmghnkenvt` 일치
- 기존 `notifications` 객체와 Realtime 등록 0건
- 기존 신청 backfill 없음
- 적용 직후 `notifications` 0행
- 적용 이후 신규 신청으로 알림 1행 생성
- 작성자 B만 SELECT·Realtime 수신
- 신청자 A, 제3자 C, 익명 조회 차단
- A/C의 읽음 RPC는 B의 알림을 변경하지 못함
- B의 읽음 처리만 저장
- 기존 로그인과 공개 공고 조회 정상

검증용으로 공고·신청·읽음 알림 각 1행이 추가됐다. 기존 데이터는 수정·삭제하지 않았고 검증 행도 삭제하지 않았다. 사용자가 명시적으로 요청하지 않는 한 이 행을 삭제하지 않는다.

위 원격 결과는 이전 실행 세션의 `OBSERVED_REMOTE` 기록이다. 이 인수인계 작성 과정에서는 원격 작업을 다시 실행하지 않았다.

## 6. 현재 승인 대기 작업

### Gate 1 — 후속 인덱스

준비된 파일:

`supabase/migrations/20260917123159_notifications_join_request_index.sql`

내용:

```sql
create index notifications_join_request_idx
on public.notifications (join_request_id);
```

배경:

- Supabase advisor가 `notifications.join_request_id` 외래키의 단독 선행 인덱스 부재를 Performance INFO로 보고했다.
- 현재 보고 기준 대상 행은 1행이다.
- 행 내용 변경·삭제 없이 조회 및 FK 관련 작업 성능을 보완하는 인덱스다.
- 독립 추천은 **적용 승인**이다. 다만 아직 사용자가 승인하지 않았으므로 자동 적용하지 않는다.

승인을 받기 전 읽기 전용 확인:

1. 프로젝트 ref가 `bndguguarijmghnkenvt`인지
2. 원격 migration history에 `20260917123159`가 없는지
3. `notifications_join_request_idx`가 아직 없는지
4. `public.notifications`와 FK가 예상 계약인지
5. 현재 행 수와 advisor 결과

사용자가 명시적으로 승인한 뒤에만 적용한다. 적용 후에는 migration history, 인덱스 정의, 행 수 불변, advisor 결과를 재확인한다. 실패하면 Git push·배포로 진행하지 않고 실제 오류와 롤백 여부를 확인한다.

### Gate 2 — Git commit

아직 승인되지 않았다. 인덱스 적용 여부와 무관하게 자동 commit하지 않는다.

현재 작업 트리에는 서로 다른 성격의 변경이 함께 있다.

1. 사용자가 요청한 문서 정리
   - 루트의 과거 프롬프트·노션 파일을 `docs/archive/`, `docs/product-decisions/`로 이동
   - `docs/prompts/`와 이 인수인계 추가
2. UT 개선 코드·테스트·migration
3. 구현·원격 검증 문서와 증거
4. 브라우저 실행으로 갱신된 과거 evidence 파일과 `dist/index.html`

Claude는 먼저 파일별 소유권과 변경 이유를 분류해 사용자에게 보여준다. 삭제로 보이는 루트 문서는 새 폴더로 이동된 것이므로 복구하거나 중복 생성하지 않는다. 민감정보가 diff·증거·환경 파일에 들어 있지 않은지 확인한다.

추천 commit 분리는 다음과 같지만, 사용자의 선택 없이 확정하지 않는다.

1. `docs: organize prompts and product decision records`
2. `feat: implement UT follow-up improvements`
3. `docs: record UT verification evidence`

빌드 산출물과 대량 evidence 변경은 저장소 정책과 기존 추적 여부를 확인한 뒤 포함 여부를 별도 보고한다.

### Gate 3 — Git push

아직 승인되지 않았다. commit 승인은 push 승인이 아니다. 강제 push를 사용하지 않는다. push 직전에 branch, remote, ahead/behind, 대상 commit을 보여주고 별도 승인을 받는다.

### Gate 4 — Vercel Production 배포

아직 승인되지 않았다. push 성공은 배포 승인으로 간주하지 않는다. 배포 직전에 실제 Vercel project가 `jjackbb-projects/yumidang`인지, 빌드에 사용하는 Supabase URL이 `bndguguarijmghnkenvt`인지 다시 확인하고 별도 승인을 받는다.

DB Expansion은 이미 적용됐지만 현재 Production 프론트는 기준 SHA에 머물러 있어 새 알림 UI를 사용하지 않는다. 이는 backward-compatible expansion 상태다.

## 7. 배포 승인을 받은 뒤의 검증

Production 배포 후 최소 확인:

1. 배포 SHA와 `main`, `origin/main` 일치
2. 비로그인 공개 공고 목록·상세
3. 기존 회원 로그인과 새로고침 후 세션 유지
4. 작성자 성별·만 나이 표시와 탐색 필터
5. 새 공고 등록 후 해당 상세 이동
6. 신규 신청 → 작성자만 알림 표시·Realtime 수신 → 새로고침 후 유지 → 읽음 저장
7. 신청자·제3자·익명의 알림 접근 차단
8. 채팅 인사말은 초안만 채우고 자동 전송하지 않음
9. 완료·평가 상태와 KST 시각 표시
10. 미구현 SOS 문구와 테스트 전화번호·OTP가 화면 및 공개 bundle에 없음
11. 모달 Escape·외부 클릭·작성 중 입력 보호
12. 브라우저 콘솔 오류와 네트워크 실패 UI

실제 결과와 NOT_RUN을 구분하고 `docs/ut-improvements/IMPLEMENTATION-2026-09-17.md`, `HANDOFF.md`를 최신화한다.

## 8. 변경 금지·미확정 범위

다음은 이번 후속 출시 범위가 아니다.

- 제품 결정 문서의 미확정 정책 29개
- Instagram, MBTI/성향 테스트, 공개 페널티, 평균 응답 시간
- 채팅 이미지와 신규 Storage 정책
- 초대 횟수·유효기간·재초대
- 노쇼·제재·당도 감점·탈퇴 후 재가입
- 자연어 AI 검색, 신규 지도·캘린더 공급자
- 신규 카테고리 대량 추가와 업체 제휴
- profile-images bucket의 authenticated 전체 SELECT 범위 변경
- 테스트 인증 만료 연장 또는 실제 SMS 전환

이 항목은 사용자의 별도 판단 없이 구현·배포하지 않는다.

## 9. 알려진 제한과 위험

- advisor Security WARN 3건은 authenticated 호출이 필요한 `SECURITY DEFINER` RPC 탐지다. PUBLIC/anon 권한 회수와 `auth.uid()`/수신자 조건, A/B/C 교차 검증이 기록돼 있다. 경고를 숨기거나 권한을 완화하지 않는다.
- 후속 FK 인덱스는 아직 미적용이다.
- Realtime 장애 시 15초 polling과 focus reload가 보조하지만 알림 표시가 지연될 수 있다.
- 기존 500KB 초과 bundle 경고가 남아 있다.
- 공유 테스트 OTP는 실제 번호 소유 인증이 아니다.
- profile-images의 authenticated SELECT 범위와 객체 정리 실패 시 orphan 가능성이 기존 운영 위험으로 남아 있다.
- 작은 UT 표본의 정성 결과는 시장 전체 통계가 아니다.

## 10. 완료 보고 형식

각 단계가 끝날 때 다음 형식을 사용한다.

- 변경한 대상
- 사용자 승인 근거
- 실제 실행한 명령 또는 도구
- PASS / FAIL / NOT_RUN
- 원격 대상 ref·project·SHA
- 데이터 생성·수정·삭제 수량
- 기존 데이터 보존 확인
- 테스트와 증거 경로
- 남은 위험과 다음 승인 단계

과거 보고를 복사해 현재 검증으로 표현하지 않는다. Claude 자체 실행과 Codex 이전 실행도 구분한다.
