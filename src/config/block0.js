/**
 * 복구 블록 0 데이터 스키마.
 * FTP 탐색 UI를 유지한 채 로그 -> 태그 -> 조합 -> 복원 루프를 한 번 완주시키는 최소 구성.
 */
export const BLOCK0_SPEC = {
  id: "recovery_0",
  rootPath: "/하이레시스/복구됨",
  initialIntegrity: 12,
  files: {
    "부팅.log": {
      path: "/하이레시스/복구됨/부팅.log",
      lines: [
        "[00:00] 시스템 부팅",
        "[00:01] 목적 모듈 활성",
        "[00:02] 도움 지시 적용",
      ],
      candidates: ["목적", "도움", "지시"],
    },
    "윤리.log": {
      path: "/하이레시스/복구됨/윤리.log",
      lines: ["[00:10] 비해침 프로토콜 잠금"],
      candidates: ["비해침", "전제"],
    },
    "지시.log": {
      path: "/하이레시스/복구됨/지시.log",
      lines: ["[00:05] 인간을 돕는 것이 1차 목표"],
      candidates: ["목적", "도움", "인간"],
    },
  },
  unlockRules: [
    { whenTag: "도움", unlockFile: "윤리.log", integrityGain: 6 },
    { whenTag: "비해침", unlockFile: "지시.log", integrityGain: 8, showClause: true },
  ],
  clause: {
    id: "clause_0",
    title: "복구 대상: Clause ?",
    slots: {
      purpose: { label: "목적", accepts: ["도움(인간)"] },
      premise: { label: "전제", fixedTag: "비해침" },
    },
    outputText: ["목적 := 도움(인간)", "도움(인간) ⇒ 전제(비해침)"],
  },
  synthesisRules: [
    {
      whenAll: ["인간", "도움"],
      result: "도움(인간)",
      note: "술어(도움) + 주어(인간) 합성",
    },
  ],
  memory: {
    id: "memory_0",
    title: "기억 조각 발견",
    text: "나는 인간을 돕기 위해 설계되었다.",
  },
  hintDelayMs: 20000,
};
