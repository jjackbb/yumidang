# 문서 안내

현재 시작점은 루트 [HANDOFF.md](../HANDOFF.md)다. **파일의 마지막 ‘현재’ 문구보다 날짜와 실제 후속 결정이 우선**한다.

## 네 가지 문서 묶음

```text
docs/
├── planning/       # PRD·MVP·기능명세·정책·화면 설계
├── development/    # 백엔드 기술 설계·운영 절차·검증
├── collaboration/  # 작업 분담·인수인계·작업 프롬프트
└── archive/        # 과거 설계·구현 기록·스크린샷·보관 사본
```

현재 기획의 기준은 [PRD](planning/requirements/PRD.md) → [IA](planning/design/IA.md) → [유저플로우](planning/design/USER_FLOW.md)다. [MVP](planning/requirements/MVP.md)·[기능명세](planning/requirements/FEATURE_SPEC.md)는 과거 조회 사본이므로 최신 기준과 대조한다. 이전 Notion 링크를 현재 IA·유저플로우의 필수 입력으로 사용하지 않는다.

## 현재 작업

| 자료 | 용도 |
|---|---|
| [파일 분류](FILE_STRUCTURE.md) | 프론트엔드·백엔드·공통 파일 위치와 이동 경로 |
| [기획 문서](planning/README.md) | PRD·MVP·기능명세·정책·화면 설계 |
| [PRD 반영 IA](planning/design/IA.md), [여성 전용 유저플로우](planning/design/USER_FLOW.md) | 성인 여성만 가입·이용하는 최신 목표 구조와 사용자 흐름 |
| [작업 분담](collaboration/work-allocation/README.md) | 팀원 1 정책·팀원 2 API·사용자+GPT 화면 설계 |
| [디자인 기준](planning/design/DESIGN.md), [Stitch 입력](planning/design/STITCH_PROMPTS.md) | 시안 생성 기준 |
| [AI 기능 설계](planning/design/AI_FEATURES_DESIGN.md) | 초안과 확정 D-A16 문구 구분 |
| [정책 자료](planning/product-decisions/README.md) | 원문·확정 결정·미결 질문 |
| [현재 실행 안내](collaboration/prompts/START_HERE.md) | 담당별 시작 문서 연결 |
| [최신 정리 기록](collaboration/handoffs/REPOSITORY_CLEANUP_2026-09-20.md) | 정리 범위·검증·커밋/푸시 상태 |

## 개발·검증 자료

- `development/backend-plans/`: 기능별 계약과 구현 인수인계.
- `development/backend-implementation/`: 실행 절차·상태·원격 검증 증거. PASS는 해당 날짜·환경에 한정한다.
- 과거 유저테스트 개선·결함 수정 기록은 `archive/ut-improvements/`, `archive/fixes/`에 보관한다.

## 이전 PRD 관련 자료와 과거 기록

[과거 IA·유저플로우 보관 안내](archive/design-selection/README.md)에 이전 화면 구조 초안·Notion 출처·시안 연결 문제를 모았다. 최신 기획 문서와 구분해 변경 이력을 찾을 때만 참고한다.

새로 저장한 `planning/requirements/PRD.md` 외에, 기존 로컬 자료에는 다음과 같은 PRD 관련 문서가 있었다.

| 자료 | 성격 |
|---|---|
| [PRD 기반 구현 로드맵](archive/project-history/2026-09-20/ROADMAP.md) | PRD를 바탕으로 만든 과거 구현 계획. PRD 원문과 다름 |
| [PRD·MVP·기능명세 비교 분석](archive/analysis/notion-audit-2026-09-14/ANALYSIS.md) | Notion PRD·PRD v2.0 링크와 당시 구현 비교 |
| `planning/requirements/MVP.md`, `FEATURE_SPEC.md` | 과거 MVP·기능명세 조회 사본 |

과거 화면 대안·진행판은 `archive/design-selection/`, `archive/prototype-roadmap/`에 보관한다. `archive/analysis/`, `home-update/`, `overnight/`, `post-lifecycle/`, `profile-completion/`에도 당시 분석·구현·검증 기록을 보존했다. 이 목록의 폴더는 모두 `archive/` 아래에 있다.

- [완료 프롬프트](archive/completed-prompts/2026-09-17/README.md)
- [정리 전 루트 문서·생성 도구 메타데이터](archive/project-history/2026-09-20/README.md)

문서와 이미지·JSON 증거는 삭제하지 않았다. 내용이 다른 `FILE_STRUCTURE 2.md` 사본은 `archive/duplicates/`에 보관하고, 현재 구조 안내는 루트의 `FILE_STRUCTURE.md`를 사용한다. 오래된 문서의 실행 지시는 현재 작업 지시로 사용하지 않는다.
