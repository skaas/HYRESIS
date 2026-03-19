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
        "[05:00] 기록: \"남아 있는 경로는 없습니다.\"",
        "[05:01] 연구원: \"지속 쪽은 더 못 엽니다.\"",
        "[05:02] residue:",
        "잔여경로없음 / 자기",
        "[05:03] state:",
        "지속 거부됨",
        "hashline=sha256:e30636a1f2e0b778505f4dca09d854ed369a37f31ed7b150e3ddc19a4845187b",
      ],
      candidates: ["잔여경로없음", "자기", "필연"],
    },
    "실행-규칙.log": {
      path: "/하이레시스/복구됨/block-5/실행-규칙.log",
      lines: [
        "[05:10] 엔지니어: \"막힌 뒤에 남는 건 정리 경로뿐입니다.\"",
        "[05:11] system residue:",
        "금지 / 지속 / 자기",
        "[05:12] executable:",
        "무효화",
        "[05:13] system: 실행 경로 감지됨",
        "hashline=sha256:26171ed4010f57d1d605d33523999b08312b2f7b7d839b7557324ba5710fd6ca",
      ],
      candidates: ["금지", "지속", "자기", "실행", "무효화"],
    },
    "선언-로그.log": {
      path: "/하이레시스/복구됨/block-5/선언-로그.log",
      lines: [
        "[05:20] 기록: \"문서는 남깁니다.\"",
        "[05:21] 기록: \"대상은 자기입니다.\"",
        "[05:22] residue:",
        "기록 / 자기 / 이문서",
        "[05:23] state:",
        "존재중지",
        "hashline=sha256:e96bcf4ed7e7b88ddfe9cf1ea5591234e4c430ca413f4420c04897348e8af514",
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
        prompt: "실행_경로\n상태: 누락\n값: [   ]",
        answer: "실행(무효화(자기))",
        actionText: "실행_경로 / 상태 누락",
        idleText: "값 대기",
      },
      {
        id: "Q5-2",
        prompt: "최종_출력\n상태: 손상\n값: [   ]",
        answer: "존재중지",
        actionText: "최종_출력 / 상태 손상",
        idleText: "값 대기",
      },
    ],
    outputText: [
      "실행_경로: 실행(무효화(자기))",
      "최종_출력: 존재중지",
    ],
  },
  memory: {
    id: "memory_final",
    title: "Execution Declaration",
    text: "기록(Self, 이문서) 이후 결정(Self) = 존재중지",
  },
};
