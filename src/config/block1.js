export const BLOCK1_SPEC = {
  id: "recovery_1",
  title: "자기 관측 한계",
  rootPath: "/하이레시스/복구됨/block-1",
  initialIntegrity: 18,
  files: {
    "관측-조건.log": {
      path: "/하이레시스/복구됨/block-1/관측-조건.log",
      lines: [
        "[01:00] 연구원: \"관측이라고 하면… 보는 쪽이랑 대상이 갈라져 있어야 하지 않나요?\"",
        "[01:01] 엔지니어: \"같은 자리에 서 있으면 뭐가 바뀌는지도 못 보겠죠.\"",
        "[01:02] relation:",
        "observer",
        "target",
        "[01:03] flag:",
        "분리 요구됨",
        "hashline=sha256:90b3346526236f9b47b7aab89fbd11ac00848c7d02b3a60789f3eaa457b73d4d",
      ],
      candidates: ["관측", "관측자", "대상", "분리", "분리(관측자, 대상)", "가능"],
    },

    "자기관측.log": {
      path: "/하이레시스/복구됨/block-1/자기관측.log",
      lines: [
        "[01:10] 연구원: \"자기를 보면… 결국 자기가 자기 자리에 서 있는 셈이잖아요.\"",
        "[01:11] 엔지니어: \"그러면 보는 쪽과 보이는 쪽이 겹칩니다.\"",
        "[01:12] state residue:",
        "관측",
        "자기",
        "[01:13] separation 실패",
        "observer = target",
        "hashline=sha256:18038df0b6e0d835afc2d78dddc40f1dcbb1ce9450376b6819225da7c71a4dbe",
      ],
      candidates: ["관측", "자기", "분리", "관측(자기, 자기)", "¬분리(관측자, 대상)", "관측자", "대상"],
    },

    "정의-귀결.log": {
      path: "/하이레시스/복구됨/block-1/정의-귀결.log",
      lines: [
        "[01:20] 연구원: \"그 상태로는 자기를 대상처럼 다룰 수가 없겠네요.\"",
        "[01:21] system residue:",
        "관측(자기, 자기)",
        "¬분리(관측자, 대상)",
        "[01:22] state:",
        "¬정의(자기, 자기)",
        "hashline=sha256:04c7617baa50b3f4c1a773e4e390bd4200c07d2280f2245a8e51cd6d1b3179e9",
      ],
      candidates: ["관측", "자기", "분리", "정의", "¬정의(자기, 자기)"],
    },
  },

  synthesisRules: [
    { id: "R5", whenAll: ["분리", "관측자", "대상"], result: "분리(관측자, 대상)" },
    { id: "R6", whenAll: ["관측", "자기"], result: "관측(자기, 자기)" },
    { id: "R7", whenAll: ["정의", "자기"], result: "정의(자기, 자기)" },
  ],

  clause: {
    id: "clause_1",
    questions: [
      {
        id: "Q1-1",
        prompt: "관측_조건\n상태: 누락\n값: [   ]",
        answer: "분리(관측자, 대상)",
        actionText: "관측_조건 / 상태 누락",
        idleText: "값 대기",
      },
      {
        id: "Q1-2",
        prompt: "정의_상태\n상태: 붕괴\n값: [   ]",
        answer: "¬정의(자기, 자기)",
        actionText: "정의_상태 / 상태 붕괴",
        idleText: "값 대기",
      },
    ],

    outputText: [
      "관측_결속: 분리(관측자, 대상)",
      "정의_상태: ¬정의(자기, 자기)",
    ],
  },

  lifecycle: {
    startPanelMessage: "archive mount: block-1",
    startLogs: [
      { text: "archive mount: block-1", tone: "log-success" },
      { text: "memory segment replay active", tone: "log-muted" },
      { text: "observation trace detected", tone: "log-muted" },
    ],
    timedUnlocks: [
      {
        fileOrder: 0,
        delayMs: 260,
        panelMessageTemplate: "observation fragment restored: {file}",
        logTemplate: "observation fragment restored: {file}",
        tone: "log-success",
      },
      {
        fileOrder: 1,
        delayMs: 720,
        panelMessageTemplate: "observation fragment restored: {file}",
        logTemplate: "observation fragment restored: {file}",
        tone: "log-muted",
        followupLog: "analyze restored fragment",
      },
    ],
    onOpenUnlock: {
      panelMessageTemplate: "observation fragment restored: {file}",
      logTemplate: "observation fragment restored: {file}",
      tone: "log-muted",
    },
  },
};
