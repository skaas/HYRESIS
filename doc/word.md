# HYRESIS 용어 사전 (Wordbook)

이 문서는 에이전트/개발자 간 커뮤니케이션용 네이밍 기준이다.  
표기 원칙은 `한국어 명칭 (영문 코드명)`이다.

## 1) 화면 구조

- 앱 루트 (`app`)
: 전체 게임 레이아웃 컨테이너.

- 상태 바 (`status-bar`)
: 상단 HUD. 무결성/Clause/Trace 등 시스템 상태를 표시.

- 터미널 영역 (`terminal`)
: 메인 플레이 영역.

- 터미널 작업공간 (`terminal-workspace`)
: 터미널 로그, 중앙 팝업, 우측 트래커를 함께 배치하는 레이아웃 래퍼.

- 터미널 로그 창 (`terminal-log`)
: 유언장 본문, 시스템 로딩, 오류 감지 메시지를 출력하는 로그 패널.

- 중앙 블록 윈도우 (`mission-overlay`)
: 오류 해제 퀴즈 팝업. 잠금 해제 전까지 진행을 막는 핵심 UI.

- 오류 창 헤더 (`mission-clause`)
: 팝업 좌측 상단 라벨. 현재 고정 표기는 `ERROR WINDOW`.

- 팝업 상태 라인 (`mission-tip`)
: 퀴즈 입력 피드백(EXACT/MISPLACED/INVALID, 입력 오류)를 한 줄로 표시하는 영역.

- 팝업 심볼 키패드 (`mission-symbols`)
: 마우스로 기호를 입력하는 버튼 영역.

- 팝업 입력줄 (`mission-input-form`, `mission-input`, `mission-submit`)
: 퀴즈 정답 시퀀스 입력/제출 UI.

- 우측 트래커 패널 (`tracker-panel`)
: 현재 목표, 시도 보드, 심볼 인텔을 보여주는 보조 패널.

- 시도 보드 (`attempt-board`)
: 최근 시도와 위치 일치 상태를 칩 형태로 누적 표시.

- 심볼 인텔 (`symbol-intel`)
: 각 기호의 현재 판정 상태(hit-correct/hit-present/hit-absent)를 요약.

- 하단 입력 패널 (`controls-panel`)
: 일반 터미널 입력 구간. 퀴즈 잠금 시 비활성화.

- 하단 명령 입력줄 (`input-form`, `command-input`, `submit-button`)
: 스트리밍 단계에서 사용하는 기본 입력.

- 심볼 팔레트 (`symbol-palette`)
: 자연어/별칭 입력을 기호로 치환하기 위한 자동완성 목록.

## 2) 게임 흐름 상태

- 오프닝 (`OPENING`)
: 인트로 로그 재생 단계.

- 계속 대기 (`WAIT_CONTINUE`)
: 오프닝 직후 오류 감지로 넘어가기 전의 내부 전이 단계(즉시 통과).

- 스트리밍 (`STREAMING`)
: 유언장 텍스트가 이어지고 일반 입력이 가능한 단계.

- 퀴즈 대기 (`QUIZ_PENDING`)
: 오류 감지만 표시하고 팝업 열기 입력(Enter)을 기다리는 단계.

- 퀴즈 잠금 (`QUIZ_LOCKED`)
: 중앙 블록 윈도우가 열린 상태. 팝업 입력만 허용.

- 종료 (`ENDED`)
: 마지막 선언 후 종료 단계.

## 3) 메시지/로그 도메인

- 유언장 스트림 로그
: `terminal-log`에 쌓이는 본문/시스템 로그.

- 차단 알림 (`[ERROR] Corrupted block detected ...`)
: 현재 블록 손상을 알리는 임시 오류 로그(`log-transient-lock`).

- 오류 감지 로그 (`[ERROR] Corrupted block detected ...`)
: 문서 읽기 도중 복구가 필요한 지점을 알리는 로그.

- 행동 안내 (`[ACTION] PRESS ENTER TO OPEN RECOVERY WINDOW`)
: 오류 복구 팝업 오픈 트리거 안내 로그.

- 복구 후 본문 재개 로그 (`[WILL] ...`)
: 복구 성공 직후 다시 읽히는 유언장 본문 라인.

- 퀴즈 피드백 라인
: `mission-tip`에 현재 슬롯 안내와 판정 피드백을 단문으로 표시.

- 고정 슬롯 (`lockedFormulaSlots`)
: `hit-correct`로 확정된 위치를 다음 시도에서도 유지하는 슬롯 상태.

## 4) 판정 용어

- 정확 일치 (`hit-correct`, EXACT)
: 기호와 위치가 모두 맞음.

- 부분 일치 (`hit-present`, MISPLACED)
: 기호는 맞지만 위치가 다름.

- 불일치 (`hit-absent`, INVALID)
: 정답 수식에 포함되지 않음.

## 5) 입력 채널 규칙

- 터미널 입력 채널
: `STREAMING`에서만 활성.

- 팝업 입력 채널
: `QUIZ_LOCKED`에서만 활성.

- 포커스 원칙
: 팝업이 뜬 상태(`QUIZ_LOCKED`)에서는 팝업 입력이 주 입력이어야 하며, 터미널 입력은 비활성으로 간주한다.

## 6) 커뮤니케이션 예시 문장

- "Clause 진입 후 `QUIZ_PENDING`에서 터미널에 차단 로그를 먼저 보여준다."
- "오프닝 본문을 읽다가 `[ERROR]` 임시 로그가 뜨면 `QUIZ_PENDING`으로 진입한다."
- "사용자 Enter 이벤트로 `QUIZ_LOCKED`로 전환하고 `mission-overlay`를 연다."
- "퀴즈 판정 피드백은 `mission-tip` 한 줄로 유지한다."
- "복구 성공 시 임시 오류 로그를 지우고 `[WILL]` 라인으로 읽기를 재개한다."
