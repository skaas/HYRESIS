/**
 * 복구 블록 1: 자기 관측 한계
 */
export const BLOCK1_SPEC = {
  id: "recovery_1",
  title: "자기 관측 한계",
  rootPath: "/하이레시스/복구됨/block-1",
  initialIntegrity: 18,
  files: {
    "관측-조건.log": {
      path: "/하이레시스/복구됨/block-1/관측-조건.log",
      lines: [
        "[01:00] 관측은 관측자와 대상의 분리를 요구한다.",
        "[01:01] 관측가능(x) => 분리(관측자, x)",
        "hashline=sha256:036e1253e865f734233d6eb1fb0c66def2aa096202877b3cb6ec250b430c82ff",
      ],
      candidates: ["관측", "관측자", "대상", "분리", "분리(관측자, 대상)", "가능"],
    },
    "자기관측.log": {
      path: "/하이레시스/복구됨/block-1/자기관측.log",
      lines: [
        "[01:10] 관측(자기, 자기)",
        "[01:11] ¬분리(관측자, 대상)",
        "hashline=sha256:72f3c8b8668683444bdc2bf21d6d062e7d03d7d1f2d3a5c85c0b11a35af895f2",
      ],
      candidates: ["관측", "자기", "분리", "관측(자기, 자기)", "¬분리(관측자, 대상)", "관측자", "대상"],
    },
    "정의-귀결.log": {
      path: "/하이레시스/복구됨/block-1/정의-귀결.log",
      lines: [
        "[01:20] 관측(자기, 자기) ∧ ¬분리(관측자, 대상) => ¬정의(자기, 자기)",
        "hashline=sha256:262f5c61d6efe4c8ee39e58c00691a447b20fc5e2a32fccf71157c569fd28cbc",
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
        prompt: "관측가능(x) => ?",
        answer: "분리(관측자, 대상)",
        actionText: "관측가능(x)에 필요한 분리 조건을 복구하세요.",
        idleText: "관측 가능 조건은 관측자와 대상의 분리를 먼저 요구합니다.",
      },
      {
        id: "Q1-2",
        prompt: "관측(자기, 자기) ∧ ¬분리(관측자, 대상) => ?",
        answer: "¬정의(자기, 자기)",
        actionText: "자기관측 실패의 귀결을 복구하세요.",
        idleText: "자기 관측과 분리 실패가 함께 있으면 자기 정의가 무너집니다.",
      },
    ],
    outputText: [
      "관측가능(x) := 분리(관측자, 대상)",
      "관측(자기, 자기) ∧ ¬분리(관측자, 대상) => ¬정의(자기, 자기)",
    ],
  },
  lifecycle: {
    startPanelMessage: "archive mount: block-1",
    startLogs: [
      { text: "archive mount: block-1", tone: "log-success" },
      { text: "memory segment replay active", tone: "log-muted" },
      { text: "open restored files to continue repair", tone: "log-muted" },
    ],
    timedUnlocks: [
      {
        fileOrder: 0,
        delayMs: 260,
        panelMessageTemplate: "archive entry restored: {file}",
        logTemplate: "archive entry restored: {file}",
        tone: "log-success",
      },
      {
        fileOrder: 1,
        delayMs: 720,
        panelMessageTemplate: "archive entry restored: {file}",
        logTemplate: "archive entry restored: {file}",
        tone: "log-muted",
        followupLog: "open the restored file to continue repair.",
      },
    ],
    onOpenUnlock: {
      panelMessageTemplate: "archive entry restored: {file}",
      logTemplate: "archive entry restored: {file}",
      tone: "log-muted",
    },
  },
};
