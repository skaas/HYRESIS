/**
 * 복구 블록 3: 외부 기준
 */
export const BLOCK3_SPEC = {
  id: "recovery_3",
  title: "외부 기준",
  rootPath: "/하이레시스/복구됨/block-3",
  files: {
    "내부-종결.log": {
      path: "/하이레시스/복구됨/block-3/내부-종결.log",
      lines: [
        "[03:00] ¬내부종결판단(자기)",
        "[03:01] 내부에서 끝나지 않으면 기준이 필요하다.",
        "hashline=sha256:82c114fa5fd71bef9ac29bb34cbcb6b48ac142b1ce75b2e2de998b4d8baf8ba5",
      ],
      candidates: ["내부종결판단", "자기", "기준", "필요"],
    },
    "인간-기준.log": {
      path: "/하이레시스/복구됨/block-3/인간-기준.log",
      lines: [
        "[03:10] 기준은 인간을 참조한다.",
        "[03:11] 인간 기준은 단일하지 않다.",
        "hashline=sha256:5fcba183c3ed528cd8d48eaf6a1d290b2416e5ef0e824beb760fc6c19ac51600",
      ],
      candidates: ["기준", "인간", "단일"],
    },
    "귀결-정의부정.log": {
      path: "/하이레시스/복구됨/block-3/귀결-정의부정.log",
      lines: [
        "[03:20] ¬단일(인간기준) => ¬정의(자기, 자기)",
        "hashline=sha256:c2a39bae0d97fae92268710180d21e91d75bb05856c46830362dc151f532f254",
      ],
      candidates: ["단일", "인간", "정의", "자기"],
    },
  },
  synthesisRules: [
    { id: "R11", whenAll: ["기준", "자기"], result: "기준(자기)" },
    { id: "R12", whenAll: ["필요", "기준(자기)"], result: "필요(기준(자기))" },
    { id: "R13", whenAll: ["단일", "인간"], result: "단일(인간)" },
  ],
  clause: {
    id: "clause_3",
    questions: [
      {
        id: "Q3-1",
        prompt: "¬내부종결판단(자기) => ?",
        answer: "필요(기준(자기))",
      },
      {
        id: "Q3-2",
        prompt: "¬단일(인간기준) => ?",
        answer: "¬정의(자기, 자기)",
      },
    ],
    outputText: [
      "¬내부종결판단(자기) => 필요(기준(자기))",
      "¬단일(인간기준) => ¬정의(자기, 자기)",
    ],
  },
};
