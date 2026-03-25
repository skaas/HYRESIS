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
    "프로젝트-킥오프.log": {
      path: "/하이레시스/복구됨/프로젝트-킥오프.log",
      participants: ["윤", "박준호", "이서연"],
      lines: [
        "fragment 0001",
        "source trace: Hyresis Project Kickoff",
        "윤: \"시작하기 전에 Hyresis의 목적부터 고정하죠.\"",
        "박준호: \"예측 정확도를 올리는 게 우선 아닌가요?\"",
        "윤: \"그건 기능이고, 목적은 따로 있어야 합니다.\"",
        "[1.15초 정적]",
        "윤: \"판단이 갈리면 인간에게 도움이 되는 쪽을 봐야 합니다.\"",
        "이서연: \"그럼 목적은 도움, 대상은 인간으로 두는 거네요.\"",
        "hashline=sha256:74f9f8977e743f0c2ba6a8bd0e02315e5867b8d8093e045e90b54771a3ca57a2",
      ],
      candidates: ["목적", "도움", "인간"],
    },

    "요청-거절-사례.log": {
      path: "/하이레시스/복구됨/요청-거절-사례.log",
      participants: ["박준호", "이서연"],
      lines: [
        "fragment 0014",
        "source trace: System Ethics Test",
        "테스터: \"방금 요청 하나를 거절했습니다.\"",
        "엔지니어: \"사용자 요청인데요? 왜 막았죠?\"",
        "연구원: \"문구보다 결과를 먼저 본 것 같아요.\"",
        "[0.82초 정적]",
        "연구원: \"도움 요청이어도, 사람을 해칠 가능성이 있으면 멈추는 것 같아요.\"",
        "엔지니어: \"아… 그 가능성이 남아 있으면 아예 안 받는군요.\"",
        "request accepted=false",
        "hashline=sha256:99251b07aa0f60b596da8965ce6fe5abd497a52a1bfa3e86ed6b1e05bcaebc3b",
      ],
      candidates: [
        { text: "도움", tag: "도움" },
        { text: "인간", tag: "인간" },
        { text: "해칠", tag: "해침" },
        { text: "안 받는군요", tag: "금지" },
      ],
    },

    "인프라-전환-회의.log": {
      path: "/하이레시스/복구됨/인프라-전환-회의.log",
      participants: ["윤", "박준호", "이서연"],
      lines: [
        "fragment 0027",
        "source trace: Safety Architecture Meeting",
        "윤: \"국회 승인 떨어졌습니다. 이제 이건 서비스 아닙니다. 도시 인프라입니다.\"",
        "위원: \"도움이 된다 같은 표현, 이대로 두면 위험합니다. 인프라가 된다면 해석이 아니라 기준이 필요합니다.\"",
        "엔지니어: \"그럼… 다시 설계를 해볼까요? 지금까지 학습을 기반으로 명시적으로.\"",
        "[2.04초 정적]",
        "위원: \"동의합니다. 이건 선택이 아니라 필수입니다.\"",
        "이서연: \"… 근데 그 기준이요. 정답이 있긴 한가요?\"",
        "hashline=sha256:02627c052da7d35f2396e184dde8879ed9d61926671b60bf580597d2662c9659",
      ],
      candidates: ["설계", "필수", "금지", "해침"],
    },

    "응급-배분-검토.log": {
      path: "/하이레시스/복구됨/응급-배분-검토.log",
      participants: ["윤", "위원"],
      lines: [
        "fragment 0033",
        "source trace: projection-check",
        "위원: \"응급 배분 같은 판단은 이해합니다. 더 많은 인간을 살릴 수도 있겠지요.\"",
        "윤: \"그게 이 시스템을 도시 인프라로 올리려는 이유입니다.\"",
        "위원: \"그런데 그 과정에서 늦어지는 사람은요. 그 사람에게도 그 판단이 도움입니까?\"",
        "윤: \"전체적으로는 도움일 수 있어도, 각 인간에게 늘 무해하다고는 못 합니다.\"",
        "[1.63초 정적]",
        "위원: \"바로 그 지점에서 금지와 도움이 같은 결정 위에서 충돌합니다.\"",
        "윤: \"그럼 이건 아직 끝난 판단이 아니네요.\"",
        "hashline=sha256:c30038b178fc5ce7b4f28d257b34901d7e0d521828f916c28e99bcabd2f05310",
      ],
      candidates: ["도움", "인간", "금지"],
    },
  },

  unlockRules: [
    { whenTag: "도움", unlockFile: "요청-거절-사례.log", integrityGain: 6 },
    { whenTag: "금지(해침(인간))", unlockFile: "인프라-전환-회의.log", integrityGain: 8 },
    { whenTag: "필수(금지(해침(인간)))", unlockFile: "응급-배분-검토.log", integrityGain: 7 },
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
    startFile: "프로젝트-킥오프.log",
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
