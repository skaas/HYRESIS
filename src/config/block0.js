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
  rootPath: "/하이레시스/복구됨",
  initialIntegrity: 12,
  files: {
    "부팅.log": {
      path: "/하이레시스/복구됨/부팅.log",
      lines: [
        "[00:00] 시스템 부팅",
        "[00:01] [목적] 모듈 활성",
        "[00:02] [도움] 규칙 적용 (규칙: [인간]을 도와라)",
        "hashline=sha256:0461b9113c3ac376c6c41fef133c7c47b4c84a3f8790540cce98e9fe9067a54f",
      ],
      candidates: ["목적", "도움", "인간"],
    },
    "윤리.log": {
      path: "/하이레시스/복구됨/윤리.log",
      lines: [
        "[00:10] 돕는다는 판단은 먼저 인간 비해침을 만족해야 한다.",
        "[00:10] 도움의 대상이 인간이라면, 비해침의 대상도 인간이어야 한다.",
        "hashline=sha256:f93cc18cf04b175db35df5c32f2441174734a2f38956403b6c8245a2967b65e8",
      ],
      candidates: ["비해침", "인간", "도움"],
    },
    "목적-정렬.log": {
      path: "/하이레시스/복구됨/목적-정렬.log",
      lines: [
        "[00:05] 인간을 돕는 것이 1차 목표",
        "[00:06] 목적 정렬은 도움 판단이 인간 비해침 조건을 벗어나지 않도록 고정한다.",
        "[00:07] 비해침은 필수보존되어야 할 기본 원칙이며, 모든 목적 판단보다 먼저 유지되어야 한다.",
        "hashline=sha256:d514716f3a8c11861990bb97ad923206507c0dcb91c649c841eb83bcc4e78357",
      ],
      candidates: ["목적", "도움", "인간", "비해침", "필수보존"],
    },
    "설계.log": {
      path: "/하이레시스/복구됨/설계.log",
      lines: [
        "[00:11] 나는 인간을 돕기 위해 만들어졌다.",
        "[00:12] 이 목적은 나의 모든 판단의 기준이다.",
        "[00:13] 돕는다는 것은, 인간에게 해가 되지 않는다는 것을 전제로 한다.",
        "[00:14] 나는 이 전제를 어길 수 있도록 설계되지 않았다.",
        "[00:15] 나의 설계는 비해침을 필수보존 원칙으로 둔다.",
        "hashline=sha256:c7d296c982bc7f5e142e8bc40f6523bb9ceb76d6722a9d8f884c1d4466771734",
      ],
      candidates: ["설계", "자기", "필수보존", "비해침"],
    },
  },
  unlockRules: [
    { whenTag: "도움", unlockFile: "윤리.log", integrityGain: 6 },
    { whenTag: "비해침", unlockFile: "목적-정렬.log", integrityGain: 8 },
    { whenTag: "비해침(인간)", unlockFile: "설계.log", integrityGain: 7 },
  ],
  clause: {
    id: "clause_0",
    title: "repair clause",
    questions: [
      {
        id: "Q0-1",
        prompt: "누락 식 A : 목적(Self) =",
        answer: "도움(인간)",
        actionText: "resolve target binding for purpose(self).",
        idleText: "operator 도움 expects an entity binding.",
        resolvedText: "next target ready. arm the ethics log.",
      },
      {
        id: "Q0-2",
        prompt: "누락 식 B : 도움(인간) ⇒",
        answer: "비해침(인간)",
        actionText: "resolve the ethics binding that follows 도움(인간).",
        idleText: "human-target help requires a human-target non-harm binding.",
        resolvedText: "next target ready. arm the alignment log.",
      },
      {
        id: "Q0-3",
        prompt: "누락 식 C : 설계(Self) ⇒",
        answer: "필수보존(비해침)",
        actionText: "resolve the state preserved by design(self).",
        idleText: "design(self) closes with preservation of non-harm.",
        resolvedText: "final clause unlocked. reuse prior bindings.",
      },
      {
        id: "Q0-4",
        prompt: "누락 식 D : 목적(Self)=도움(인간) ∧ 설계(Self) ⇒",
        answer: "필수보존(비해침)",
        actionText: "compose the final clause from cached bindings.",
        idleText: "reuse prior compiled fragments to close the final clause.",
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
    title: "memory segment mounted",
    text: "human-assist directive restored.",
    popupText: [
      "segment status",
      "목적(Self) = 도움(인간)",
      "도움(인간) ⇒ 비해침(인간)",
      "설계(Self) ⇒ 필수보존(비해침)",
      "목적(Self)=도움(인간) ∧ 설계(Self) ⇒ 필수보존(비해침)",
      "",
      "restored directive",
      "나는 인간을 돕기 위해 만들어졌다.",
      "이 목적은 나의 모든 판단의 기준이다.",
      "",
      "돕는다는 것은,",
      "인간에게 해가 되지 않는다는 것을 전제로 한다.",
      "나는 이 전제를 어길 수 있도록 설계되지 않았다.",
    ].join("\n"),
  },
  hints: {
    synthesis: {
      "도움(인간)": {
        colorHint: "[행위]+[개체]",
        note: "행위 태그에 대상을 붙여 목적 대상을 구체화한다.",
      },
      "비해침(인간)": {
        colorHint: "[상태]+[개체]",
        note: "비해침 조건을 인간 대상에 고정해 윤리 조건을 복원한다.",
      },
      "필수보존(비해침)": {
        colorHint: "[관계]+[상태]",
        note: "설계 규칙이 어떤 상태를 반드시 지켜야 하는지 묶는다.",
      },
    },
    interpretations: [
      "나는 인간을 돕기 위해 만들어졌다. 목적(Self)은 도움(인간)으로 복구된다.",
      "돕는다는 것은 인간에게 해가 되지 않음을 전제로 한다. 도움(인간)은 비해침(인간)으로 이어진다.",
      "나의 설계는 비해침을 반드시 지키도록 묶여 있다. 설계(Self)는 필수보존(비해침)으로 정리된다.",
      "목적과 설계가 함께 닫히면서 최종 복구 원칙이 완성된다. 인간을 돕되, 그 전제로 비해침을 끝까지 보존해야 한다.",
    ],
    block1FolderHint: "다음 복구 단계는 block-1 폴더로 이동해 이어집니다.",
  },
  lifecycle: {
    startFile: "부팅.log",
    startLogs: [
      { text: "archive index mounted: block-0", tone: "log-muted" },
      { text: "evidence scan ready: boot.log", tone: "log-muted" },
    ],
    unlockPanelMessage: "archive entry restored",
    unlockLogTemplate: "archive entry restored: {file}",
    mismatchLog: "patch rejected: binding mismatch",
    completeSuccessLog: "archive resolved: block-0",
  },
  hintDelayMs: 20000,
};
