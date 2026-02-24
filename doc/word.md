# HYRESIS 용어 사전 (Wordbook)

이 문서는 현재 구현(원격 FTP 로그 수집 + RECOVERY 합성 복원) 기준 공통 용어집이다.  
표기 원칙은 `한국어 명칭 (코드/DOM)`이다.

## 1) 화면/컴포넌트

- 앱 루트 (`app`)
: 전체 UI 컨테이너.

- 터미널 작업공간 (`terminal-workspace`)
: 좌측 도킹 콘솔(FTP + Recovery) + 우측 `HYRESIS://runtime-shell` 레이아웃.

- FTP 세션 패널 (`investigation-panel`)
: 좌측 도킹 영역 컨테이너.

- FTP 탐색 창 (`ftp-explorer`)
: `HYRESIS FTP SESSION` 파일 목록/버퍼 미리보기 구역.

- 원격 버퍼 미리보기 (`investigation-content`)
: `RECOVERY BUFFER (REMOTE PREVIEW)` 본문 영역. 태그 링크는 `preview-tag-link`.

- 복구 콘솔 창 (`recovery-shell`)
: `RECOVERY://rebuild-console` 헤더를 가진 복구 프로그램 영역.

- 블록 패널 (`block0-panel`)
: 복구 재료/복구 합성/복구 규칙/복구 목표 UI.

- 복구 재료 인벤토리 (`block0-tag-inventory`)
: 획득 태그 목록. 드래그 시작 지점.

- 합성 슬롯 (`block0-synthesis-a`, `block0-synthesis-b`, `block0-synthesis-c`)
: 재료 드롭 대상. A는 연산자, B/C는 인자.

- 복구 합성 버튼 (`block0-synthesis-button`)
: 현재 슬롯 조합으로 합성 시도.

- 복구 목표 슬롯 (`block0-purpose-slot`)
: 목적 슬롯. 오답도 드롭 가능하며 즉시 불일치 피드백 출력.

- 기억 조각 팝업 (`block0-memory-modal`)
: 스테이지 완료 연출 모달. `다음 복구 시작`으로 Block 1 진입.

## 2) 런타임 흐름

- 부팅 (`BOOTING`)
: 시스템 오버레이 단계.

- 인증 대기 (`LOGIN_REQUIRED`)
: 로그인 입력 단계.

- 채널 부착 (`ATTACHING`)
: 인증 후 attach 연출 단계.

- 스트리밍 (`STREAMING`)
: FTP 탐색/복구 플레이 가능 단계.

- Block 0 시작 조건
: 로그인 후 `/복구됨/부팅.log` 열람.

- Block 1 전환 조건
: Block 0 복구 목표 완료 -> 기억 조각 팝업 버튼 클릭.

## 3) 태그/합성 도메인

- 태그 분류 (`TAG_CATEGORY_GROUPS`)
: `개체/행위/상태/관계/제약`.

- 시각 분류 (`getTagVisualType`)
: 분류 텍스트 대신 색상으로 타입을 표시.

- 개념 태그
: 괄호식 결과 태그. 예: `도움(인간)`, `판단(자기)`.

- 합성 시그니처 (`TAG_COMPOSITION_SIGNATURES`)
: 연산자별 인자 타입 규칙.

- 명시 레시피 (`synthesisRules`)
: 블록별 고정 조합 규칙. 우선 적용.

- 타입 기반 합성 (`runTypeDrivenSynthesis`)
: 명시 레시피 불일치 시 시그니처 기반 폴백.

- 성공 처리
: 레시피 기록 + 재료 소모 + 결과 태그 지급.

- 실패 처리
: 슬롯/재료 유지, 실패 로그만 출력.

## 4) 복구 목표 도메인

- 복구 목표 스펙 (`clause`)
: 내부 데이터 구조명. `questions`, `slots`, `outputText`를 포함.

- Block 0 정답 슬롯 값
: `도움(인간)`.

- 목표 카드 상태 클래스
: `is-goal-ready`, `is-goal-alert`, `is-goal-complete`, `is-goal-clear`.

- 메모리 해제 (`block0MemoryUnlocked`)
: 목표 완료 시 true. 팝업 표시 트리거.

## 5) 모듈 구조 (리팩토링 반영)

- 합성 엔진 (`src/game/synthesis-engine.js`)
: 순수 함수 기반 계산 모듈(재료 추출/시그니처 검사/타입 합성).

- 프리뷰 렌더러 (`src/game/preview-buffer.js`)
: PREVIEW BUFFER의 태그 링크 렌더링 전담.

- 슬롯 바인더 (`src/game/dnd-bindings.js`)
: DnD 슬롯 공통 이벤트 바인딩 유틸.

- 오케스트레이터 (`app.js`)
: 화면 상태/이벤트/로그 흐름을 조립하는 런타임 진입점.

## 6) 무결성/해시 도메인

- 해시라인 (`hashline`)
: 각 로그 `lines` payload(해시줄 제외) SHA-256 무결성 값.

- 검증 명령 (`verify hashline`)
: preview/selected/all 대상 무결성 검사.

- 해시 인덱스
: `doc/hashline_index.md`
