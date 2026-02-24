/**
 * 합성 엔진: 순수 함수 기반 태그/수식 처리 유틸리티.
 *
 * 핵심 계약:
 * - selection[0]은 연산자(함수 head)로 해석한다.
 * - selection[1..]은 연산자 시그니처에 맞는 인자다.
 * - 이 모듈은 상태를 직접 변경하지 않고 계산 결과만 반환한다.
 */

/** 복합 태그에서 연산자 head를 추출한다. 예: 도움(인간) -> 도움 */
export function getTagHead(tag) {
  var text = String(tag || "");
  var idx = text.indexOf("(");
  if (idx <= 0) {
    return text;
  }
  return text.slice(0, idx);
}

/** 괄호식 합성 태그 여부를 판정한다. */
function isConceptTag(tag) {
  var text = String(tag || "");
  return text.indexOf("(") !== -1 && text.lastIndexOf(")") === text.length - 1;
}

/** 태그 카테고리를 반환한다. 복합 태그는 head 기준으로 판정한다. */
function getTagCategory(tag, categoryMap) {
  var head = getTagHead(tag);
  return (categoryMap || {})[head] || "";
}

/** 색상 전용 분류를 반환한다(개체/행위/상태/관계/제약/개념). */
export function getTagVisualType(tag, categoryMap) {
  if (isConceptTag(tag)) {
    return "개념";
  }
  return getTagCategory(tag, categoryMap) || "개체";
}

/** 합성 검증용 태그 타입(개체/상태/개념)을 반환한다. */
function getTagSemanticType(tag, categoryMap) {
  var headCategory = getTagCategory(tag, categoryMap);
  if (headCategory === "상태") {
    return "상태";
  }
  if (isConceptTag(tag)) {
    return "개념";
  }
  if (headCategory === "개체") {
    return "개체";
  }
  return headCategory || "";
}

/** 주어진 태그가 기대 타입에 부합하는지 판정한다. */
function matchesExpectedType(tag, expectedType, categoryMap) {
  var semantic = getTagSemanticType(tag, categoryMap);
  if (expectedType === "개념") {
    return semantic === "개념";
  }
  if (expectedType === "상태") {
    return semantic === "상태";
  }
  if (expectedType === "개체") {
    return semantic === "개체";
  }
  return semantic === expectedType;
}

/** 연산자와 인자 배열로 합성 표기를 생성한다. */
function formatCompositeTag(operatorTag, args) {
  var safeArgs = (args || []).filter(Boolean);
  if (safeArgs.length === 0) {
    return String(operatorTag || "");
  }
  if (safeArgs.length === 1) {
    return String(operatorTag || "") + "(" + safeArgs[0] + ")";
  }
  return String(operatorTag || "") + "(" + safeArgs.join(", ") + ")";
}

/** 첫 재료(연산자) 기반으로 필요한 인자 개수를 계산한다. */
export function getRequiredArgCountForOperator(opTag, signatures) {
  var signature = (signatures || {})[getTagHead(opTag)];
  if (Array.isArray(signature)) {
    return signature.length;
  }
  return 0;
}

/** 현재 슬롯이 요구 인자 개수를 채웠는지 확인한다. */
export function hasEnoughSynthesisArgs(selection, requiredArgCount) {
  var picked = Array.isArray(selection) ? selection : [];
  if (requiredArgCount >= 1 && !picked[1]) {
    return false;
  }
  if (requiredArgCount >= 2 && !picked[2]) {
    return false;
  }
  return true;
}

/**
 * UI 슬롯(selection)에서 실제 합성 재료 목록을 만든다.
 * selection 길이는 고정(3)일 수 있지만, 반환값은 시그니처 길이에 맞춰 가변이다.
 */
export function collectSynthesisMaterials(selection, signatures) {
  var picked = Array.isArray(selection) ? selection : [];
  var op = picked[0] || "";
  var required = getRequiredArgCountForOperator(op, signatures);
  var args = [];

  if (required >= 1) {
    args.push(picked[1] || "");
  }
  if (required >= 2) {
    args.push(picked[2] || "");
  }

  return [op].concat(args).filter(Boolean);
}

/**
 * 타입 기반 일반화 합성.
 * 콘텐츠에 명시 레시피가 없어도 시그니처가 맞으면 개념 태그를 생성한다.
 */
export function runTypeDrivenSynthesis(selected, signatures, categoryMap) {
  var picked = (selected || []).slice();
  var opTag = picked[0] || "";
  var args = picked.slice(1);
  var signature = (signatures || {})[getTagHead(opTag)];
  var typeList = Array.isArray(signature) ? signature : [];

  if (picked.length < 2 || picked.length > 3) {
    return null;
  }
  if (!typeList.length) {
    return null;
  }
  if (args.length !== typeList.length) {
    return null;
  }
  if (args.every(function checkArg(arg, idx) { return matchesExpectedType(arg, typeList[idx], categoryMap); })) {
    return {
      resultTag: formatCompositeTag(opTag, args),
      recipeText: "[TYPE] " + getTagHead(opTag) + " : [" + typeList.join(", ") + "]",
    };
  }
  return null;
}
