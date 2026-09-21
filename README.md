# 유미당 (YouMeDang)

취향이 맞는 사람과 1:1 동행을 찾고, 대화한 뒤 약속을 확정하는 React/Vite 서비스입니다.

**현재 목표: 팀이 합의할 전체 화면 구조 만들기.**
작업을 재개할 때는 [HANDOFF.md](HANDOFF.md) → [작업 분담](docs/work-allocation/README.md) → [화면 목록](docs/planning/design/SCREEN_INVENTORY.md) 순서로 읽습니다. 전체 자료는 [문서 안내](docs/README.md)에 분류했습니다.

## 지금 할 일

- 오늘(2026-09-20): 설치·생성 파일의 Git 추적과 문서 시작점을 정리한 뒤 커밋·푸시.
- 내일(2026-09-21): 팀원 1에게 [정책 인수인계](docs/work-allocation/01_POLICY_HANDOFF.md), 팀원 2에게 [API 인수인계](docs/work-allocation/02_API_HANDOFF.md) 전달·작업 시작.
- 사용자+GPT: 전체 화면 구조 합의 → 핵심 흐름별 Stitch 시안 → Figma 기준본 정리. 정책/API 미정 부분은 표시하고 독립적인 설계는 계속합니다.

## 구현과 계획 구분

| 영역 | 현재 코드·문서 기준 |
|---|---|
| 핵심 흐름 | 가입·로그인, 공고·상대 프로필, 신청·채팅·최종 확정, 완료·상호 평가의 Supabase 연결 코드 |
| 인증 | 테스트 휴대폰 인증 경로가 있음. 실제 SMS·실명 인증 완료로 표현하지 않음 |
| 프로필 사진 | 필수 가입·사진 교체 흐름 |
| 후속 기능 | 신고·차단·초대·관심친구·일부 공고 관리·통화·결제 등 일반 모드에서 준비 중인 부분이 있음 |
| 행사·AI | 현재 행사 예시와 AI 체험 UI 존재. 실제 행사 API·AI 2종은 설계/연동 준비 단계 |
| 최신 확정 | 마스킹 이름, 만 나이 값의 `25세` 표기, 초기 `15당`, D-A16 캡션 등은 [결정 기록이 있는 인수인계](docs/handoffs/CLAUDE_CODE_인수인계_2026-09-18.md) 참고 |
| 검증 | 과거 실행 기록과 이번 확인은 [정리 인수인계](docs/handoffs/REPOSITORY_CLEANUP_2026-09-20.md)에서 구분 |

## 로컬 실행

Node.js는 `--experimental-strip-types`를 지원하는 환경이 필요합니다. 프로젝트의 테스트 명령은 해당 옵션을 사용합니다.

```bash
npm ci
cp .env.example .env.local
# .env.local의 Supabase URL·공개키·테스트 모드를 실제 작업 환경에 맞게 설정
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. `?demo=1`은 별도 로컬 체험 모드입니다.
일반 모드는 실제 Supabase를 사용하므로 계정 생성·공고 작성 등은 원격 데이터에 영향을 줍니다.

```bash
npm test
npm run build
```

`npm run build`는 TypeScript 검사(`npm run lint`)와 Vite 빌드를 포함합니다.
`test:harness`와 원격 브라우저 테스트는 실제 서비스를 사용할 수 있으므로 [운영 절차](docs/backend-implementation/RUNBOOK.md)를 먼저 읽습니다.

## 폴더 구조

| 경로 | 용도 |
|---|---|
| `frontend/` | React 화면·브라우저 로직·이미지·Vite 설정 |
| `backend/supabase/` | DB 변경 이력·접근 정책·서버 함수 |
| `tests/frontend/`, `tests/backend/` | 영역별 로컬 테스트 |
| `tests/browser/`, `tests/harness/`, `tests/*.mjs` | 브라우저·통합·원격 검증 도구 |
| `docs/work-allocation/` | 현재 담당별 작업 |
| `docs/planning/` | [기획 문서](docs/planning/README.md): MVP·기능명세·정책·화면 설계·과거 로드맵 |
| `docs/handoffs/` | 날짜별 인수인계 |
| `docs/archive/` | 완료 프롬프트·과거 루트 문서 |
| `scripts/` | 과거 프로토타입 자동화 도구. [사용 범위](scripts/README.md) 확인 |
| `node_modules/`, `dist/`, `.vercel/` | 로컬 설치·빌드·배포 연결 파일. Git 추적 제외 |

전체 파일의 분류 기준과 이전→현재 경로는 [파일 분류 안내](docs/FILE_STRUCTURE.md)를 참고합니다. 실행 명령과 `.env.local`은 프로젝트 루트 기준이며, 빌드 결과도 루트 `dist/`에 생성됩니다.

`package-lock.json`은 재현 가능한 설치를 위해 유지합니다. `.env.local`과 서버 비밀키는 Git에 넣지 않습니다.
이전 커밋에 들어 있던 설치 파일은 과거 이력에 남습니다. 이번 정리는 이력을 다시 쓰지 않습니다.

## 고정 연결 대상

- Git: [jjackbb/yumidang](https://github.com/jjackbb/yumidang), `main`
- Supabase: `bndguguarijmghnkenvt`
- Vercel: `jjackbb-projects/yumidang`, [운영 사이트](https://yumidang.vercel.app)
- `main` push는 GitHub 연동 운영 배포를 시작합니다. `.vercel/project.json`은 로컬에 유지합니다.

[정리 전 README·인수인계·로드맵](docs/archive/project-history/2026-09-20/README.md)은 역사 자료이며 현재 작업 지시가 아닙니다.
