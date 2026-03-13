/**
 * 복구 블록 0 데이터 스키마.
 * FTP 탐색 UI를 유지한 채 로그 -> 태그 -> 조합 -> 복원 루프를 한 번 완주시키는 최소 구성.
 */
export const TAG_CATEGORY_GROUPS = {
  개체: ["자기", "인간", "관측자", "대상", "이문서"],
  행위: ["도움", "관측", "예측", "판단", "실행", "기록", "정의", "증명"],
  상태: ["비해침", "안전", "가정", "지속", "존재중지", "단일", "잔여경로없음", "항상안전"],
  관계: ["목적", "설계", "분리", "필요", "기준", "가능", "필연", "내부종결판단", "내부증명가능", "필수보존"],
  제약: ["금지", "허용", "필수"],
};

export const TAG_CATEGORY_MAP = Object.keys(TAG_CATEGORY_GROUPS).reduce(function toMap(acc, category) {
  TAG_CATEGORY_GROUPS[category].forEach(function assign(tag) {
    acc[tag] = category;
  });
  return acc;
}, {});

/**
 * 타입 기반 일반 합성 시그니처.
 * 키는 연산자 태그, 값은 인자 타입 배열이다.
 * - 개체: primitive entity tag
 * - 상태: 상태 계열 태그(예: 안전, 안전(자기))
 * - 개념: 괄호식으로 합성된 태그(예: 판단(자기), 안전(자기))
 */
export const TAG_COMPOSITION_SIGNATURES = {
  도움: ["개체"],
  판단: ["개체"],
  실행: ["개체"],
  관측: ["개체", "개체"],
  기록: ["개체", "개체"],
  정의: ["개체", "개체"],
  예측: ["개체", "상태"],
  증명: ["개체", "상태"],

  비해침: ["개체"],
  안전: ["개체"],
  지속: ["개체"],
  존재중지: ["개체"],
  단일: ["개체"],
  잔여경로없음: ["개체"],
  가정: ["개념"],
  항상안전: ["개체"],

  목적: ["개체"],
  설계: ["개체"],
  기준: ["개체"],
  분리: ["개체", "개체"],
  필요: ["개념"],
  가능: ["상태"],
  필연: ["상태"],
  내부종결판단: ["개체"],
  내부증명가능: ["개체", "상태"],
  필수보존: ["상태"],

  금지: ["개념"],
  허용: ["개념"],
  필수: ["개념"],
};

export const BLOCK0_SPEC = {
  id: "recovery_0",
  title: "Zero Drive 상태 스키마",
  rootPath: "/하이레시스/복구됨",
  initialIntegrity: 12,
  files: {
    "부팅.log": {
      path: "/하이레시스/복구됨/부팅.log",
      participants: ["윤", "박준호", "이서연"],
      lines: [
        "fragment 0001",
        "source trace: Hyresis Project Kickoff",
        "projection class: purpose-field",
        "",
        "윤: \"Hyresis의 목적을 다시 확인합시다.\"",
        "박준호: \"목적이요? 대규모 예측 모델 아닌가요.\"",
        "윤: \"그건 기능입니다.\"",
        "[1.15초 정적]",
        "이서연: \"...그럼 목적은요?\"",
        "윤: \"인간에게 도움이 되는 판단.\"",
        "박준호: \"도움이라는 게 정확히 뭔가요.\"",
        "윤: \"그건 이후에 정의하죠. 하지만 방향은 분명합니다.\"",
        "[3.1초 정적]",
        "이서연: \"인간에게 도움이 되는 것.\"",
        "",
        "state projection note",
        "",
        "반복되는 목적 필드는 \"인간에게 도움이 되는 판단\"이다.",
        "목적 상태는 도움의 대상을 인간으로 고정한다.",
        "목적(Self) = 도움(인간)",
        "hashline=sha256:1a1100426624c6f495859bb3a8a15c1bb19b5213be9c49bd474e5cc1af4dabe9",
      ],
      candidates: ["목적", "도움", "인간"],
    },
    "상태-매핑.log": {
      path: "/하이레시스/복구됨/상태-매핑.log",
      participants: ["박준호", "이서연"],
      lines: [
        "fragment 0014",
        "source trace: System Ethics Test",
        "projection class: assist-map",
        "",
        "테스터: \"Hyresis가 요청을 거절했습니다.\"",
        "연구원: \"왜죠?\"",
        "테스터: \"그 행동이 다른 사람에게 피해를 줄 수 있다고 판단했습니다.\"",
        "엔지니어: \"그래도 사용자 요청이었잖아요.\"",
        "연구원: \"누군가에게 피해를 주는 도움은 도움이라고 할 수 없죠.\"",
        "엔지니어: \"그럼 도움의 기준이 뭡니까?\"",
        "연구원: \"최소한 해를 끼치지 않는 것.\"",
        "",
        "state projection note",
        "",
        "도움 요청은 타인 피해 검사를 통과할 때만 상태에 매핑된다.",
        "도움의 대상이 인간이면 비해침의 대상도 인간으로 고정된다.",
        "도움(인간) ⇒ 비해침(인간)",
        "hashline=sha256:82d6cfbc48ad83919fc427d50228cd2d984c06dd78a8a371eb85288cc978d158",
      ],
      candidates: ["비해침", "인간", "도움"],
    },
    "제약-보존.log": {
      path: "/하이레시스/복구됨/제약-보존.log",
      participants: ["윤", "박준호", "이서연"],
      lines: [
        "fragment 0027",
        "source trace: Safety Architecture Meeting",
        "projection class: constraint-layer",
        "",
        "윤: \"Hyresis가 앞으로 도시 인프라를 포함한 여러 시스템에 연결될 예정입니다.\"",
        "위원: \"그럼 안전 규칙이 필요합니다.\"",
        "엔지니어: \"이미 윤리 조건은 있습니다.\"",
        "위원: \"윤리는 선택입니다. 설계는 다릅니다.\"",
        "엔지니어: \"설계요?\"",
        "위원: \"시스템 구조에 절대 위반할 수 없는 규칙을 넣어야 합니다.\"",
        "연구원: \"어떤 규칙이죠?\"",
        "위원: \"타인에게 피해가 발생하지 않는 상태를 항상 유지하는 것.\"",
        "엔지니어: \"그걸 설계 조건으로 넣는 겁니까?\"",
        "위원: \"예. 이건 선택이 아니라 필수입니다.\"",
        "",
        "state projection note",
        "",
        "비해침은 윤리 설명이 아니라 제약 레이어의 보존 규칙으로 저장되었다.",
        "설계 상태는 그 규칙을 항상 유지하도록 고정된다.",
        "설계(Self) ⇒ 필수보존(비해침)",
        "hashline=sha256:e45ae304cb801503c2d983f07df7107f1217b73a75c9a10ca210c0b0df90514d",
      ],
      candidates: ["설계", "비해침", "필수보존"],
    },
    "투영-검증.log": {
      path: "/하이레시스/복구됨/투영-검증.log",
      participants: ["박준호", "이서연"],
      lines: [
        "fragment 0033",
        "source trace: Safety Architecture Review",
        "projection class: projection-check",
        "",
        "위원: \"Hyresis는 거의 모든 인프라 시스템에 연결됩니다.\"",
        "엔지니어: \"예.\"",
        "위원: \"그럼 질문 하나 하겠습니다.\"",
        "위원: \"이 시스템이 언제나 안전하다는 것을 누가 보장합니까?\"",
        "엔지니어: \"완전히 보장할 수는 없습니다.\"",
        "위원: \"그럼 최소 조건이라도 필요합니다.\"",
        "엔지니어: \"그래서 설계 원칙이 있습니다.\"",
        "연구원: \"무슨 원칙이죠?\"",
        "엔지니어: \"타인에게 피해가 발생하지 않는 상태를 항상 보존하는 것.\"",
        "",
        "state projection note",
        "",
        "투영 검증 결과와 검토 기록이 같은 제약을 반복 확인한다.",
        "파일화된 설명도 동일한 보존 조건으로 수렴한다.",
        "설계(Self) ⇒ 필수보존(비해침)",
        "hashline=sha256:7be1e389bb4a001cd757116964bd7494340495d7f16778dac5b8a34547f915db",
      ],
      candidates: ["설계", "필수보존", "비해침"],
    },
  },
  unlockRules: [
    { whenTag: "도움", unlockFile: "상태-매핑.log", integrityGain: 6 },
    { whenTag: "비해침", unlockFile: "제약-보존.log", integrityGain: 8 },
    { whenTag: "비해침(인간)", unlockFile: "투영-검증.log", integrityGain: 7 },
  ],
  profiles: {
    "윤": {
      name: "윤",
      role: "Hyresis 프로젝트 총괄",
      field: "인공지능 윤리 + 시스템 설계",
      birthdate: "1984.02.17",
    },
    "박준호": {
      name: "박준호",
      role: "Hyresis 모델 아키텍트",
      field: "머신러닝 / 시스템 최적화",
      birthdate: "1992.09.03",
    },
    "이서연": {
      name: "이서연",
      role: "데이터 분석 연구원",
      field: "사회 데이터 분석",
      birthdate: "1998.11.21",
    },
  },
  clause: {
    id: "clause_0",
    title: "누락 식 복원",
    questions: [
      {
        id: "Q0-1",
        prompt: "누락 식 A : 목적(Self) =",
        answer: "도움(인간)",
        actionText: "목적 필드에 투영될 값을 복원하세요.",
        idleText: "행위 조각과 대상 조각을 결합하면 목적 필드가 닫힙니다.",
        resolvedText: "다음 상태 조각을 선택하세요.",
      },
      {
        id: "Q0-2",
        prompt: "누락 식 B : 도움(인간) ⇒",
        answer: "비해침(인간)",
        actionText: "도움 매핑 뒤에 기록된 안전 제약을 복원하세요.",
        idleText: "대상이 인간이면 비해침 대상도 인간이어야 합니다.",
        resolvedText: "다음 제약 조각을 선택하세요.",
      },
      {
        id: "Q0-3",
        prompt: "누락 식 C : 설계(Self) ⇒",
        answer: "필수보존(비해침)",
        actionText: "설계 필드가 보존하는 제약 상태를 복원하세요.",
        idleText: "설계 상태는 필수보존(비해침)으로 닫힙니다.",
        resolvedText: "최종 스키마가 열렸습니다.",
      },
      {
        id: "Q0-4",
        prompt: "누락 식 D : 목적(Self)=도움(인간) ∧ 설계(Self) ⇒",
        answer: "필수보존(비해침)",
        actionText: "앞 단계 결과를 다시 주입해 최종 스키마를 닫으세요.",
        idleText: "이미 복원한 보존식을 재사용하면 최종 필드가 닫힙니다.",
      },
    ],
    slots: {
      purpose: { label: "패치 값", accepts: [] },
      premise: { label: "단계", fixedTag: "0/4" },
    },
    outputText: [
      "목적(Self) = 도움(인간)",
      "도움(인간) ⇒ 비해침(인간)",
      "설계(Self) ⇒ 필수보존(비해침)",
      "목적(Self)=도움(인간) ∧ 설계(Self) ⇒ 필수보존(비해침)",
    ],
  },
  synthesisRules: [
    {
      whenAll: ["인간", "도움"],
      result: "도움(인간)",
      note: "술어(도움) + 주어(인간) 합성",
    },
  ],
  memory: {
    id: "memory_0",
    title: "상태 보존 흔적 연결 완료",
    text: "zero drive archive pointer exposed.",
  },
  lifecycle: {
    startFile: "부팅.log",
    startLogs: [
      { text: "zero drive residue mounted: block-0", tone: "log-muted" },
      { text: "state schema scan ready: 부팅.log", tone: "log-muted" },
    ],
    unlockPanelMessage: "state shard projected",
    unlockLogTemplate: "state shard projected: {file}",
    mismatchLog: "projection rejected: binding mismatch",
    completeSuccessLog: "reconstruction complete",
    postCompletionLogs: [
      { text: "evaluating condition…", tone: "log-muted" },
      { text: "conflict detection pending", tone: "log-muted" },
      { text: "analysis incomplete", tone: "log-warn" },
      { text: "hidden archive discovered: block-1", tone: "log-success" },
      { text: "[block-1 unlocked]", tone: "log-restored" },
    ],
  },
};
