# 회원가입 기본 프로필 사진 필수 구현 기록 — 2026-09-17

## 현재 상태

- 프로필 사진 기능 커밋 `fb8de7a`는 `origin/main`과 Vercel Production에 이미 배포되어 있었다. 실제 Vercel 프로젝트는 `yumidang`이며 오래된 `yumidang6` 로컬 링크를 실제 프로젝트 ID로 바로잡았다. 새 프로젝트는 만들지 않았다.
- Expansion `20260917052827_profile_images_required`와 Contraction `20260917094753_disable_legacy_signup_without_avatar`를 대상 `bndguguarijmghnkenvt`에 적용했다. 원격 migration history와 로컬 파일 version이 일치한다.
- Expansion은 private `profile-images` bucket, Storage 정책 3개, 검증/가입/사진 변경·삭제 RPC를 만들었다. Contraction은 `authenticated`의 구 `complete_signup(text,date,text,text,text)` 실행만 회수하고 `service_role`과 함수 소유자 권한은 유지했다.
- 시작 기준은 Auth 14 / profile 13 / post 36이었다. 실제 Production 검증 후 Auth 19 / profile 17 / post 36이며, 증가는 폐기 가능한 통제 테스트 Auth 5개와 가입 완료 profile 4개다. 중단된 남성 테스트 Auth 1개에는 profile이 없다.
- 시작 시점의 profile 13개와 post 36개의 식별 체크섬은 최종에도 동일하다. 기존 공고·신청·메시지·동행·평가를 삭제하거나 보정하지 않았고, 검증 종료 후 `profile-images` 객체는 0개다.

## 유저 인터뷰 추가 개선사항

- 이번 완료 프롬프트의 추가 개선사항은 `없음`으로 확정되어 임의 UI/정책 변경을 추가하지 않았다.
- 이전 인터뷰 후 수정한 재사용 경로 검증과 삭제 실패 문구 분리는 단위 테스트와 Production 실패 복구 흐름에서 유지됨을 확인했다.

## 실제 적용 중 복구 기록

- 첫 Expansion 시도는 `assert_owned_profile_image`의 인라인 `CASE` 조건이 PL/pgSQL에서 SQLSTATE `42601`로 실패했다. migration 전체가 롤백되어 bucket·policy·RPC·데이터가 적용 전과 동일함을 확인했다.
- 아직 적용되지 않은 migration에서 MIME과 size 형식/범위 검사를 분리하고 전체 로컬 검사를 재실행한 뒤, 같은 version으로 한 번 재적용해 성공했다.
- Production 스모크의 초기 실패 두 건은 앱 장애가 아니라 테스트 대기 조건이었다. 가입 후 인증 갱신으로 모달이 닫히는 정상 동작과 삭제 직후 CDN 다운로드 캐시를 반영해, 완료 상태 전이와 Storage 목록을 기준으로 검증하도록 수정했다.

## 사용자 흐름과 실패 복구

1. 신규 사용자는 휴대폰 확인 뒤 기본 프로필 첫 화면에서 사진을 고른다. 사진 없이는 다음/완료 버튼이 비활성화된다.
2. JPG/JPEG/PNG 원본만 받고 0 byte, 형식 불일치, 손상, 10MB 초과를 거부한다.
3. 브라우저에서 긴 변 최대 480px, JPEG 품질 0.82로 변환한다. 업로드 Blob과 미리보기 object URL은 분리하며 object URL은 재선택/언마운트 때 해제한다. base64 원본은 저장하지 않는다.
4. 여성은 기본 정보 제출 때 업로드한다. 남성은 추천 코드 또는 기관 이메일을 서버에서 먼저 확인한 뒤 최종 제출 때 업로드한다. 기본 화면과 자격 확인 화면 사이에서 선택 사진은 유지된다.
5. 업로드 실패 시 프로필 RPC를 호출하지 않는다. RPC 실패 시 이미 업로드한 같은 경로를 보관해 같은 화면 재시도에서 재업로드하지 않는다.
6. 가입 완료 RPC는 로그인 사용자 ID, 경로 첫 폴더, 실제 객체 존재, 객체 owner, JPEG MIME, 저장 크기를 서버에서 다시 검증하고 프로필/가입 자격을 한 트랜잭션으로 저장한다.
7. 성공 후 별도 프로필 사진 등록 단계는 열지 않는다. 새로고침은 File/Blob을 복구하지 않으며 사진을 다시 선택하라는 안내를 표시한다.

## Storage와 표시 계약

- private bucket: `profile-images`
- DB 값: `<auth.uid()>/<random-uuid>.jpg` 형태의 안정된 object path만 저장
- bucket 제한: `image/jpeg`, 최대 2MB. 클라이언트 원본 제한은 10MB다.
- anonymous: SELECT policy 없음
- authenticated: bucket 내 프로필 사진 읽기 가능. INSERT/DELETE는 자기 UUID 폴더만 가능
- 교체는 upsert가 아니라 `새 고유 경로 INSERT → 검증 RPC로 DB 포인터 교체 → 이전 자기 객체 DELETE`다. 따라서 Storage UPDATE policy는 만들지 않는다.
- 화면은 중앙 resolver만 사용해 5분 signed URL을 만들며 계정 전환/로그아웃 때 캐시를 비운다. raw private path는 `<img src>`로 전달하지 않는다.
- 기존 `http:`, `https:`, `data:` 값과 null은 데이터 변경 없이 유지한다. 절대 URL/data 값은 호환 표시하고 새 업로드부터 path 계약을 사용한다.

## 기존 회원과 프로필 편집

- 기존 `profiles` 행은 사진이 null이어도 로그인과 기존 글 읽기를 막지 않는다. 전역 NOT NULL/일괄 보정은 추가하지 않았다.
- 서비스 모드의 `ProfileEditor` 사진 변경/삭제를 동일한 private Storage + 검증 RPC로 연결했다.
- 교체 RPC가 실패하면 이전 DB 경로와 이전 사진은 그대로다. 성공 뒤 이전 객체 삭제가 실패하면 현재 프로필은 새 사진을 정상 표시하고 이전 객체만 orphan 후보가 된다.
- 삭제는 먼저 DB 경로를 null로 만든 뒤 이전 자기 객체를 삭제한다. 객체 삭제 실패는 깨진 DB 포인터가 아니라 orphan을 남긴다. 삭제 뒤에도 로그인은 유지된다.
- 삭제 RPC 자체가 실패하면 기존 사진이 유지되고 같은 화면에서 재시도할 수 있다고 표시한다. RPC는 성공했지만 이전 객체 정리만 실패한 경우에는 프로필 삭제 성공과 파일 정리 지연을 별도로 표시한다.
- 직접 `profiles.avatar_url` UPDATE 권한은 새 마이그레이션에서 회수하고 `set_my_profile_avatar`/`clear_my_profile_avatar`만 사용한다.

## orphan 정리 기준

자동 삭제 작업은 이번 범위에 넣지 않았다. 이후 관리 작업은 다음 조건을 모두 만족하는 객체만 후보로 삼는다.

1. `profile-images` bucket의 `<uuid>/<uuid>.jpg` 형식이다.
2. `profiles.avatar_url` 어느 행에서도 현재 참조하지 않는다.
3. 생성 후 최소 24시간이 지나 가입/RPC 재시도 창을 벗어났다.
4. 먼저 dry-run 목록과 개수를 기록하고 작은 batch로 처리한다.
5. `storage.objects` SQL DELETE가 아니라 Storage API로 삭제한다.

legacy URL/data 값은 bucket 객체가 아니므로 정리 대상이 아니다. 삭제 직전에 참조 여부를 다시 확인하고, 불일치나 원격 개수 급변이 있으면 즉시 중단한다.

## 무중단 적용·배포 순서

### 1. expansion migration

새 private bucket/policy, `check_signup_eligibility`, `complete_signup_with_avatar`, 사진 편집 RPC를 적용한다. 기존 `complete_signup`은 이 단계에서 유지한다.

- 중단 조건: 대상 project ref 불일치, 기존 bucket 설정 충돌, 함수 생성 오류, 예상 밖 Storage policy 존재
- 롤백: 앱을 배포하지 않았다면 새 RPC execute 권한만 회수한다. bucket/object를 자동 삭제하지 않는다.

### 2. 원격 권한·legacy smoke

authenticated 자기 경로 INSERT/DELETE, authenticated signed read, anonymous read 거부, 타인 경로 write 거부를 전용 테스트 계정으로 확인한다. 기존 회원 로그인과 기존 글 목록/상세 읽기도 확인한다.

- 중단 조건: anonymous read 성공, 타인 write 성공, 기존 로그인/글 읽기 회귀
- 롤백: 프런트 배포를 진행하지 않고 policy/RPC만 수정하는 후속 migration을 준비한다.

### 3. 프런트엔드 배포

새 버전 RPC 이름을 사용하는 현재 프런트엔드를 Vercel에 배포한다.

- 중단 조건: build 실패, 환경 project ref 불일치, signed URL 원문 노출, 기존 계정 강제 가입 화면
- 롤백: 직전 프런트 배포로 되돌린다. expansion DB 객체는 호환을 위해 그대로 둔다.

### 4. 신규 가입·업로드 smoke

폐기 가능한 새 번호로 여성 1건과 남성 자격 경로 1건을 확인한다. 사진 없는 완료 거부, 타인 객체 거부, 업로드 실패 재시도, RPC 실패 재사용, 성공 후 signed 표시를 확인한다.

- 중단 조건: 사진 없는 신규 프로필 생성, object owner/path 검증 우회, 중복 프로필/과도한 orphan
- 롤백: 새 프런트를 롤백한다. 생성된 테스트 계정/객체 정리는 별도 승인된 운영 절차에서만 한다.

### 5. old no-photo 경로 차단

관찰 기간 후 별도 contraction migration으로 authenticated의 기존 `complete_signup(text,date,text,text,text)` execute를 회수한다. direct profile insert와 direct avatar update가 계속 거부되는지 다시 확인한다.

- 중단 조건: 구버전 클라이언트 호출이 남아 있음, 새 RPC 오류율 상승
- 롤백: 기존 RPC execute grant를 복구하되 신규 프런트는 유지하고 원인을 조사한다.

### 6. 최종 회귀 확인

기존 회원 로그인, null/legacy 사진 표시, 글 목록/상세를 재확인한다. 사전 명세가 지목한 기존 6개 글 제목을 우선 확인하되, 실제 baseline 10개 전체 개수도 함께 대조한다.

- 중단 조건: baseline 사용자/프로필/글 개수 감소, 기존 6개 제목 누락, 기존 계정 로그인 차단
- 롤백: 프런트부터 직전 버전으로 되돌리고 데이터 삭제 없이 읽기 전용 진단을 수행한다.

## 이번 세션 검증 범위

- 로컬 자동화: TypeScript lint, 전체 Node 테스트 113/113, production build, `git diff --check`, 사진 전용 테스트 12/12 PASS. 기존 500 kB Vite chunk 경고만 유지된다.
- mock 브라우저: 첫 업로드 실패 시 RPC 0회, 다음 업로드 성공/RPC 실패, 같은 경로 RPC 재시도 성공, 후속 사진 단계 생략 PASS.
- 실제 Supabase: private bucket 제한, policy/RPC/열 권한, 본인 INSERT·DELETE, 타인 쓰기·삭제 거부, anonymous read 거부, authenticated read, signed URL, 구 RPC 차단 PASS.
- 실제 Production 모바일 브라우저: 기존 회원 로그인과 모집 중 공고 5개, 작성자 성별·만 나이, 여성 직접 가입, 남성 추천 가입, 파일 거부·재선택, 업로드/RPC 실패 재시도, signed 재표시, 사진 교체·삭제와 로그인 유지 PASS.
- 지정 공고 6개는 DB에 모두 보존됐다. 그중 1개는 현재 `closed`라 공개 기본 목록에서는 정상적으로 제외되고 나머지 5개가 표시된다.
- Production UI의 미사용 구 가입 helper를 제거하고, 재사용 원격 하네스 fixture도 사진 객체를 준비해 `complete_signup_with_avatar`만 호출하도록 전환했다. 구 RPC 직접 호출은 권한 거부를 확인하는 음성 테스트에만 남겼다.
- 로컬 Docker Supabase migration 실행은 환경에 Docker가 없어 NOT_RUN이다. 실제 대상 프로젝트의 CLI dry-run과 원격 적용/사후 SQL 계약으로 대체했으며 이를 로컬 Docker PASS로 표현하지 않는다.

## 잔여 위험

- authenticated 회원 전체에 bucket SELECT를 허용하므로 signed URL 생성에 필요한 읽기는 가능하지만 object 목록 노출 범위도 넓다. 더 좁은 서버 발급 방식이 필요하면 별도 Edge/RPC 설계를 검토한다.
- DB 변경과 Storage object 삭제는 단일 트랜잭션이 아니어서 실패 시 안전한 orphan이 생길 수 있다. 위 24시간 dry-run 정리 기준이 필요하다.
- 테스트 인증은 공유 OTP를 쓰는 통제 환경이며 실제 전화번호 소유 인증이 아니다. 공개 운영 전 테스트 인증을 비활성화하는 별도 운영 결정이 필요하다.
- Vercel의 최종 소스는 실제 프로젝트 `yumidang`에서 확인해야 한다. `yumidang6`을 다시 만들거나 대상으로 사용하지 않는다.
