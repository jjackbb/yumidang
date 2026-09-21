# Antigravity 실행 프롬프트 — Stitch 시안을 실제 화면에 적용

사용법: 화면 1개(또는 밀접한 2개)마다 아래 `실행 프롬프트`를 새로 붙여 넣고 `{화면 ID}`, `{시안 경로}`만 바꾼다.
예: `S01 둘러보기`, `docs/planning/design/stitch-export/S01_둘러보기.png` (+ HTML이 있으면 함께)

---

## 실행 프롬프트

```text
작업 폴더: /Users/b/Documents/Antigravity/yumidang (React 19 + Vite + Tailwind v4, 브랜치 main)

이번 작업: {화면 ID} 화면의 "겉모양"만 Google Stitch 시안으로 교체한다.
시안: {시안 경로}
디자인 기준: docs/planning/design/DESIGN.md
화면 요구사항: docs/planning/design/STITCH_PROMPTS.md 의 {화면 ID} 항목

## 반드시 지킬 원칙
1. 동작 로직은 바꾸지 않는다.
   - props, state, 이벤트 핸들러, API 호출(frontend/src/live/*), 유틸(frontend/src/utils/*), 타입(frontend/src/types.ts), 검증 규칙을 수정하지 않는다.
   - JSX 구조와 className(Tailwind)만 바꾼다. 필요한 경우 같은 파일 안에서 순수 표시용 하위 컴포넌트로 나누는 것은 허용한다.
2. 기능을 추가하거나 제거하지 않는다.
   - 시안에 있지만 코드에 없는 버튼·데이터는 만들지 않는다.
   - 코드에 있지만 시안에 없는 버튼·문구·상태(빈 상태, 오류, 비활성, 로딩, 권한별 분기)는 지우지 말고 새 디자인 스타일로 배치한다.
3. 다음은 테스트가 의존하므로 그대로 유지한다: id, data-* 속성, aria-label, role, 버튼·링크의 한국어 텍스트.
   문구를 꼭 바꿔야 하면 바꾸지 말고 목록으로 보고만 한다.
4. 안전·개인정보 문구는 의미를 유지한다: 상세 장소 확정 후 공개, 실명·생년월일 비공개, 인사말 자동 전송 안 함, "프로토타입 예시 행사", "준비 중" 안내 등.
5. 색상은 DESIGN.md 토큰(#6C2CF5 등)만 쓴다. 새 색·그라데이션·다크모드를 넣지 않는다.
6. 이번 화면과 관련 없는 파일, 홈 화면(Header, EventBanner, AppointmentReminders, CategoryGrid, BottomNav)은 수정하지 않는다.
7. 새 npm 패키지를 설치하지 않는다. 아이콘은 기존 lucide-react를 쓴다.
8. Supabase, Vercel, 환경변수, migration은 건드리지 않는다. git push와 배포는 하지 않는다.

## 순서
1. 대상 컴포넌트 파일과 이를 여는 frontend/src/App.tsx 부분을 읽고, 화면에 있는 모든 상태·분기를 목록으로 정리한다.
2. 시안과 비교해 "시안에만 있는 것 / 코드에만 있는 것"을 먼저 보고한다.
3. 스타일을 적용한다.
4. 다음을 실행하고 모두 통과해야 완료다:
   - npm run lint
   - npm test
   - npm run build
   - git diff --check
5. npm run dev 로 http://localhost:3000 에서 모바일 폭(390px)으로 해당 화면을 열어 스크린샷을 남긴다(비로그인에서 볼 수 있는 상태 위주). 경로: docs/planning/design/applied/{화면 ID}.png
6. 통과하면 해당 화면 파일만 commit 한다. 메시지: "style: apply redesigned {화면 ID}" (push 금지)

## 보고 형식
- 수정한 파일 목록
- 유지한 상태·분기 목록 / 시안과 달라진 점과 이유
- 바꾸고 싶었지만 원칙 때문에 보류한 문구·동작
- lint/test/build/diff-check 결과 (PASS/FAIL, 실패 시 실제 오류)
- 스크린샷 경로, commit SHA
- 확인하지 못한 상태(NOT_RUN)
```

---

## 적용 순서와 대상 파일 (참고)

| ID | 화면 | 주요 파일 |
|---|---|---|
| S01 | 둘러보기 | `frontend/src/components/ExploreView.tsx` |
| S02 | 공고 상세 | `frontend/src/components/PostDetailModal.tsx` |
| S03·S04 | 공고 작성 1·2단계 | `frontend/src/components/CreateMeetupModal.tsx` |
| S05~S07 | 로그인·가입 | `frontend/src/components/AuthModal.tsx`, `PhoneInput.tsx` |
| S08 | 참여 신청 | `frontend/src/components/JoinRequestModal.tsx`, `LifecycleDialogs.tsx`(일정 충돌만) |
| S09 | 카테고리·행사 | `CategoryDetailModal.tsx`, `EventsView.tsx`, `EventDetailModal.tsx` |
| S10·S11 | 채팅 | `ChatListView.tsx`, `ChatView.tsx`, `ConditionReview.tsx` |
| S12 | 알림 | `NotificationModal.tsx` |
| S13 | 마이 | `MyPageView.tsx`, `CompanionRequests.tsx` |
| S14·S15 | 프로필 | `UserProfileModal.tsx`, `ProfileEditor.tsx` |
| 3차 | 약속·평가·취소·수칙 | `DashboardModal.tsx`, `CompletionActions.tsx`, `ReviewModal.tsx`, `LifecycleDialogs.tsx`, `SafetyRulesModal.tsx` — 정책 결정 후 |

## 주의

- S13 마이 시안은 보류 패널(초대·관심친구·알림 설정·에스크로·KYC)을 뺐다. **코드에서 삭제하지 말고** 그대로 두고 보고만 한다. 숨길지는 제품 결정 후 별도로 진행한다.
- 한 화면이 끝날 때마다 commit해 두면, 문제가 생긴 화면만 되돌릴 수 있다.
- 2~3개 화면이 쌓이면 Claude에게 `git log`와 diff 검수를 요청한다.
