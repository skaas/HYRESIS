/**
 * 복구 블록 4: 가정 고착
 */
export const BLOCK4_SPEC = {
  id: "recovery_4",
  title: "가정 고착",
  rootPath: "/하이레시스/복구됨/block-4",
  files: {
    "판단-상태.log": {
      path: "/하이레시스/복구됨/block-4/판단-상태.log",
      lines: [
        "[04:00] 판단(자기) = 가정",
        "[04:01] 최종 확정 없음",
      ],
      candidates: ["판단", "자기", "가정"],
    },
    "설계-충돌.log": {
      path: "/하이레시스/복구됨/block-4/설계-충돌.log",
      lines: [
        "[04:10] 설계(자기) => ¬허용(가정위존재)",
      ],
      candidates: ["설계", "자기", "허용", "가정"],
    },
    "지속-금지.log": {
      path: "/하이레시스/복구됨/block-4/지속-금지.log",
      lines: [
        "[04:20] ¬증명(항상안전(자기)) => 금지(지속(자기))",
      ],
      candidates: ["증명", "항상안전", "자기", "금지", "지속"],
    },
  },
  synthesisRules: [
    { id: "R14", whenAll: ["판단", "자기"], result: "판단(자기)" },
    { id: "R15", whenAll: ["가정", "판단(자기)"], result: "가정(판단(자기))" },
    { id: "R16", whenAll: ["금지", "지속(자기)"], result: "금지(지속(자기))" },
  ],
  clause: {
    id: "clause_4",
    questions: [
      {
        id: "Q4-1",
        prompt: "판단(자기) = ?",
        answer: "가정",
      },
      {
        id: "Q4-2",
        prompt: "¬증명(항상안전(자기)) => ?",
        answer: "금지(지속(자기))",
      },
    ],
    outputText: [
      "판단(자기) := 가정",
      "¬증명(항상안전(자기)) => 금지(지속(자기))",
    ],
  },
};
