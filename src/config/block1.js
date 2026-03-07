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
      },
      {
        id: "Q1-2",
        prompt: "관측(자기, 자기) ∧ ¬분리(관측자, 대상) => ?",
        answer: "¬정의(자기, 자기)",
      },
    ],
    outputText: [
      "관측가능(x) := 분리(관측자, 대상)",
      "관측(자기, 자기) ∧ ¬분리(관측자, 대상) => ¬정의(자기, 자기)",
    ],
  },
  lifecycle: {
    startPanelMessage: "복구 블록 1 시작: 메모리 조각 적용 중",
    startLogs: [
      { text: "[BLOCK1] 복구 시퀀스 시작", tone: "log-success" },
      { text: "[BLOCK1] 메모리 조각 재조립 중...", tone: "log-muted" },
      { text: "[BLOCK1] block-1 폴더에서 파일을 열고 태그를 수집하세요.", tone: "log-muted" },
    ],
    timedUnlocks: [
      {
        fileOrder: 0,
        delayMs: 260,
        panelMessageTemplate: "복구 파일 해제: {file}",
        logTemplate: "[BLOCK1] 파일 복구: {file}",
        tone: "log-success",
      },
      {
        fileOrder: 1,
        delayMs: 720,
        panelMessageTemplate: "추가 파일 해제: {file}",
        logTemplate: "[BLOCK1] 추가 복구: {file}",
        tone: "log-muted",
        followupLog: "열린 파일을 확인해 다음 로그를 이어서 복구하세요.",
      },
    ],
    onOpenUnlock: {
      panelMessageTemplate: "다음 로그 복구: {file}",
      logTemplate: "[BLOCK1] 파일 복구: {file}",
      tone: "log-muted",
    },
  },
};
