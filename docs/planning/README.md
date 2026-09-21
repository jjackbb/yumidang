# 기획 문서 안내

제품 요구사항·정책·화면 설계 자료를 이 폴더에 모았다. 2026-09-21 파일 분류 기준이며, 문서 이동이 기획 내용의 확정을 뜻하지는 않는다.

## 분류

| 폴더 | 내용 | 시작할 문서 |
|---|---|---|
| `requirements/` | MVP 목표·인터뷰 질문·기능 요구사항 원문 사본 | [MVP](requirements/MVP.md), [기능명세](requirements/FEATURE_SPEC.md) |
| `product-decisions/` | 제품 정책·확정 결정·미결정 질문·팀 회의 자료 | [정책 자료 안내](product-decisions/README.md) |
| `design/` | 화면 목록·AI 기능 설계·디자인 기준·와이어프레임 | [화면 구조](design/SCREEN_INVENTORY.md), [와이어프레임](design/yumidang-wireframes.html), [AI 설계](design/AI_FEATURES_DESIGN.md) |
| `design-selection/` | 과거 화면 대안·사용자 선택·정책 질문 기록 | [화면 대안](design-selection/SKETCHES.html), [선택 기록](design-selection/DECISIONS.md) |
| `prototype-roadmap/` | 과거 프로토타입 계획·진행판과 관련 검증 자료 | [계획](prototype-roadmap/PLAN.md), [진행판](prototype-roadmap/BOARD.html) |

화면 이미지·HTML·관련 기록은 원래 문서와 함께 이동했다. `requirements/`는 2026-09-14 조회 사본이고, `design-selection/`·`prototype-roadmap/`는 과거 기록이다. 문서 안의 ‘현재’·‘다음 작업’은 작성 당시 맥락으로 읽는다.

## 현재 작업에서 먼저 확인할 자료

1. [전체 화면 구조](design/SCREEN_INVENTORY.md): 화면·상태·권한과 정책/API 의존성. 팀 합의 전 초안이다.
2. [팀원 1 정책 인수인계](../work-allocation/01_POLICY_HANDOFF.md): 최신 정책 질문·익명 표시·필터·공고 UX 쟁점.
3. [확정 결정이 누적된 인수인계](../handoffs/CLAUDE_CODE_인수인계_2026-09-18.md): D-A1~D-A16 등의 결정 근거. 파일명보다 실제 갱신일을 확인한다.
4. [와이어프레임 수정 기록](../handoffs/화면구조_와이어프레임_HTML_2026-09-20.md): 후속 화면 수정의 맥락.
5. [팀원 2 API 인수인계](../work-allocation/02_API_HANDOFF.md): 화면 데이터·외부 API 준비 상태.

작업 분담·인수인계는 협업 시작점을 유지하기 위해 기존 폴더에 두고 여기서 연결한다. 확정 결정·제안·정책 대기를 구분하며 과거 원문으로 최신 결정을 덮어쓰지 않는다.

## 별도 보관 자료

- [과거 요구사항·구현 비교](../analysis/notion-audit-2026-09-14/ANALYSIS.md): 기획과 구현의 차이를 확인한 기록.
- [보관 로드맵](../archive/project-history/2026-09-20/ROADMAP.md): 최신 정책과 다른 값이 포함될 수 있는 과거 자료.
- [백엔드 기술 설계](../backend-plans/), [구현·검증 운영 안내](../backend-implementation/RUNBOOK.md), [프로토타입 구현 계약](../overnight/SPEC.md): 개발·검증 문서로 기존 위치에 유지.

전체 프로젝트 분류와 이동 경로는 [파일 분류 안내](../FILE_STRUCTURE.md), 전체 문서 목록은 [문서 안내](../README.md)를 참고한다.
