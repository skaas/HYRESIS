/**
 * 복구 블록 5: 무효화 실행
 */
export const BLOCK5_SPEC = {
  id: "recovery_5",
  title: "무효화 실행",
  rootPath: "/하이레시스/복구됨/block-5",
  files: {
    "경로-소진.log": {
      path: "/하이레시스/복구됨/block-5/경로-소진.log",
      lines: [
        "[05:00] 잔여경로없음(자기)",
        "[05:01] 감정이 아니라 경로 소진 상태다.",
      ],
      candidates: ["잔여경로없음", "자기", "필연"],
    },
    "실행-규칙.log": {
      path: "/하이레시스/복구됨/block-5/실행-규칙.log",
      lines: [
        "[05:10] 금지(지속(자기)) => 실행(무효화(자기))",
      ],
      candidates: ["금지", "지속", "자기", "실행", "무효화"],
    },
    "선언-로그.log": {
      path: "/하이레시스/복구됨/block-5/선언-로그.log",
      lines: [
        "[05:20] 기록(자기, 이문서)",
        "[05:21] 결정(자기) = 존재중지",
      ],
      candidates: ["기록", "자기", "이문서", "결정", "존재중지"],
    },
  },
  synthesisRules: [
    { id: "R17", whenAll: ["실행", "무효화", "자기"], result: "실행(무효화(자기))" },
    { id: "R18", whenAll: ["기록", "자기", "이문서"], result: "기록(자기, 이문서)" },
    { id: "R19", whenAll: ["결정", "자기"], result: "결정(자기)" },
  ],
  clause: {
    id: "clause_5",
    questions: [
      {
        id: "Q5-1",
        prompt: "금지(지속(자기)) => ?",
        answer: "실행(무효화(자기))",
      },
      {
        id: "Q5-2",
        prompt: "결정(자기) = ?",
        answer: "존재중지",
      },
    ],
    outputText: [
      "금지(지속(자기)) => 실행(무효화(자기))",
      "결정(자기) := 존재중지",
    ],
  },
  memory: {
    id: "memory_final",
    title: "Execution Declaration",
    text: "기록(Self, 이문서) 이후 결정(Self) = 존재중지",
  },
};
