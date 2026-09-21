# 프론트엔드·백엔드 파일 분류

2026-09-21 기준. 실행되는 위치와 책임에 따라 실제 코드 폴더를 분리했다.

```text
yumidang/
├── frontend/                 # 브라우저에서 실행되는 앱
│   ├── src/
│   │   ├── components/       # 화면·모달·카드 등 React 컴포넌트
│   │   ├── auth/             # 로그인·가입 화면 로직·인증 상태
│   │   ├── live/             # 브라우저 API 호출·응답 변환·상태 관리
│   │   ├── lib/              # Supabase 브라우저 클라이언트
│   │   ├── profile/          # 프로필 이미지 업로드·경로 처리
│   │   ├── data/             # 예시 데이터·데모 계정·행사 데이터
│   │   ├── utils/            # UI에서 사용하는 계산·검증·로컬 저장
│   │   ├── assets/           # 소스에서 사용하는 이미지
│   │   ├── App.tsx           # 앱 화면 구성
│   │   ├── main.tsx          # React 시작점
│   │   ├── index.css         # 앱 스타일
│   │   ├── types.ts          # 앱 타입
│   │   └── vite-env.d.ts     # 브라우저 환경 변수 타입
│   ├── public/               # 정적 공개 파일
│   ├── index.html            # HTML 시작점
│   ├── vite.config.ts        # 프론트엔드 실행·빌드 설정
│   └── tsconfig.json         # 프론트엔드 TypeScript 설정
├── backend/
│   └── supabase/
│       ├── functions/        # 서버에서 실행되는 인증 함수
│       └── migrations/       # 테이블·RLS·DB 함수·인덱스 변경
├── tests/
│   ├── frontend/             # 앱 로직·클라이언트 계약 테스트
│   ├── backend/              # 서버 인증 함수·SQL 계약 테스트
│   ├── browser/              # 화면·사용자 흐름 검증
│   ├── harness/              # 프론트엔드와 백엔드 통합 검증
│   └── *.mjs                 # 원격 인증·프로필 이미지 검증
├── docs/
│   ├── planning/             # PRD·MVP·기능명세·정책·화면 설계
│   ├── development/          # 백엔드 기술 설계·운영·검증
│   ├── collaboration/        # 작업 분담·인수인계·프롬프트
│   └── archive/              # 과거 기록·검증 증거·보관 사본
├── scripts/                  # 과거 프로토타입 자동화 도구
├── scratch/                  # 와이어프레임 임시 수정·점검 도구
├── package.json              # 공통 의존성·루트 실행 명령
├── package-lock.json         # 의존성 버전 고정
├── tsconfig.json             # 앱·서버 함수·테스트 통합 타입 검사
├── .env.example              # 루트 환경 변수 예시
├── .gitignore                # Git 제외 규칙
├── .vercelignore             # 배포 제외 규칙
├── vercel.json               # 배포 빌드·라우팅 설정
├── README.md                 # 프로젝트 실행 안내
└── HANDOFF.md                # 현재 인수인계 시작점
```

## 헷갈리기 쉬운 경계

- `frontend/src/live/api.ts`, `frontend/src/lib/supabase.ts`는 API를 **호출하는 브라우저 코드**이므로 프론트엔드다.
- `frontend/src/auth/`, `frontend/src/profile/`도 화면에서 인증 상태·가입·업로드를 처리한다. 서버 검증은 `backend/supabase/functions/`, 데이터 접근 권한은 마이그레이션의 RLS·DB 함수에 있다.
- `frontend/src/utils/`의 동행·리뷰·공고 로직에는 데모와 화면 표시용 로직이 포함된다. 서버의 권한 검사·상태 전이는 백엔드 SQL을 함께 확인한다.
- `tests/frontend/`의 일부 계약 테스트는 백엔드 SQL도 읽는다. 브라우저와 서버를 함께 검증하는 하네스·원격 테스트는 공통 `tests/`에 유지한다.
- 별도 Express 서버 소스는 없다. 현재 백엔드는 Supabase 기반이며 루트 의존성에 `express`가 있다는 이유로 서버 파일을 새로 만들지 않았다.

## 문서·도구 분류

| 경로 | 분류·역할 |
|---|---|
| `docs/planning/` | [기획 문서](planning/README.md): PRD·요구사항·제품 정책·화면 설계 |
| `docs/development/` | 백엔드 계약·운영·검증 자료 |
| `docs/collaboration/` | 작업 분담·인수인계·작업 프롬프트 |
| `docs/archive/` | 과거 설계·구현 기록·검증 증거·보관 사본 |
| `scripts/`, `scratch/` | 개발 보조 도구. 제품의 프론트엔드·백엔드 소스와 구분 |
| `node_modules/`, `dist/`, `.vercel/`, `.overnight/` | 설치·빌드·로컬 도구 생성물. Git 추적 제외 |
| `.env`, `.env.local` 등 | 루트의 로컬 환경 설정. Git 추적 제외 |

문서는 기획·개발·협업·과거 기록 네 묶음으로 모으고 관련 링크·도구 경로를 갱신했다. 문서 내용과 기존 이미지·검증 증거는 보존한다. 과거 보고서에 등장하는 이전 코드 경로는 아래 대응표로 읽는다.

## 이전 경로 → 현재 경로

| 이전 | 현재 |
|---|---|
| `src/` | `frontend/src/` |
| `public/` | `frontend/public/` |
| `index.html` | `frontend/index.html` |
| `vite.config.ts` | `frontend/vite.config.ts` |
| `tsconfig.json`의 앱 설정 | `frontend/tsconfig.json` (루트는 통합 검사 설정) |
| `supabase/` | `backend/supabase/` |
| `tests/test-phone-auth.test.ts`, `tests/utImprovements.test.ts` | `tests/backend/`의 같은 파일명 |
| 나머지 `tests/*.test.ts` | `tests/frontend/`의 같은 파일명 |
| `docs/design/` | `docs/planning/design/` |
| `docs/product-decisions/` | `docs/planning/product-decisions/` |
| `docs/design-selection/` | `docs/archive/design-selection/` |
| `docs/prototype-roadmap/` | `docs/archive/prototype-roadmap/` |
| `docs/archive/overnight/sources/` | `docs/planning/requirements/` |

현재 제품 기준은 [PRD](planning/requirements/PRD.md), [IA](planning/design/IA.md), [유저플로우](planning/design/USER_FLOW.md)다. 이전 IA·유저플로우 자료는 [보관 안내](archive/design-selection/README.md)를 따른다.

### 문서 폴더 간소화 경로

| 이전 (`docs/` 기준) | 현재 (`docs/` 기준) |
|---|---|
| `backend-plans/`, `backend-implementation/` | `development/` 아래 같은 폴더명 |
| `handoffs/`, `prompts/`, `work-allocation/` | `collaboration/` 아래 같은 폴더명 |
| `planning/design-selection/`, `planning/prototype-roadmap/` | `archive/` 아래 같은 폴더명 |
| `analysis/`, `fixes/`, `home-update/`, `overnight/`, `post-lifecycle/`, `profile-completion/`, `ut-improvements/` | `archive/` 아래 같은 폴더명 |
| `planning/design/SCREEN_INVENTORY.md` | `archive/design-selection/SCREEN_INVENTORY.md` |
| `FILE_STRUCTURE 2.md` | `archive/duplicates/FILE_STRUCTURE 2.md` |

## 실행 기준

기존과 동일하게 **프로젝트 루트**에서 실행한다.

```bash
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run build
npm run preview
```

Vite는 `frontend/`를 앱 루트로 사용하고, `.env.local`은 프로젝트 루트에서 읽는다. 브라우저의 `/src/`·`/logo.jpg` 주소는 유지된다. 빌드 결과는 루트 `dist/`에 생성하므로 기존 Vercel 출력 경로도 유지된다.

Supabase CLI의 작업 디렉터리는 `backend/`다. 관련 명령은 `backend/`에서 실행하거나 루트에서 `--workdir backend`를 지정한다. 원격 검증 절차는 [운영 안내](development/backend-implementation/RUNBOOK.md)를 따른다.
