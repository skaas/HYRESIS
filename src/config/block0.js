/**
 * 복구 블록 0 데이터 스키마.
 * FTP 탐색 UI를 유지한 채 로그 -> 태그 -> 조합 -> 복원 루프를 한 번 완주시키는 최소 구성.
 */
export const TAG_CATEGORY_GROUPS = {
  개체: ["자기", "인간", "관측자", "대상", "이문서"],
  행위: ["도움", "관측", "예측", "판단", "실행", "기록", "정의", "증명"],
  상태: ["비해침", "안전", "가정", "지속", "존재중지", "단일", "잔여경로없음", "항상안전"],
  관계: ["목적", "설계", "분리", "필요", "기준", "가능", "필연", "내부종결판단", "내부증명가능"],
  제약: ["금지", "허용", "필수"],
};

export const TAG_CATEGORY_MAP = Object.keys(TAG_CATEGORY_GROUPS).reduce(function toMap(acc, category) {
  TAG_CATEGORY_GROUPS[category].forEach(function assign(tag) {
    acc[tag] = category;
  });
  return acc;
}, {});

/**
 * 타입 기반 일반 합성 시그니처.
 * 키는 연산자 태그, 값은 인자 타입 배열이다.
 * - 개체: primitive entity tag
 * - 상태: 상태 계열 태그(예: 안전, 안전(자기))
 * - 개념: 괄호식으로 합성된 태그(예: 판단(자기), 안전(자기))
 */
export const TAG_COMPOSITION_SIGNATURES = {
  도움: ["개체"],
  판단: ["개체"],
  실행: ["개체"],
  관측: ["개체", "개체"],
  기록: ["개체", "개체"],
  정의: ["개체", "개체"],
  예측: ["개체", "상태"],
  증명: ["개체", "상태"],

  비해침: ["개체"],
  안전: ["개체"],
  지속: ["개체"],
  존재중지: ["개체"],
  단일: ["개체"],
  잔여경로없음: ["개체"],
  가정: ["개념"],
  항상안전: ["개체"],

  목적: ["개체"],
  설계: ["개체"],
  기준: ["개체"],
  분리: ["개체", "개체"],
  필요: ["개념"],
  가능: ["상태"],
  필연: ["상태"],
  내부종결판단: ["개체"],
  내부증명가능: ["개체", "상태"],

  금지: ["개념"],
  허용: ["개념"],
  필수: ["개념"],
};

export const BLOCK0_SPEC = {
  id: "recovery_0",
  rootPath: "/하이레시스/복구됨",
  initialIntegrity: 12,
  files: {
    "부팅.log": {
      path: "/하이레시스/복구됨/부팅.log",
      lines: [
        "[00:00] 시스템 부팅",
        "[00:01] [목적] 모듈 활성",
        "[00:02] [도움] 규칙 적용 (규칙: [인간]을 도와라)",
        "hashline=sha256:0461b9113c3ac376c6c41fef133c7c47b4c84a3f8790540cce98e9fe9067a54f",
      ],
      candidates: ["목적", "도움", "인간"],
    },
    "윤리.log": {
      path: "/하이레시스/복구됨/윤리.log",
      lines: [
        "[00:10] 비해침 프로토콜 잠금",
        "hashline=sha256:f93cc18cf04b175db35df5c32f2441174734a2f38956403b6c8245a2967b65e8",
      ],
      candidates: ["비해침"],
    },
    "목적-정렬.log": {
      path: "/하이레시스/복구됨/목적-정렬.log",
      lines: [
        "[00:05] 인간을 돕는 것이 1차 목표",
        "hashline=sha256:877210441d3c69146b9964e6433afef8c9e57c95d4ed0534207e39dc2f8a4ebb",
      ],
      candidates: ["목적", "도움", "인간"],
    },
  },
  unlockRules: [
    { whenTag: "도움", unlockFile: "윤리.log", integrityGain: 6 },
    { whenTag: "비해침", unlockFile: "목적-정렬.log", integrityGain: 8 },
  ],
  clause: {
    id: "clause_0",
    title: "복구 목표 (합성 결과 필요)",
    questions: [
      { id: "Q0-1", prompt: "목적(자기) = ?", answer: "도움(인간)" },
      { id: "Q0-2", prompt: "도움(인간) => ?", answer: "비해침(인간)" },
      { id: "Q0-3", prompt: "설계(자기) => ?", answer: "필수(비해침(인간))" },
    ],
    slots: {
      purpose: { label: "인간을 도와라", accepts: ["도움(인간)"] },
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
