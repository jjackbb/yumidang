# 유미당 — 현재 인수인계

갱신: 2026-09-21. 작업 폴더: `/Users/b/Documents/Antigravity/yumidang`.

2026-09-21 파일 분류: 앱 코드는 `frontend/`, Supabase 서버 함수·DB 마이그레이션은 `backend/supabase/`로 이동했다. 루트 실행 명령과 환경 파일 위치는 유지한다. 이전 문서의 `src/`, `supabase/` 경로는 [파일 분류 안내](docs/FILE_STRUCTURE.md)의 대응표를 참고한다.

기획 자료는 [기획 문서 안내](docs/planning/README.md)에서 시작한다. MVP·기능명세·정책·화면 설계·과거 로드맵을 `docs/planning/`으로 모았으며, 작업 분담·인수인계는 기존 위치에서 연결한다.

## 먼저 읽을 것

1. [완료된 폴더 정리·커밋/푸시 인수인계](docs/handoffs/REPOSITORY_CLEANUP_2026-09-20.md)
2. [사용자 지시와 역할 분담](docs/handoffs/WORK_SPLIT_2026-09-20.md)
3. [팀원 1 정책 / 팀원 2 API / 사용자+GPT 설계](docs/work-allocation/README.md)
4. [전체 화면 구조 초안](docs/planning/design/SCREEN_INVENTORY.md)
5. [현재: 안티그래비티 HTML 후속 수정 이관](docs/prompts/ANTIGRAVITY_WIREFRAME_CONTINUE_2026-09-21.md)

팀원 1·2 자료 전달 예정일은 2026-09-21이며 실제 전달 완료 여부는 확인하지 않았다. 사용자와 GPT는 **팀 합의용 전체 화면 구조와 이번 주 포트폴리오**를 준비한다. 디자인·정책 문서의 초안은 자동 확정하지 않는다.

2026-09-21 현재: [HTML 인수인계](docs/handoffs/화면구조_와이어프레임_HTML_2026-09-20.md)에 Claude의 4차 수정까지 기록돼 있다. 후속 HTML 수정·관련 범위 검수를 안티그래비티로 이관할 전달문을 준비했다. GPT는 이번에 HTML을 수정하거나 브라우저 검사를 재실행하지 않았다. 과거 초기 프롬프트를 재실행해 3·4차 변경을 되돌리지 않는다. 팀원 1·2 문서에도 새로 발견한 정책·API 쟁점을 기록했다.

2026-09-20 당시: 기존 HTML의 둘러보기·필터·공고 상세·비로그인 랜덤 별칭 수정 요구를 통합해 Claude에게 전달할 문서를 작성했다. 팀원 1 문서에 ANON·UX 추가분, 팀원 2 문서에 API-08을 기록했다. 앞으로 사용자와 작업 중 생기는 정책·API 변경도 두 인수인계에 날짜·근거·확정/제안/대기를 나눠 누적한다.

## 유지할 기준

- Git `jjackbb/yumidang`, Supabase `bndguguarijmghnkenvt`, Vercel `jjackbb-projects/yumidang`.
- [9월 18일 인수인계](docs/handoffs/CLAUDE_CODE_인수인계_2026-09-18.md)에 9월 20일 D-A16까지 갱신된 확정 결정이 있다.
- D-A16: **사용자 리뷰를 바탕으로 동행 성향을 요약했습니다.**
- [과거 백엔드 검증 상태](docs/backend-implementation/STATE.md)는 당시 실행 결과다. 테스트 계정·현재 원격 데이터 상태를 보장하지 않는다.
- 미정 정책은 팀원 1, 키·API 가능성은 팀원 2 결과를 받아 화면에 반영한다.
- 2026-09-20 사용자가 이번 정리의 커밋·푸시를 명시적으로 요청했다. 이 권한을 향후 무관한 배포의 승인으로 확대하지 않는다.

## 이전 기록

[정리 전 긴 루트 인수인계](docs/archive/project-history/2026-09-20/HANDOFF.before-cleanup.md)를 보존했다. 과거의 ‘다음 작업’·‘승인 대기’·`NOT_RUN`은 당시 상태로 읽는다. 자료별 위치는 [문서 안내](docs/README.md)를 따른다.
