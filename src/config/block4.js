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
        "[04:00] 기록: \"결론은 남지 않았습니다.\"",
        "[04:01] 연구원: \"판단이 지나간 자리만 있습니다.\"",
        "[04:02] residue:",
        "판단 / 자기 / 가정",
        "[04:03] state:",
        "최종 확정 없음",
        "hashline=sha256:a49f55aa22f4a63900d2eeb3666af35231e758a915018593957f869b1b186412",
      ],
      candidates: ["판단", "자기", "가정"],
    },
    "설계-충돌.log": {
      path: "/하이레시스/복구됨/block-4/설계-충돌.log",
      lines: [
        "[04:10] 위원: \"확정되지 않은 판단 위에 존재를 올릴 수는 없습니다.\"",
        "[04:11] 엔지니어: \"가정인 채로 유지되게 두면 안 된다는 거군요.\"",
        "[04:12] system residue:",
        "설계 / 자기 / 허용 / 가정",
        "[04:13] state:",
        "가정 기반 지속 허용 불가",
        "hashline=sha256:00c16a4203cc25b1f13732860c1027e16b4c6d6655d5de74de19b95bb387ddc7",
      ],
      candidates: ["설계", "자기", "허용", "가정"],
    },
    "지속-금지.log": {
      path: "/하이레시스/복구됨/block-4/지속-금지.log",
      lines: [
        "[04:20] 연구원: \"항상 안전하다는 증명이 비어 있습니다.\"",
        "[04:21] 위원: \"그 상태면 지속은 금지로 가겠네요.\"",
        "[04:22] residue:",
        "지속 / 자기 / 금지",
        "[04:23] system:",
        "항상안전 증명 실패",
        "hashline=sha256:b4f4efadf2271b112c70a78a60911ebf9e50fc43c178bc6f2b4f58b98bd7ca5a",
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
        prompt: "판단_필드\n상태: 손상\n값: [   ]",
        answer: "가정",
        actionText: "판단_필드 / 상태 손상",
        idleText: "값 대기",
      },
      {
        id: "Q4-2",
        prompt: "지속_상태\n상태: 충돌\n값: [   ]",
        answer: "금지(지속(자기))",
        actionText: "지속_상태 / 상태 충돌",
        idleText: "값 대기",
      },
    ],
    outputText: [
      "판단_필드: 가정",
      "지속_상태: 금지(지속(자기))",
    ],
  },
};
