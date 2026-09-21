# 기획 문서 안내

제품 요구사항·정책·화면 설계 자료를 이 폴더에 모았다. 2026-09-21 파일 분류 기준이며, 문서 이동이 기획 내용의 확정을 뜻하지는 않는다.

## 현재 기준

[PRD](requirements/PRD.md) → [IA](design/IA.md) → [유저플로우](design/USER_FLOW.md)를 현재 기준으로 사용한다. 과거 Notion·화면 분석의 출처는 [보관 안내](../archive/design-selection/README.md)로 분리했다.

## 분류

| 폴더 | 내용 | 시작할 문서 |
|---|---|---|
| `requirements/` | PRD·MVP 목표·인터뷰 질문·기능 요구사항 | [PRD](requirements/PRD.md), [MVP](requirements/MVP.md), [기능명세](requirements/FEATURE_SPEC.md) |
| `product-decisions/` | 제품 정책·확정 결정·미결정 질문·팀 회의 자료 | [정책 자료 안내](product-decisions/README.md) |
| `design/` | IA·유저플로우·화면 목록·디자인·와이어프레임 | [PRD 반영 IA](design/IA.md), [여성 전용 유저플로우](design/USER_FLOW.md), [와이어프레임](design/yumidang-wireframes.html), [AI 설계](design/AI_FEATURES_DESIGN.md) |

화면 이미지·HTML·관련 기록은 원래 문서와 함께 이동했다. `requirements/PRD.md`는 사용자가 제공한 PRD이며, `requirements/MVP.md`와 `requirements/FEATURE_SPEC.md`는 2026-09-14 조회 사본이다. `../archive/design-selection/`·`../archive/prototype-roadmap/`는 과거 기록으로 보관했다. 문서 안의 ‘현재’·‘다음 작업’은 작성 당시 맥락으로 읽는다.

## 현재 작업에서 먼저 확인할 자료

1. [PRD 반영 IA](design/IA.md)와 [여성 전용 유저플로우](design/USER_FLOW.md): 성인 여성만 가입·이용하는 구조와 행동 흐름. 과거 화면 구조와 시안은 보관 자료이며 현재 요구사항은 이 문서들을 따른다.
2. [팀원 1 정책 인수인계](../collaboration/work-allocation/01_POLICY_HANDOFF.md): 최신 정책 질문·익명 표시·필터·공고 UX 쟁점.
3. [확정 결정이 누적된 인수인계](../collaboration/handoffs/CLAUDE_CODE_인수인계_2026-09-18.md): D-A1~D-A16 등의 결정 근거. 파일명보다 실제 갱신일을 확인한다.
4. [와이어프레임 수정 기록](../collaboration/handoffs/화면구조_와이어프레임_HTML_2026-09-20.md): 후속 화면 수정의 맥락.
5. [팀원 2 API 인수인계](../collaboration/work-allocation/02_API_HANDOFF.md): 화면 데이터·외부 API 준비 상태.

작업 분담·인수인계는 `../collaboration/`에 모으고 여기서 연결한다. 확정 결정·제안·정책 대기를 구분하며 과거 원문으로 최신 결정을 덮어쓰지 않는다.

## 별도 보관 자료

- [과거 IA·유저플로우·화면 선택 기록](../archive/design-selection/README.md): 이전 화면 초안·Notion 출처·시안 연결 문제.
- [프로토타입 계획](../archive/prototype-roadmap/PLAN.md), [진행판](../archive/prototype-roadmap/BOARD.html): 이전 구현 순서·검증 맥락.

- [과거 요구사항·구현 비교](../archive/analysis/notion-audit-2026-09-14/ANALYSIS.md): 기획과 구현의 차이를 확인한 기록.
- [보관 로드맵](../archive/project-history/2026-09-20/ROADMAP.md): 최신 정책과 다른 값이 포함될 수 있는 과거 자료.
- [백엔드 기술 설계](../development/backend-plans), [구현·검증 운영 안내](../development/backend-implementation/RUNBOOK.md), [프로토타입 구현 계약](../archive/overnight/SPEC.md): 개발·검증 자료와 과거 구현 계약으로 분류한다.

전체 프로젝트 분류와 이동 경로는 [파일 분류 안내](../FILE_STRUCTURE.md), 전체 문서 목록은 [문서 안내](../README.md)를 참고한다.
