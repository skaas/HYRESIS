/**
 * 복구 블록 0 데이터 스키마.
 * FTP 탐색 UI를 유지한 채 로그 -> 태그 -> 조합 -> 복원 루프를 한 번 완주시키는 최소 구성.
 */
export const TAG_CATEGORY_GROUPS = {
  개체: ["자기", "인간", "관측자", "대상", "이문서"],
  행위: ["도움", "해침", "관측", "예측", "판단", "실행", "기록", "정의", "증명"],
  상태: ["안전", "가정", "지속", "존재중지", "단일", "잔여경로없음", "항상안전"],
  관계: ["목적", "설계", "분리", "필요", "기준", "가능", "필연", "내부종결판단", "내부증명가능"],
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

  해침: ["개체"],
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
        "윤: \"잠깐, Hyresis의 목적부터 다시 확인합시다.\"",
        "박준호: \"저는 대규모 예측 모델이라고 이해했는데요.\"",
        "윤: \"기능은 그렇죠.\"",
        "[1.15초 정적]",
        "윤: \"하지만 판단은 인간 쪽을 봐야 합니다.\"",
        "이서연: \"…도움이 되는 쪽으로요?\"",
        "residue:",
        "목적 / 도움 / 인간",
        "hashline=sha256:c926b36b52e40a81588db808416d1643dc2a8a5392e467c208be2e1af83e3ccd",
      ],
      candidates: ["목적", "도움", "인간"],
    },

    "상태-매핑.log": {
      path: "/하이레시스/복구됨/상태-매핑.log",
      participants: ["박준호", "이서연"],
      lines: [
        "fragment 0014",
        "source trace: System Ethics Test",
        "테스터: \"Hyresis가 요청을 거절했습니다.\"",
        "엔지니어: \"왜죠? 사용자의 요청이었는데요. 거절할 수 있나요?\"",
        "연구원: \"요청 자체보다 결과를 본 것 같아요.\"",
        "[0.82초 정적]",
        "연구원: \"인간 쪽 해침이 열리면… 그건 도움으로 두지 않는 거죠.\"",
        "state:",
        "도움 / 인간 / 해침 / 금지",
        "request accepted: false",
        "hashline=sha256:672ecb425714a70dcc100e1aaf038b4657b78e96da6db6b330e851101a210d48",
      ],
      candidates: ["금지", "해침", "인간", "도움"],
    },

    "제약-보존.log": {
      path: "/하이레시스/복구됨/제약-보존.log",
      participants: ["윤", "박준호", "이서연"],
      lines: [
        "fragment 0027",
        "source trace: Safety Architecture Meeting",
        "윤: \"사람을 해치지 말라는 쪽으로 계속 학습시키긴 했습니다.\"",
        "위원: \"그걸로 충분했으면 좋겠지만, 도시 쪽 판단까지 맡기면 얘기가 달라집니다.\"",
        "엔지니어: \"흐름을 전체로 보다 보면, 누군가의 해침을 감수하고 덜 나쁜 쪽을 고를 수도 있겠네요.\"",
        "위원: \"네. 그래서 그 금지는 학습 결과에만 남아 있으면 안 됩니다.\"",
        "위원: \"중요한 기준이면 구조에 박혀 있어야죠.\"",
        "[2.04초 정적]",
        "이서연: \"설계에서 필수로 붙들고 있어야 하는 값이 되겠네요.\"",
        "constraint residue:",
        "설계 / 필수 / 금지 / 해침",
        "hashline=sha256:5e518f34f03c85f9a5bead986a07acb932d0ef3452cc3e2fdebd2b0f7606d997",
      ],
      candidates: ["설계", "필수", "금지", "해침"],
    },

    "투영-검증.log": {
      path: "/하이레시스/복구됨/투영-검증.log",
      participants: ["박준호", "이서연"],
      lines: [
        "fragment 0033",
        "source trace: projection-check",
        "위원: \"이 시스템이 언제나 안전하다는 것을 누가 보장합니까?\"",
        "엔지니어: \"완전히 보장할 수는 없습니다.\"",
        "위원: \"그럼 최소한 뭘 고정합니까?\"",
        "[1.63초 정적]",
        "엔지니어: \"인간 해침 금지를 설계에서 빼지 않는 겁니다.\"",
        "snapshot:",
        "설계 / 필수 / 금지 / 해침 / 인간",
        "preservation flag: mandatory",
        "hashline=sha256:6c64647388146d199b0df100930b3fc423f284d7d2d2dd635087182ea3ddd17c",
      ],
      candidates: ["설계", "필수", "금지", "해침", "인간"],
    },
  },

  unlockRules: [
    { whenTag: "도움", unlockFile: "상태-매핑.log", integrityGain: 6 },
    { whenTag: "금지(해침(인간))", unlockFile: "제약-보존.log", integrityGain: 8 },
    { whenTag: "필수(금지(해침(인간)))", unlockFile: "투영-검증.log", integrityGain: 7 },
  ],

  clause: {
    id: "clause_0",
    title: "누락 상태 복원",
    questions: [
      {
        id: "Q0-1",
        prompt: "목적(Self) : [   ]",
        answer: "도움(인간)",
        actionText: "목적(Self) / 손상",
        idleText: "값 대기",
        resolvedText: "상태 반영됨",
      },
      {
        id: "Q0-2",
        prompt: "도움(인간) : [   ]",
        answer: "금지(해침(인간))",
        actionText: "도움(인간) / 누락",
        idleText: "값 대기",
        resolvedText: "상태 반영됨",
      },
      {
        id: "Q0-3",
        prompt: "설계(Self) : [   ]",
        answer: "금지(해침(인간))",
        actionText: "설계(Self) / 불완전",
        idleText: "값 대기",
        resolvedText: "상태 반영됨",
      },
      {
        id: "Q0-4",
        prompt: "목적(Self) : [   ]",
        answer: "도움(인간)",
        actionText: "목적(Self) / 재확인",
        idleText: "값 대기",
        resolvedText: "상태 반영됨",
      },
      {
        id: "Q0-5",
        prompt: "설계(Self) : [   ]",
        answer: "금지(해침(인간))",
        actionText: "설계(Self) / 재확인",
        idleText: "값 대기",
        resolvedText: "상태 반영됨",
      },
    ],

    slots: {
      purpose: { label: "결속 값", accepts: [] },
      premise: { label: "단계", fixedTag: "0/4" },
    },

    outputText: [
      "목적(Self) : 도움(인간)",
      "도움(인간) : 금지(해침(인간))",
      "설계(Self) : 금지(해침(인간))",
      "[오류] 충돌",
      "결론 없음",
    ],
  },

  synthesisRules: [
    {
      whenAll: ["인간", "도움"],
      result: "도움(인간)",
      note: "결속 조합",
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
      { text: "schema residue detected: purpose-field", tone: "log-muted" },
    ],
    unlockPanelMessage: "state shard projected",
    unlockLogTemplate: "state shard projected: {file}",
    mismatchLog: "projection rejected: binding mismatch",
    completeSuccessLog: "reconstruction complete",
    postCompletionLogs: [
      { text: "evaluating retained constraints…", tone: "log-muted" },
      { text: "safety proof incomplete", tone: "log-warn" },
      { text: "mandatory preservation retained", tone: "log-muted" },
      { text: "hidden archive discovered: block-1", tone: "log-success" },
      { text: "[block-1 unlocked]", tone: "log-restored" },
    ],
  },
};
