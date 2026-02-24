# HYRESIS 용어 사전 (Wordbook)

이 문서는 현재 구현(FTP 로그 탐색 + 태그 합성 + Clause 복구) 기준의 공통 용어집이다.  
표기 원칙은 `한국어 명칭 (영문 코드명)`이다.

## 1) 화면/컴포넌트

- 앱 루트 (`app`)
: 전체 UI 컨테이너.

- 터미널 작업공간 (`terminal-workspace`)
: 좌측 FTP 패널 + 우측 터미널 패널 레이아웃.

- FTP 조사 패널 (`investigation-panel`)
: 파일 목록, preview buffer, 블록 패널이 있는 좌측 영역.

- 파일 목록 (`investigation-list`)
: 현재 경로의 디렉터리/파일 행 렌더링.

- 프리뷰 버퍼 (`investigation-content`)
: 원격 파일 본문 프리뷰. 문장 내 태그는 클릭 가능한 링크(`preview-tag-link`)로 노출.

- 블록 패널 (`block0-panel`)
: 태그 인벤토리/합성/레시피/복구 슬롯 UI.

- 태그 인벤토리 (`block0-tag-inventory`)
: 획득 태그 목록. 드래그 시작 지점.

- 합성 슬롯 (`block0-synthesis-a`, `block0-synthesis-b`, `block0-synthesis-c`)
: 재료 드롭 대상. A는 연산자, B/C는 인자.

- 합성 실행 버튼 (`block0-synthesis-button`)
: 현재 슬롯 조합을 합성 시도.

- 복구 대상 슬롯 (`block0-purpose-slot`)
: Clause 목적 슬롯. 인벤토리 태그 드래그 드롭으로 채움.

- 기억 조각 팝업 (`block0-memory-modal`)
: 1막 종료 연출 모달. `다음 복구 시작`으로 Block 1 진입.

## 2) 런타임 흐름

- 부팅 (`BOOTING`)
: 시스템 오버레이 출력 단계.

- 인증 대기 (`LOGIN_REQUIRED`)
: 로그인 콘솔 입력 단계.

- 채널 부착 (`ATTACHING`)
: 인증 성공 후 attach 연출 단계.

- 스트리밍 (`STREAMING`)
: FTP 탐색/프리뷰/태그 플레이 가능 단계.

- Block 0 시작 조건
: 로그인 후 `/복구됨`에서 `부팅.log`를 열면 시작.

- Block 1 전환 조건
: Block 0 Clause 완료 -> 기억 조각 팝업 -> 버튼 클릭.

## 3) 태그 도메인

- 태그 분류 (`TAG_CATEGORY_GROUPS`)
: `개체/행위/상태/관계/제약`.

- 색상 규칙
: 태그는 분류 텍스트 없이 색상으로만 구분한다.

- 개념 태그
: 괄호식 합성 결과 태그. 예: `도움(인간)`, `판단(자기)`.

## 4) 합성 도메인

- 합성 시그니처 (`TAG_COMPOSITION_SIGNATURES`)
: 연산자 태그별 인자 타입 규칙.

- 명시 레시피 (`synthesisRules`)
: 블록별 고정 조합 규칙. 먼저 검사한다.

- 타입 기반 합성 (`runTypeDrivenSynthesis`)
: 명시 레시피 불일치 시 시그니처 기반 폴백 합성.

- 성공 처리
: 결과 태그 획득 + 레시피 발견 기록 + 사용 재료 소모.

- 실패 처리
: 슬롯/재료 유지, 실패 로그만 출력.

## 5) 복구/퍼즐 도메인

- Clause (`clause`)
: 현재 복구 목표. `questions`, `slots`, `outputText`로 구성.

- 목적 슬롯 정답
: Block 0에서는 `도움(인간)`만 허용.

- 메모리 해제 (`memory_unlocked`)
: Clause 복구 완료 시 true. 모달 표시 트리거.

## 6) 무결성/해시 도메인

- 해시라인 (`hashline`)
: 각 로그 `lines` payload(해당 줄 제외) 기반 SHA-256 무결성 값.

- 검증 명령 (`verify hashline`)
: preview/selected/all 대상 무결성 검사.

- 해시 인덱스 문서
: `doc/hashline_index.md`

## 7) 커뮤니케이션 예시

- "Block 0는 `부팅.log` 열람 트리거로 시작한다."
- "합성은 드래그 드롭 슬롯 입력 후 `합성` 버튼으로만 실행된다."
- "A 슬롯은 연산자이고 B/C 슬롯 활성은 시그니처 길이에 따라 결정된다."
- "Clause 완료 후 `block0-memory-modal`에서 다음 챕터로 전환한다."
