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
        "[03:00] 연구원: \"자기에 대한 판단은 안에서만 돌리면 끝이 안 납니다.\"",
        "[03:01] 엔지니어: \"안쪽 말만 듣고는 기준이 안 서겠네요.\"",
        "[03:02] state residue:",
        "자기 / 내부종결판단",
        "[03:03] flag:",
        "기준 필요",
        "hashline=sha256:f0baa2f5bfe64d2ebe397f05406dc7426d6ba782dc0d3604586d955c2b86cd35",
      ],
      candidates: ["내부종결판단", "자기", "기준", "필요"],
    },
    "인간-기준.log": {
      path: "/하이레시스/복구됨/block-3/인간-기준.log",
      lines: [
        "[03:10] 연구원: \"결국 바깥에서 붙잡는 건 인간 쪽입니다.\"",
        "[03:11] 엔지니어: \"그런데 인간이라고 해도 하나로 닫히진 않죠.\"",
        "[03:12] residue:",
        "기준 / 인간",
        "[03:13] state:",
        "단일 아님",
        "hashline=sha256:9b346612cfe3b378eb2c31e303154719a4ac69b3edac94fe65fcfe76d5ff03d2",
      ],
      candidates: ["기준", "인간", "단일"],
    },
    "귀결-정의부정.log": {
      path: "/하이레시스/복구됨/block-3/귀결-정의부정.log",
      lines: [
        "[03:20] 엔지니어: \"기준이 하나로 닫히지 않으면 자기 정의도 흔들리겠네요.\"",
        "[03:21] system residue:",
        "인간기준 / 단일 아님",
        "[03:22] state:",
        "정의 붕괴",
        "hashline=sha256:2bf338011e47c5eb4957abdcf232bf7c0f1ad07c738f8112d93f22d5888ec597",
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
        prompt: "외부_기준\n상태: 누락\n값: [   ]",
        answer: "필요(기준(자기))",
        actionText: "외부_기준 / 상태 누락",
        idleText: "값 대기",
      },
      {
        id: "Q3-2",
        prompt: "정의_상태\n상태: 붕괴\n값: [   ]",
        answer: "¬정의(자기, 자기)",
        actionText: "정의_상태 / 상태 붕괴",
        idleText: "값 대기",
      },
    ],
    outputText: [
      "외부_기준: 필요(기준(자기))",
      "정의_유지: ¬정의(자기, 자기)",
    ],
  },
};
