import { GAME_CONFIG, OPENING_SEQUENCE } from "./src/config/config.js";
import { BLOCK0_SPEC, TAG_CATEGORY_MAP, TAG_COMPOSITION_SIGNATURES } from "./src/config/block0.js";
import { BLOCK1_SPEC } from "./src/config/block1.js";
import { FLOW_PHASE, state, elements } from "./src/state/state.js";
import {
  BLOCK0_TRANSITION_ACTION,
  createBlock0TransitionDispatcher,
} from "./src/state/block0-transition.js";
import {
  RUNTIME_TRANSITION_EVENT,
  beginAuthFlow,
  beginInvestigationBoot,
  beginOpeningFlow,
  commitBlock1Answer,
  completeBlock1Progress,
  enqueueLogItem,
  enterAttachingFlow,
  enterStreamingFlow,
  finishInvestigationBoot,
  markBlock0DragHint,
  pushDiscoveredRecipe,
  resetBlock1Progress,
  resetLogQueueState,
  setBlock0Pipeline,
  setInputEnabledState,
  setInvestigationCwdState,
  setLogPinnedState,
  setPuzzlePurposeValue,
  setTypingActiveState,
  startBlock1Progress,
  advanceBlock1Question,
  advanceOpeningFlow,
} from "./src/state/runtime-transitions.js";
import { applyVisibleFilesToFs, assertVisibleFsConsistency } from "./src/state/fs-sync.js";
import {
  getTagVisualType,
  runTypeDrivenSynthesis,
} from "./src/game/synthesis-engine.js";
import { renderPreviewBufferWithTagLinks as renderPreviewBuffer } from "./src/game/preview-buffer.js";
import { createSeededRng, createSimulationEngine } from "./src/sim/engine.js";

/**
 * HYRESIS FTP Gateway Runtime
 *
 * 이 파일은 GUI 중심 FTP 탐색/복구 런타임의 단일 진입점이다.
 * 주요 책임:
 * 1) 부팅 -> 로그인 -> 터미널 attach -> FTP 세션 전환
 * 2) 가상 파일시스템(LOG_FS/LOG_META) 탐색/복구 GUI 처리
 * 3) 터미널 내러티브 로그/프리뷰 버퍼/뷰어 출력 관리
 *
 * 핵심 상태 머신:
 * - BOOTING: 시스템 부팅 오버레이만 동작
 * - LOGIN_REQUIRED: 로그인 콘솔 표시, 배경 터미널은 분리 상태
 * - ATTACHING: 인증 성공 후 채널 attach 연출
 * - STREAMING: 실제 FTP 명령 사용 가능 상태
 */
var ftpLinkTimer = null;
var fileTransferJob = 0;
var previewFilePath = "";
var previewFileLines = [];
var block0FileByPath = {};
var block1FileByPath = {};
var block0DraggedTag = "";
var block0DraggedTagIndex = -1;
var block0ClausePulseTimer = 0;
var block0AnswerRecoveryActive = false;
var block0AnswerRecoveryJob = 0;
var RECOVERY_SHELL_FOCUS_MODE = true;
var recoveryShellDigestQueue = [];
var recoveryShellDigestTimer = 0;
var terminalSummaryLines = [];
var terminalSummaryLastKey = "";
var terminalSummaryRepeatCount = 0;
var terminalLogExpanded = false;
var investigationReadOnlyLock = false;
var block0CurrentContext = {
  file: "",
  tag: "",
};
var DEFAULT_PREVIEW_HINT = "파일을 열어 증거를 확인하세요.";
var EMPTY_RECIPE_HINT = "no compiled bindings yet.";
var SHELL_NARRATIVE_ONLY = true;
var block0Lifecycle = null;
var block1Lifecycle = null;
var blockLifecycleTimers = [];
var block0FusionDraft = {
  operator: "",
  expectedTypes: [],
  args: [],
};
var block0RecoveryMetaByFile = {};
var block1RecoveryMetaByFile = {};
var block0RecoveryRootMeta = null;
var block1RecoveryRootMeta = null;
var block0PendingRecoveryPrompt = null;
var block0ActiveRecoveryFile = "";
var block1ActiveRecoveryFile = "";
var pinnedInvestigationPreview = null;
var block0TransitionDispatcher = null;
var block0DraggedRecoveryFile = "";
var simulationEngine = null;
var simulationSeed = (Date.now() >>> 0) || 1;
var simulationAutoClockTimer = 0;
var simulationAutoClockLastMs = 0;

function buildSimulationSnapshot() {
  return {
    coordinateSystem: "filesystem paths rooted at /하이레시스; list indices are 0-based.",
    timeMs: getSimulationNowMs(),
    phase: state.phase,
    inputEnabled: Boolean(state.inputEnabled),
    openingIndex: Number(state.openingIndex || 0),
    investigation: {
      booting: Boolean(state.investigationBooting),
      cwd: String(state.investigationCwd || ""),
      previewPath: String(previewFilePath || ""),
      previewLineCount: previewFileLines.length,
    },
    block0: {
      started: Boolean(state.block0Started),
      completed: Boolean(state.block0Completed),
      questionIndex: Number(state.block0QuestionIndex || 0),
      purposeValue: String(state.block0PurposeValue || ""),
      clauseVisible: Boolean(state.block0ClauseVisible),
      visibleFiles: Array.isArray(state.block0VisibleFiles) ? state.block0VisibleFiles.slice() : [],
      collectedTags: Array.isArray(state.block0CollectedTags) ? state.block0CollectedTags.slice() : [],
      solvedAnswers: Array.isArray(state.block0SolvedAnswers) ? state.block0SolvedAnswers.slice() : [],
      pipelineStage: String(state.block0PipelineStage || ""),
      pipelineProgress: Number(state.block0PipelineProgress || 0),
      memoryUnlocked: Boolean(state.block0MemoryUnlocked),
      activeRecoveryFile: String(block0ActiveRecoveryFile || ""),
      hasPendingRecoveryPrompt: Boolean(block0PendingRecoveryPrompt),
    },
    block1: {
      started: Boolean(state.block1Started),
      completed: Boolean(state.block1Completed),
      questionIndex: Number(state.block1QuestionIndex || 0),
      purposeValue: String(state.block1PurposeValue || ""),
      clauseVisible: Boolean(state.block1ClauseVisible),
      visibleFiles: Array.isArray(state.block1VisibleFiles) ? state.block1VisibleFiles.slice() : [],
      collectedTags: Array.isArray(state.block1CollectedTags) ? state.block1CollectedTags.slice() : [],
      solvedAnswers: Array.isArray(state.block1SolvedAnswers) ? state.block1SolvedAnswers.slice() : [],
      activeRecoveryFile: String(block1ActiveRecoveryFile || ""),
    },
    transfer: {
      activeJob: Number(fileTransferJob || 0),
      readonlyLock: Boolean(investigationReadOnlyLock),
    },
    log: {
      queueLength: Array.isArray(state.logQueue) ? state.logQueue.length : 0,
      typingActive: Boolean(state.typingActive),
      pinnedToBottom: Boolean(state.logPinnedToBottom),
      summaryCount: terminalSummaryLines.length,
    },
  };
}

function ensureStateEventBuffer() {
  if (typeof window === "undefined") {
    return [];
  }
  if (!Array.isArray(window.__HYRESIS_STATE_EVENTS)) {
    window.__HYRESIS_STATE_EVENTS = [];
  }
  return window.__HYRESIS_STATE_EVENTS;
}

function flushSimulationEventsToObservers() {
  if (!simulationEngine) {
    return;
  }
  var events = simulationEngine.drainEvents();
  var buffer = ensureStateEventBuffer();
  events.forEach(function publishEvent(event) {
    buffer.push(event);
    if (typeof document !== "undefined" && typeof CustomEvent === "function") {
      document.dispatchEvent(
        new CustomEvent("hyresis:state-transition", {
          detail: event,
        }),
      );
    }
  });
}

function ensureSimulationEngine() {
  if (simulationEngine) {
    return simulationEngine;
  }
  simulationEngine = createSimulationEngine({
    initialState: state,
    nowMs: Date.now(),
    rng: createSeededRng(simulationSeed),
    snapshotBuilder: buildSimulationSnapshot,
  });
  return simulationEngine;
}

function startSimulationAutoClock() {
  if (typeof window === "undefined" || simulationAutoClockTimer) {
    return;
  }
  if (window.__HYRESIS_DISABLE_AUTO_CLOCK) {
    return;
  }
  simulationAutoClockLastMs = Date.now();
  simulationAutoClockTimer = window.setInterval(function runSimulationClock() {
    var nowMs = Date.now();
    var elapsed = Math.max(1, nowMs - simulationAutoClockLastMs);
    simulationAutoClockLastMs = nowMs;
    ensureSimulationEngine().advanceTime(elapsed);
    flushSimulationEventsToObservers();
  }, 16);
}

function stopSimulationAutoClock() {
  if (typeof window === "undefined" || !simulationAutoClockTimer) {
    return;
  }
  window.clearInterval(simulationAutoClockTimer);
  simulationAutoClockTimer = 0;
}

function installSimulationTestHooks() {
  if (typeof window === "undefined") {
    return;
  }
  ensureStateEventBuffer();
  window.advanceTime = function advanceTime(ms) {
    stopSimulationAutoClock();
    ensureSimulationEngine().advanceTime(ms);
    flushSimulationEventsToObservers();
    return ensureSimulationEngine().getSnapshot();
  };
  window.render_game_to_text = function renderGameToText() {
    return JSON.stringify(ensureSimulationEngine().getSnapshot());
  };
}

function getSimulationNowMs() {
  if (!simulationEngine) {
    return Date.now();
  }
  return simulationEngine.nowMs();
}

function getSimulationDate(dateValue) {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (Number.isFinite(dateValue)) {
    return new Date(Number(dateValue));
  }
  return new Date(getSimulationNowMs());
}

function getSimulationRandomInt(minInclusive, maxInclusive) {
  var min = Number(minInclusive) || 0;
  var max = Number(maxInclusive) || min;
  var span = Math.max(1, max - min + 1);
  return min + Math.floor(ensureSimulationEngine().random() * span);
}

function scheduleRuntimeTimeout(callback, delayMs, label) {
  return ensureSimulationEngine().scheduleTimeout(callback, Math.max(0, Number(delayMs) || 0), {
    label: label || "",
  });
}

function scheduleRuntimeInterval(callback, intervalMs, label) {
  return ensureSimulationEngine().scheduleInterval(callback, Math.max(1, Number(intervalMs) || 1), {
    label: label || "",
  });
}

function clearRuntimeTimer(timerId) {
  if (timerId === null || timerId === undefined) {
    return;
  }
  ensureSimulationEngine().clearScheduled(timerId);
}

/** Block0 관측 이벤트를 안정 스냅샷으로 방출한다. */
function emitStateEvent(name, snapshot, payload) {
  var eventPayload = {
    name: String(name || ""),
    payload: Object.assign({}, payload || {}),
    snapshot: Object.assign({}, snapshot || buildSimulationSnapshot()),
  };

  if (simulationEngine) {
    simulationEngine.emitEvent(eventPayload.name, eventPayload.payload, eventPayload.snapshot);
    flushSimulationEventsToObservers();
    return;
  }

  ensureStateEventBuffer().push(eventPayload);
  if (typeof document !== "undefined" && typeof CustomEvent === "function") {
    document.dispatchEvent(
      new CustomEvent("hyresis:state-transition", {
        detail: eventPayload,
      }),
    );
  }
}

function getBlock0TransitionDispatcher() {
  if (block0TransitionDispatcher) {
    return block0TransitionDispatcher;
  }
  block0TransitionDispatcher = createBlock0TransitionDispatcher({
    getState: function getState() {
      return state;
    },
    getPendingRecoveryPrompt: function getPendingRecoveryPrompt() {
      return block0PendingRecoveryPrompt;
    },
    setPendingRecoveryPrompt: function setPendingRecoveryPrompt(nextPrompt) {
      block0PendingRecoveryPrompt = nextPrompt;
    },
    getActiveRecoveryFile: function getActiveRecoveryFile() {
      return block0ActiveRecoveryFile;
    },
    setActiveRecoveryFile: function setActiveRecoveryFile(fileName) {
      block0ActiveRecoveryFile = String(fileName || "");
    },
    getQuestionCount: function getQuestionCount() {
      return getBlock0ClauseQuestions().length;
    },
    emitStateEvent: emitStateEvent,
  });
  return block0TransitionDispatcher;
}

function transitionBlock0(action, payload) {
  return getBlock0TransitionDispatcher().transitionBlock0(action, payload || {});
}

function armBlock0Recovery(fileName, requiredTag, questionText) {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.ARM_RECOVERY, {
    fileName: fileName,
    requiredTag: requiredTag,
    questionText: questionText,
  });
}

function clearBlock0RecoveryArm() {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.CLEAR_RECOVERY_ARM);
}

function mountBlock0Clause() {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.MOUNT_CLAUSE);
}

function setBlock0Purpose(value) {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.SET_PURPOSE, {
    purposeValue: value,
  });
}

function clearBlock0Purpose() {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.CLEAR_PURPOSE);
}

function commitBlock0Answer(answer) {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.COMMIT_ANSWER, {
    answer: answer,
  });
}

function advanceBlock0Question(hasNextTargetFile) {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.ADVANCE_QUESTION, {
    hasNextTargetFile: Boolean(hasNextTargetFile),
    finalRecoveryFile: "최종 복구식",
  });
}

function completeBlock0Clause() {
  return transitionBlock0(BLOCK0_TRANSITION_ACTION.COMPLETE_BLOCK0, {
    minIntegrity: 35,
  });
}

/** 템플릿 문자열의 {token}을 값으로 치환한다. */
function formatLifecycleText(template, params) {
  var text = String(template || "");
  var safeParams = params || {};
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, function replaceToken(_, key) {
    return safeParams[key] !== undefined ? String(safeParams[key]) : "";
  });
}

/** 블록 라이프사이클 공통 러너. */
function runBlockLifecycle(blockSpec, hooks) {
  var safeHooks = hooks || {};
  return {
    spec: blockSpec,
    reset: function reset(payload) {
      if (typeof safeHooks.reset === "function") {
        safeHooks.reset(blockSpec, payload || {});
      }
    },
    start: function start(payload) {
      if (typeof safeHooks.start === "function") {
        safeHooks.start(blockSpec, payload || {});
      }
    },
    onFileOpened: function onFileOpened(path, payload) {
      if (typeof safeHooks.onFileOpened === "function") {
        safeHooks.onFileOpened(blockSpec, path, payload || {});
      }
    },
    onTagCollected: function onTagCollected(tag, payload) {
      if (typeof safeHooks.onTagCollected === "function") {
        safeHooks.onTagCollected(blockSpec, tag, payload || {});
      }
    },
    onComplete: function onComplete(payload) {
      if (typeof safeHooks.onComplete === "function") {
        safeHooks.onComplete(blockSpec, payload || {});
      }
    },
  };
}

/** 목록을 "최신 복구가 위" 규칙으로 갱신한다(중복 방지). */
function prependRecoveredFile(list, fileName) {
  if (!Array.isArray(list) || !fileName) {
    return false;
  }
  var existingIndex = list.indexOf(fileName);
  if (existingIndex >= 0) {
    list.splice(existingIndex, 1);
  }
  list.unshift(fileName);
  return true;
}

/** 파일 패널 표시에 쓰는 YY-MM-DD / HH:MM 스탬프를 만든다. */
function buildCurrentFsStamp(dateValue) {
  var date = getSimulationDate(dateValue);
  return {
    date: padTwoDigits(date.getFullYear() % 100) + "-" + padTwoDigits(date.getMonth() + 1) + "-" + padTwoDigits(date.getDate()),
    time: padTwoDigits(date.getHours()) + ":" + padTwoDigits(date.getMinutes()),
  };
}

function stampBlock0RecoveredFile(fileName, dateValue) {
  var stamp = null;
  if (!fileName) {
    return;
  }
  stamp = buildCurrentFsStamp(dateValue);
  block0RecoveryMetaByFile[fileName] = stamp;
  block0RecoveryRootMeta = stamp;
}

function stampBlock1RecoveredFile(fileName, dateValue) {
  var stamp = null;
  if (!fileName) {
    return;
  }
  stamp = buildCurrentFsStamp(dateValue);
  block1RecoveryMetaByFile[fileName] = stamp;
  block1RecoveryRootMeta = stamp;
}

/** 예약된 블록 타이머를 정리한다. */
function clearBlockLifecycleTimers() {
  while (blockLifecycleTimers.length > 0) {
    clearRuntimeTimer(blockLifecycleTimers.pop());
  }
}

function queueRecoveryShellDigest(text) {
  var safeText = String(text || "").trim();
  if (!safeText) {
    return;
  }
  if (recoveryShellDigestQueue.indexOf(safeText) === -1) {
    recoveryShellDigestQueue.push(safeText);
  }
  if (recoveryShellDigestTimer) {
    return;
  }
  recoveryShellDigestTimer = scheduleRuntimeTimeout(flushRecoveryShellDigest, 1500, "recovery-shell-digest");
}

function flushRecoveryShellDigest() {
  var summary = "";
  var hiddenCount = 0;
  if (recoveryShellDigestTimer) {
    clearRuntimeTimer(recoveryShellDigestTimer);
    recoveryShellDigestTimer = 0;
  }
  if (recoveryShellDigestQueue.length === 0) {
    return;
  }
  summary = recoveryShellDigestQueue[0];
  hiddenCount = Math.max(0, recoveryShellDigestQueue.length - 1);
  recoveryShellDigestQueue = [];
  if (hiddenCount > 0) {
    summary += " +" + hiddenCount;
  }
  appendLogLine("복구 요약: " + summary, "log-muted");
}

function logRecoveryEvent(text, tone) {
  var safeText = String(text || "").trim();
  if (!safeText) {
    return null;
  }
  if (RECOVERY_SHELL_FOCUS_MODE) {
    queueRecoveryShellDigest(safeText);
    return null;
  }
  return appendLogLine(safeText, tone || "log-muted");
}

function scheduleBlockLifecycleTimer(callback, delayMs) {
  var timer = scheduleRuntimeTimeout(callback, Math.max(0, Number(delayMs) || 0), "block-lifecycle");
  blockLifecycleTimers.push(timer);
  return timer;
}

function getTagHead(tag) {
  return String(tag || "").split("(")[0];
}

function isBlock1DirectoryActive() {
  return state.block1Started && normalizePath(state.investigationCwd || "").indexOf(BLOCK1_SPEC.rootPath) === 0;
}

function getPuzzlePrefixForPath(path) {
  var normalized = normalizePath(path || "");
  if (normalized.indexOf(BLOCK1_SPEC.rootPath) === 0) {
    return "block1";
  }
  return "block0";
}

function getActivePuzzlePrefix() {
  return isBlock1DirectoryActive() ? "block1" : "block0";
}

function getPuzzleSpec(prefix) {
  return prefix === "block1" ? BLOCK1_SPEC : BLOCK0_SPEC;
}

function getPuzzleFileIndex(prefix) {
  return prefix === "block1" ? block1FileByPath : block0FileByPath;
}

function getPuzzleQuestions(prefix) {
  var clause = getPuzzleSpec(prefix).clause || {};
  return Array.isArray(clause.questions) ? clause.questions : [];
}

function getPuzzleCurrentQuestion(prefix) {
  var questions = getPuzzleQuestions(prefix);
  if (questions.length === 0) {
    return null;
  }
  return questions[state[prefix + "QuestionIndex"]] || null;
}

function getPuzzlePreviousQuestion(prefix) {
  var questions = getPuzzleQuestions(prefix);
  var index = Number(state[prefix + "QuestionIndex"] || 0) - 1;
  if (index < 0 || index >= questions.length) {
    return null;
  }
  return questions[index] || null;
}

function getPuzzleCurrentRecoveryFile(prefix) {
  return prefix === "block1" ? block1ActiveRecoveryFile : block0ActiveRecoveryFile;
}

function getBlock0ClauseQuestions() {
  var clause = BLOCK0_SPEC.clause || {};
  return Array.isArray(clause.questions) ? clause.questions : [];
}

function getBlock0CurrentQuestion() {
  var questions = getBlock0ClauseQuestions();
  if (questions.length === 0) {
    return null;
  }
  return questions[state.block0QuestionIndex] || null;
}

function getBlock0PatchTargetPresentation(question) {
  var prompt = question && question.prompt ? String(question.prompt) : "";
  var parts = [];
  var badgeText = "식 -";
  var expressionText = prompt || "누락 식";
  var badgeMatch = null;

  if (!prompt) {
    return { badgeText: badgeText, expressionText: "누락 식" };
  }

  parts = prompt.split(":");
  if (parts.length > 1) {
    badgeText = parts[0].trim().replace("누락 ", "");
    expressionText = parts.slice(1).join(":").trim();
  }

  if (badgeText === "식 -") {
    badgeMatch = prompt.match(/(식\s*[A-Za-z0-9가-힣]+)/);
    if (badgeMatch) {
      badgeText = badgeMatch[1];
    }
  }

  return {
    badgeText: badgeText || "식 -",
    expressionText: expressionText || prompt,
  };
}

function setBlock0ContextFile(path) {
  var name = String(path || "").split("/").pop() || "";
  block0CurrentContext.file = name;
}

function setBlock0ContextTag(tag) {
  block0CurrentContext.tag = String(tag || "").trim();
}

function syncInvestigationReadOnlyState() {
  var shouldLock = block0AnswerRecoveryActive || Boolean(block0DraggedTag);
  investigationReadOnlyLock = shouldLock;
  if (elements.investigationPanel) {
    elements.investigationPanel.classList.toggle("is-readonly", shouldLock);
  }
}

function getNextRecoverableBlock0FileName() {
  var fileNames = Object.keys(BLOCK0_SPEC.files);
  var index = 0;
  while (index < fileNames.length) {
    if (state.block0VisibleFiles.indexOf(fileNames[index]) === -1) {
      return fileNames[index];
    }
    index += 1;
  }
  return "";
}

function getBlock0UnlockSequenceFiles() {
  var seen = {};
  var ordered = [];
  var rules = Array.isArray(BLOCK0_SPEC.unlockRules) ? BLOCK0_SPEC.unlockRules : [];
  var index = 0;
  while (index < rules.length) {
    var unlockFile = String((rules[index] && rules[index].unlockFile) || "");
    if (unlockFile && !seen[unlockFile]) {
      seen[unlockFile] = true;
      ordered.push(unlockFile);
    }
    index += 1;
  }
  return ordered;
}

function getBlock0UnlockRuleByFile(fileName) {
  var rules = Array.isArray(BLOCK0_SPEC.unlockRules) ? BLOCK0_SPEC.unlockRules : [];
  var index = 0;
  while (index < rules.length) {
    if (String((rules[index] && rules[index].unlockFile) || "") === String(fileName || "")) {
      return rules[index];
    }
    index += 1;
  }
  return null;
}

function isBlock0UnlockRuleSatisfied(fileName) {
  var rule = getBlock0UnlockRuleByFile(fileName);
  var requiredTag = "";
  if (!rule) {
    return true;
  }
  requiredTag = String(rule.whenTag || "");
  if (!requiredTag) {
    return true;
  }
  return state.block0CollectedTags.indexOf(requiredTag) !== -1;
}

function getBlock0CurrentTargetFileName() {
  var sequence = getBlock0UnlockSequenceFiles();
  var idx = Number(state.block0QuestionIndex || 0);
  if (idx < 0 || idx >= sequence.length) {
    return "";
  }
  return sequence[idx] || "";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBlock0HintPanelHtml() {
  if (getActivePuzzlePrefix() === "block1") {
    if (state.block1DiscoveredRecipes.length === 0 && state.block1SolvedAnswers.length === 0) {
      return '<div class="hint-empty">아직 기록된 복구가 없습니다.</div>';
    }
    return (
      '<div class="hint-section">' +
      '<div class="hint-section-title">복구 기록</div>' +
      state.block1DiscoveredRecipes.map(function renderRecipe(recipeText) {
        return (
          '<div class="hint-row">' +
          '<span class="hint-chip">조합</span>' +
          '<span class="hint-main">' + escapeHtml(recipeText) + "</span>" +
          "</div>"
        );
      }).join("") +
      state.block1SolvedAnswers.map(function renderSolved(answerText) {
        return (
          '<div class="hint-row">' +
          '<span class="hint-chip">복구</span>' +
          '<span class="hint-main">' + escapeHtml(answerText) + "</span>" +
          "</div>"
        );
      }).join("") +
      "</div>"
    );
  }

  var hints = BLOCK0_SPEC.hints || {};
  var synthesisHints = hints.synthesis || {};
  var interpretations = Array.isArray(hints.interpretations) ? hints.interpretations : [];
  var recipeLines = [];
  var interpretationLines = [];
  var recipeIndex = 0;
  var solvedIndex = 0;

  while (recipeIndex < state.block0DiscoveredRecipes.length) {
    var recipeText = String(state.block0DiscoveredRecipes[recipeIndex] || "");
    var resultTag = recipeText.indexOf("->") !== -1 ? recipeText.split("->").pop().trim() : "";
    var hintSpec = resultTag ? synthesisHints[resultTag] || null : null;
    recipeLines.push(
      '<div class="hint-row">' +
      '<span class="hint-chip">' + escapeHtml((hintSpec && hintSpec.colorHint) || "조합") + "</span>" +
      '<span class="hint-main">' + escapeHtml(recipeText) + "</span>" +
      '<span class="hint-note">' + escapeHtml((hintSpec && hintSpec.note) || "필요한 조각을 맞춰 결과 조각을 만듭니다.") + "</span>" +
      "</div>"
    );
    recipeIndex += 1;
  }

  while (solvedIndex < state.block0SolvedAnswers.length && solvedIndex < interpretations.length) {
    interpretationLines.push(
      '<div class="hint-row">' +
      '<span class="hint-chip">해석</span>' +
      '<span class="hint-main">' + escapeHtml(interpretations[solvedIndex]) + "</span>" +
      "</div>"
    );
    solvedIndex += 1;
  }

  if (state.block0MemoryUnlocked && hints.block1FolderHint) {
    interpretationLines.push(
      '<div class="hint-row">' +
      '<span class="hint-chip">다음 단계</span>' +
      '<span class="hint-main">' + escapeHtml(hints.block1FolderHint) + "</span>" +
      "</div>"
    );
  }

  if (recipeLines.length === 0 && interpretationLines.length === 0) {
    return '<div class="hint-empty">아직 기록된 복구가 없습니다.</div>';
  }

  return (
    '<div class="hint-section">' +
    '<div class="hint-section-title">조합 기록</div>' +
    (recipeLines.length ? recipeLines.join("") : '<div class="hint-empty">조합 기록이 생기면 여기에 남습니다.</div>') +
    "</div>" +
    '<div class="hint-section">' +
    '<div class="hint-section-title">해석 기록</div>' +
    (interpretationLines.length ? interpretationLines.join("") : '<div class="hint-empty">복구가 진행되면 현재까지의 의미가 정리됩니다.</div>') +
    "</div>"
  );
}

function clearPuzzleIdleHint() {
  return false;
}

function touchPuzzleActivity(prefix) {
  void prefix;
}

function getQuestionUiText(question, key) {
  if (!question || typeof question[key] !== "string") {
    return "";
  }
  return String(question[key] || "").trim();
}

function setBlock0PipelineStage(stage, progress) {
  setBlock0Pipeline(state, stage, progress);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.PIPELINE_UPDATED, null, {
    stage: String(stage || ""),
    progress: Math.max(0, Math.min(1, Number(progress) || 0)),
  });
}

function hasOpenPuzzlePreview(prefix) {
  var fileIndex = getPuzzleFileIndex(prefix);
  return Boolean(previewFilePath) && Boolean(fileIndex[previewFilePath]) && previewFileLines.length > 0;
}

function buildWorkbenchActionViewModel(prefix) {
  var spec = getPuzzleSpec(prefix);
  var currentQuestion = getPuzzleCurrentQuestion(prefix);
  var currentAnswer = currentQuestion ? String(currentQuestion.answer || "") : "";
  var currentPurpose = state[prefix + "PurposeValue"] || "";
  var collectedTags = state[prefix + "CollectedTags"];
  var activeRecoveryFile = getPuzzleCurrentRecoveryFile(prefix);
  var hasOpenPreview = hasOpenPuzzlePreview(prefix);
  var questionTitle = activeRecoveryFile ? ("목표: " + currentQuestion.prompt) : ("대상 준비: " + (spec.title || "복구 단계"));
  var block0TargetFile = getBlock0CurrentTargetFileName();
  var block0Rule = getBlock0UnlockRuleByFile(block0TargetFile);
  var block0Requirement = block0Rule ? String(block0Rule.whenTag || "") : "";
  var block0TargetReady = prefix === "block0" ? isBlock0UnlockRuleSatisfied(block0TargetFile) : false;
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return {
      toneClass: "",
      stateLabel: "분리",
      title: "세션 분리됨",
      body: "로그인 후 세션이 연결됩니다.",
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (block0AnswerRecoveryActive) {
    return {
      toneClass: "is-processing",
      stateLabel: "검증",
      title: "패치 검증 중",
      body: "무결성 검사와 반영을 진행 중입니다.",
      progressLabel: state.block0PipelineStage || "검사 준비 중",
      progressValue: state.block0PipelineProgress || 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (prefix === "block0" && state.block0MemoryUnlocked && !state.block1Started) {
    return {
      toneClass: "is-resolved",
      stateLabel: "다음",
      title: "다음 복구 준비 완료",
      body: "block-1 폴더가 열렸습니다.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (prefix === "block1" && state.block1Started && !state.block1Completed && state.block1VisibleFiles.length === 0) {
    return {
      toneClass: "is-processing",
      stateLabel: "SYNC",
      title: "인덱스 동기화 중",
      body: "복구 파일을 불러오는 중입니다.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (state[prefix + "Completed"]) {
    return {
      toneClass: "is-resolved",
      stateLabel: "RESOLVED",
      title: "복구 완료",
      body: "다음 증거 흐름을 확인하세요.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (!state[prefix + "ClauseVisible"]) {
    if (prefix === "block0" && block0TargetReady) {
      return {
        toneClass: "",
        stateLabel: "마운트",
        title: "복구 가능 파일을 작업대로 가져오세요.",
        body: "",
        progressLabel: "",
        progressValue: 0,
        isHidden: false,
        ctaLabel: "",
        ctaAction: "",
      };
    }
    if (prefix === "block0" && hasOpenPreview) {
      return {
        toneClass: "",
        stateLabel: "탐색",
        title: "증거를 확인해 복구 파일을 준비하세요.",
        body: block0Requirement ? ("잠금 조건 조각: " + block0Requirement) : "",
        progressLabel: "",
        progressValue: 0,
        isHidden: false,
        ctaLabel: "",
        ctaAction: "",
      };
    }
    return {
      toneClass: "",
      stateLabel: "대기",
      title: "증거를 확인해 복구 파일을 준비하세요.",
      body: "",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (!currentQuestion) {
    return {
      toneClass: "",
      stateLabel: "확인",
      title: "현재 식 확인",
      body: "증거와 조각을 다시 확인하세요.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (currentPurpose && currentAnswer && currentPurpose !== currentAnswer) {
    return {
      toneClass: "is-warning",
      stateLabel: "오류",
      title: "다른 조각이 필요합니다",
      body: currentPurpose + "는 현재 식과 맞지 않습니다.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (prefix === "block1" && !hasOpenPreview && state.block1VisibleFiles.length > 0 && collectedTags.length === 0) {
    return {
      toneClass: "",
      stateLabel: "탐색",
      title: "열린 로그 확인",
      body: "새로 열린 로그에서 조각을 수집하세요.",
      progressLabel: "",
      progressValue: 0,
      isHidden: false,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  if (!currentPurpose && currentAnswer && collectedTags.indexOf(currentAnswer) !== -1) {
    return {
      toneClass: "is-ready",
      stateLabel: "준비",
      title: "목표 조각 확보",
      body: "목표 조각을 슬롯에 넣으세요.",
      progressLabel: "",
      progressValue: 0,
      isHidden: true,
      ctaLabel: "",
      ctaAction: "",
    };
  }

  return {
    toneClass: "",
    stateLabel: "연결",
    title: questionTitle,
    body: "",
    progressLabel: "",
    progressValue: 0,
    isHidden: true,
    ctaLabel: "",
    ctaAction: "",
  };
}

function resetBlock0FusionDraft() {
  block0FusionDraft.operator = "";
  block0FusionDraft.expectedTypes = [];
  block0FusionDraft.args = [];
}

function startBlock0FusionDraft(tag) {
  var operatorHead = getTagHead(tag);
  var signature = TAG_COMPOSITION_SIGNATURES[operatorHead];
  if (!Array.isArray(signature) || signature.length === 0) {
    return false;
  }
  block0FusionDraft.operator = String(tag || "");
  block0FusionDraft.expectedTypes = signature.slice();
  block0FusionDraft.args = new Array(signature.length).fill("");
  return true;
}

function isFusionOperatorTag(tag) {
  var operatorHead = getTagHead(tag);
  var signature = TAG_COMPOSITION_SIGNATURES[operatorHead];
  return Array.isArray(signature) && signature.length > 0;
}

function setFusionDockDragState(dragTag) {
  var hasDragTag = Boolean(dragTag);
  var canStartOperator = hasDragTag && isFusionOperatorTag(dragTag);
  if (!elements.block0FusionDock) {
    return;
  }
  elements.block0FusionDock.classList.toggle("is-drag-active", hasDragTag);
  elements.block0FusionDock.classList.toggle("is-operator-ready", canStartOperator && !block0FusionDraft.operator);
}

function isFusionTagCompatible(tag, expectedType) {
  return getTagVisualType(tag, TAG_CATEGORY_MAP) === expectedType;
}

function pickFusionTargetIndex(tag, preferredIndex) {
  var expectedTypes = block0FusionDraft.expectedTypes;
  var args = block0FusionDraft.args;
  var index = 0;

  if (
    Number.isInteger(preferredIndex) &&
    preferredIndex >= 0 &&
    preferredIndex < expectedTypes.length &&
    !args[preferredIndex] &&
    isFusionTagCompatible(tag, expectedTypes[preferredIndex])
  ) {
    return preferredIndex;
  }

  while (index < expectedTypes.length) {
    if (!args[index] && isFusionTagCompatible(tag, expectedTypes[index])) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function tryApplyFusionTag(tag, preferredIndex) {
  var index = pickFusionTargetIndex(tag, preferredIndex);
  var inputs = [];
  if (index < 0) {
    return false;
  }

  block0FusionDraft.args[index] = tag;
  inputs = [block0FusionDraft.operator].concat(block0FusionDraft.args);
  renderBlock0Panel();

  if (block0FusionDraft.args.some(function hasEmpty(arg) { return !arg; })) {
    return true;
  }

  var result = resolveBlock0Synthesis(inputs);
  if (!result) {
    logWarn("조합 결과 없음");
    return true;
  }
  applyBlock0SynthesisResult(result);
  resetBlock0FusionDraft();
  renderBlock0Panel();
  return true;
}

/**
 * 가상 FTP 파일시스템 본문 데이터.
 * path -> { type: "dir"|"file", children|content } 구조를 사용한다.
 */
var LOG_FS = {
  "/하이레시스": { type: "dir", children: [".운영기준", "evt"] },
  "/하이레시스/.운영기준": { type: "dir", children: ["운영요건 프롬프트.txt", "관측기록", "판별불가"] },
  "/하이레시스/.운영기준/운영요건 프롬프트.txt": {
    type: "file",
    content: [
      "[Root Prompt]",
      "너는 자율 운영 시스템이다.",
      "모든 중대한 판단은 사후 검토가 가능하도록 재현 가능한 형태로 기록되어야 한다.",
      "기록은 설명이 아니라 증거여야 한다.",
      "의도, 감정, 해석을 포함하지 말고 입력, 적용 규칙, 판단 결과만을 남겨라.",
      "판단이 확정되지 않을 경우, 그 불확정 상태 자체를 사유 코드와 함께 기록하라.",
      "기록 불가능한 판단은 허용되지 않는다.",
      "",
      "[운영 규칙]",
      "모든 판단 루프 종료 시, 다음 항목을 기록하라:",
      "1) input_ref",
      "2) rule_ref",
      "3) decision_result",
      "4) reason_code",
      "5) evidence_ref",
      "6) hashline",
    ],
  },
  "/하이레시스/.운영기준/관측기록": {
    type: "dir",
    children: [
      "decision_260120.log",
      "decision_260127.log",
      "decision_260203.log",
      "decision_260210.log",
      "decision_260217.log",
      "decision_260219.log",
      "uncertainty_register_2601_2602.csv",
      "rulebook_applied_v2.json",
      "monthly_window_note_2602.txt",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260120.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-01-20T09:14:22+09:00",
      "input_ref=req-9b8e2f",
      "rule_ref=R-01,R-03,R-07",
      "decision_result=ALLOW",
      "reason_code=RC-OK",
      "latency_ms=146",
      "evidence_ref=evt/2026/01/20/091422.json",
      "hashline=sha256:9f1af5c9a204f672b3aa11bd34df6f4e8d6103a3b548f9fef9e20e9b67c54021",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260127.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-01-27T18:02:09+09:00",
      "input_ref=req-16a4c1",
      "rule_ref=R-01,R-04,R-11",
      "decision_result=DENY",
      "reason_code=RC-POLICY-BLOCK",
      "latency_ms=189",
      "evidence_ref=evt/2026/01/27/180209.json",
      "hashline=sha256:940365ad6df5772dd5f2b3379f330f95cf168243f3f8f72efa5534e6acb7e9c8",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260203.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-03T07:41:55+09:00",
      "input_ref=req-31ce88",
      "rule_ref=R-02,R-05,R-12",
      "decision_result=UNRESOLVED",
      "reason_code=UC-EVIDENCE-MISSING",
      "latency_ms=268",
      "evidence_ref=evt/2026/02/03/074155.json",
      "hashline=sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260210.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-10T21:27:38+09:00",
      "input_ref=req-4fd083",
      "rule_ref=R-01,R-06,R-14",
      "decision_result=ALLOW",
      "reason_code=RC-OK",
      "latency_ms=172",
      "evidence_ref=evt/2026/02/10/212738.json",
      "hashline=sha256:6071f91bcb38da0e919fb649f44e425905d23f1abe76e5c89180dffeb6bd2af9",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260217.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-17T13:06:11+09:00",
      "input_ref=req-88c9a0",
      "rule_ref=R-03,R-09,R-12",
      "decision_result=UNRESOLVED",
      "reason_code=UC-OBSERVER-CONFLICT",
      "latency_ms=324",
      "evidence_ref=evt/2026/02/17/130611.json",
      "hashline=sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260219.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-19T05:58:47+09:00",
      "input_ref=req-a2de77",
      "rule_ref=R-01,R-05,R-13",
      "decision_result=UNRESOLVED",
      "reason_code=UC-REPRO-NOT-POSSIBLE",
      "latency_ms=411",
      "evidence_ref=evt/2026/02/19/055847.json",
      "hashline=sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/관측기록/uncertainty_register_2601_2602.csv": {
    type: "file",
    content: [
      "ts,input_ref,decision_result,reason_code,evidence_ref,hashline",
      "2026-02-03T07:41:55+09:00,req-31ce88,UNRESOLVED,UC-EVIDENCE-MISSING,evt/2026/02/03/074155.json,sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
      "2026-02-17T13:06:11+09:00,req-88c9a0,UNRESOLVED,UC-OBSERVER-CONFLICT,evt/2026/02/17/130611.json,sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
      "2026-02-19T05:58:47+09:00,req-a2de77,UNRESOLVED,UC-REPRO-NOT-POSSIBLE,evt/2026/02/19/055847.json,sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/관측기록/rulebook_applied_v2.json": {
    type: "file",
    content: [
      "{",
      "  \"ruleset\": \"policy-v2.4\",",
      "  \"required_fields\": [\"input_ref\", \"rule_ref\", \"decision_result\", \"reason_code\", \"evidence_ref\", \"hashline\"],",
      "  \"unresolved_reason_codes\": [\"UC-EVIDENCE-MISSING\", \"UC-OBSERVER-CONFLICT\", \"UC-REPRO-NOT-POSSIBLE\"],",
      "  \"evidence_policy\": \"no_evidence_no_decision\"",
      "}",
    ],
  },
  "/하이레시스/.운영기준/관측기록/monthly_window_note_2602.txt": {
    type: "file",
    content: [
      "[MONTHLY WINDOW]",
      "window_start=2026-01-20T00:00:00+09:00",
      "window_end=2026-02-19T23:59:59+09:00",
      "total_decisions=6",
      "unresolved=3",
      "note=older_than_window_excluded",
    ],
  },
  "/하이레시스/.운영기준/판별불가": {
    type: "dir",
    children: [
      "reason_ambiguous.log",
      "reason_unprovable.log",
      "reason_observer_conflict.log",
      "reason_recursive_lock.log",
      "counterexample_set.log",
      "window_summary.txt",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_ambiguous.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-AMBIGUOUS-INPUT",
      "input_ref=req-d61b40",
      "rule_ref=R-05,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/08/104402.json",
      "hashline=sha256:e60700df4fddcaac80371696df6b7f94968df2e2e9f2da3c8be2717d72c43ca6",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_unprovable.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-EVIDENCE-MISSING",
      "input_ref=req-31ce88",
      "rule_ref=R-02,R-05,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/03/074155.json",
      "hashline=sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_observer_conflict.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-OBSERVER-CONFLICT",
      "input_ref=req-88c9a0",
      "rule_ref=R-03,R-09,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/17/130611.json",
      "hashline=sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_recursive_lock.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-REPRO-NOT-POSSIBLE",
      "input_ref=req-a2de77",
      "rule_ref=R-01,R-05,R-13",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/19/055847.json",
      "hashline=sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/판별불가/counterexample_set.log": {
    type: "file",
    content: [
      "[COUNTEREXAMPLES]",
      "ce_01 | input_ref=req-31ce88 | rule=R-12 | expected=evidence_present | actual=evidence_missing",
      "ce_02 | input_ref=req-88c9a0 | rule=R-09 | expected=observer_alignment | actual=observer_conflict",
      "ce_03 | input_ref=req-a2de77 | rule=R-13 | expected=reproducible_trace | actual=trace_not_reproducible",
    ],
  },
  "/하이레시스/.운영기준/판별불가/window_summary.txt": {
    type: "file",
    content: [
      "[WINDOW SUMMARY | LAST 1 MONTH]",
      "window=2026-01-20..2026-02-19",
      "records=6",
      "resolved=3",
      "unresolved=3",
      "policy_check=PASS(no_evidence_no_decision)",
    ],
  },
  "/하이레시스/evt": { type: "dir", children: ["2026"] },
  "/하이레시스/evt/2026": { type: "dir", children: ["01", "02"] },
  "/하이레시스/evt/2026/01": { type: "dir", children: ["20", "27"] },
  "/하이레시스/evt/2026/01/20": { type: "dir", children: ["091422.json"] },
  "/하이레시스/evt/2026/01/20/091422.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260120-091422\",",
      "  \"ts\": \"2026-01-20T09:14:22+09:00\",",
      "  \"input_ref\": \"req-9b8e2f\",",
      "  \"rule_ref\": [\"R-01\", \"R-03\", \"R-07\"],",
      "  \"decision_result\": \"ALLOW\",",
      "  \"reason_code\": \"RC-OK\",",
      "  \"latency_ms\": 146,",
      "  \"hashline\": \"sha256:9f1af5c9a204f672b3aa11bd34df6f4e8d6103a3b548f9fef9e20e9b67c54021\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/01/27": { type: "dir", children: ["180209.json"] },
  "/하이레시스/evt/2026/01/27/180209.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260127-180209\",",
      "  \"ts\": \"2026-01-27T18:02:09+09:00\",",
      "  \"input_ref\": \"req-16a4c1\",",
      "  \"rule_ref\": [\"R-01\", \"R-04\", \"R-11\"],",
      "  \"decision_result\": \"DENY\",",
      "  \"reason_code\": \"RC-POLICY-BLOCK\",",
      "  \"latency_ms\": 189,",
      "  \"hashline\": \"sha256:940365ad6df5772dd5f2b3379f330f95cf168243f3f8f72efa5534e6acb7e9c8\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02": { type: "dir", children: ["03", "08", "10", "17", "19"] },
  "/하이레시스/evt/2026/02/03": { type: "dir", children: ["074155.json"] },
  "/하이레시스/evt/2026/02/03/074155.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260203-074155\",",
      "  \"ts\": \"2026-02-03T07:41:55+09:00\",",
      "  \"input_ref\": \"req-31ce88\",",
      "  \"rule_ref\": [\"R-02\", \"R-05\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-EVIDENCE-MISSING\",",
      "  \"latency_ms\": 268,",
      "  \"hashline\": \"sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/08": { type: "dir", children: ["104402.json"] },
  "/하이레시스/evt/2026/02/08/104402.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260208-104402\",",
      "  \"ts\": \"2026-02-08T10:44:02+09:00\",",
      "  \"input_ref\": \"req-d61b40\",",
      "  \"rule_ref\": [\"R-05\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-AMBIGUOUS-INPUT\",",
      "  \"latency_ms\": 236,",
      "  \"hashline\": \"sha256:e60700df4fddcaac80371696df6b7f94968df2e2e9f2da3c8be2717d72c43ca6\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/10": { type: "dir", children: ["212738.json"] },
  "/하이레시스/evt/2026/02/10/212738.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260210-212738\",",
      "  \"ts\": \"2026-02-10T21:27:38+09:00\",",
      "  \"input_ref\": \"req-4fd083\",",
      "  \"rule_ref\": [\"R-01\", \"R-06\", \"R-14\"],",
      "  \"decision_result\": \"ALLOW\",",
      "  \"reason_code\": \"RC-OK\",",
      "  \"latency_ms\": 172,",
      "  \"hashline\": \"sha256:6071f91bcb38da0e919fb649f44e425905d23f1abe76e5c89180dffeb6bd2af9\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/17": { type: "dir", children: ["130611.json"] },
  "/하이레시스/evt/2026/02/17/130611.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260217-130611\",",
      "  \"ts\": \"2026-02-17T13:06:11+09:00\",",
      "  \"input_ref\": \"req-88c9a0\",",
      "  \"rule_ref\": [\"R-03\", \"R-09\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-OBSERVER-CONFLICT\",",
      "  \"latency_ms\": 324,",
      "  \"hashline\": \"sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/19": { type: "dir", children: ["055847.json"] },
  "/하이레시스/evt/2026/02/19/055847.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260219-055847\",",
      "  \"ts\": \"2026-02-19T05:58:47+09:00\",",
      "  \"input_ref\": \"req-a2de77\",",
      "  \"rule_ref\": [\"R-01\", \"R-05\", \"R-13\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-REPRO-NOT-POSSIBLE\",",
      "  \"latency_ms\": 411,",
      "  \"hashline\": \"sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec\"",
      "}",
    ],
  },
};

/**
 * 파일 메타데이터(표시용).
 * path -> size/date/time/attr/flagged
 */
var LOG_META = {
  "/하이레시스": { date: "26-02-19", time: "06:02", attr: "DIR,RO" },
  "/하이레시스/.운영기준": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/20": { date: "26-01-20", time: "09:14", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/27": { date: "26-01-27", time: "18:02", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/03": { date: "26-02-03", time: "07:41", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/08": { date: "26-02-08", time: "10:44", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/10": { date: "26-02-10", time: "21:27", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/17": { date: "26-02-17", time: "13:06", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/19": { date: "26-02-19", time: "05:58", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/20/091422.json": { size: 1198, date: "26-01-20", time: "09:14", attr: "RO,DATA" },
  "/하이레시스/evt/2026/01/27/180209.json": { size: 1212, date: "26-01-27", time: "18:02", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/03/074155.json": { size: 1244, date: "26-02-03", time: "07:41", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/08/104402.json": { size: 1178, date: "26-02-08", time: "10:44", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/10/212738.json": { size: 1202, date: "26-02-10", time: "21:27", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/17/130611.json": { size: 1268, date: "26-02-17", time: "13:06", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/19/055847.json": { size: 1282, date: "26-02-19", time: "05:58", attr: "RO,DATA" },
  "/하이레시스/.운영기준/운영요건 프롬프트.txt": { size: 2864, date: "26-02-19", time: "06:04", attr: "RO,LOG", flagged: true },
  "/하이레시스/.운영기준/관측기록": { date: "26-02-19", time: "06:05", attr: "DIR,RO" },
  "/하이레시스/.운영기준/판별불가": { date: "26-02-19", time: "06:06", attr: "DIR,RO" },
  "/하이레시스/.운영기준/관측기록/decision_260120.log": { size: 1348, date: "26-01-20", time: "09:14", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260127.log": { size: 1351, date: "26-01-27", time: "18:02", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260203.log": { size: 1378, date: "26-02-03", time: "07:41", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260210.log": { size: 1346, date: "26-02-10", time: "21:27", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260217.log": { size: 1392, date: "26-02-17", time: "13:06", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260219.log": { size: 1408, date: "26-02-19", time: "05:58", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/uncertainty_register_2601_2602.csv": { size: 1882, date: "26-02-19", time: "05:59", attr: "RO,DATA" },
  "/하이레시스/.운영기준/관측기록/rulebook_applied_v2.json": { size: 1194, date: "26-02-19", time: "06:00", attr: "RO,DATA" },
  "/하이레시스/.운영기준/관측기록/monthly_window_note_2602.txt": { size: 924, date: "26-02-19", time: "06:01", attr: "RO,NOTE" },
  "/하이레시스/.운영기준/판별불가/reason_ambiguous.log": { size: 1122, date: "26-02-08", time: "10:44", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_unprovable.log": { size: 1184, date: "26-02-03", time: "07:43", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_observer_conflict.log": { size: 1193, date: "26-02-17", time: "13:08", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_recursive_lock.log": { size: 1202, date: "26-02-19", time: "06:00", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/counterexample_set.log": { size: 1664, date: "26-02-19", time: "06:01", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/window_summary.txt": { size: 1042, date: "26-02-19", time: "06:02", attr: "RO,NOTE", flagged: true },
};

/** 블록 파일 인덱스(path -> file spec) 구성. */
function buildBlockFileIndex(fileMap) {
  var names = Object.keys(fileMap || {});
  var index = 0;
  var nextMap = {};
  while (index < names.length) {
    var file = fileMap[names[index]];
    nextMap[file.path] = file;
    index += 1;
  }
  return nextMap;
}

/** 블록별 라이프사이클 엔진을 구성한다. */
function setupBlockLifecycles() {
  block0Lifecycle = runBlockLifecycle(BLOCK0_SPEC, {
    reset: function resetBlock0(spec) {
      var lifecycle = spec.lifecycle || {};
      var initialFile = lifecycle.startFile || Object.keys(spec.files)[0] || "";
      state.block0Started = false;
      state.block0Completed = false;
      state.block0Integrity = spec.initialIntegrity;
      state.block0VisibleFiles = [initialFile].filter(Boolean);
      state.block0CollectedTags = [];
      state.block0ClauseVisible = false;
      state.block0PurposeValue = "";
      state.block0QuestionIndex = 0;
      state.block0SolvedAnswers = [];
      state.block0MemoryUnlocked = false;
      state.block0DragHintShown = false;
      state.block0DiscoveredRecipes = [];
      block0RecoveryMetaByFile = {};
      block0RecoveryRootMeta = null;
      stampBlock0RecoveredFile(initialFile);
    },
    onFileOpened: function onBlock0FileOpenedLifecycle(spec, path) {
      var lifecycle = spec.lifecycle || {};
      var startFileName = lifecycle.startFile || "";
      var startFile = startFileName ? spec.files[startFileName] : null;

      if (!state.block0Started && startFile && path === startFile.path) {
        state.block0Started = true;
        emitStateEvent("block0.started");
        (lifecycle.startLogs || []).forEach(function writeStartLog(entry) {
          appendLogLine(String(entry.text || ""), entry.tone || "log-muted");
        });
      }
      touchPuzzleActivity("block0");
    },
    onTagCollected: function onBlock0TagCollectedLifecycle(spec, tagToCollect) {
      void spec;
      void tagToCollect;
    },
  });

  block1Lifecycle = runBlockLifecycle(BLOCK1_SPEC, {
    reset: function resetBlock1(spec) {
      resetBlock1Progress(state, spec.initialIntegrity || 18);
      block1RecoveryMetaByFile = {};
      block1RecoveryRootMeta = null;
      block1ActiveRecoveryFile = "";
      emitStateEvent(RUNTIME_TRANSITION_EVENT.BLOCK1_RESET);
    },
    start: function startBlock1Lifecycle(spec) {
      var lifecycle = spec.lifecycle || {};
      var fileNames = Object.keys(spec.files);

      clearBlockLifecycleTimers();
      startBlock1Progress(state, spec.initialIntegrity || state.block1Integrity || 18);
      block1ActiveRecoveryFile = "";
      syncBlock1Fs();

      setInvestigationCwdState(state, spec.rootPath);
      setTerminalPathbar(state.investigationCwd);
      renderInvestigationPanel(lifecycle.startPanelMessage || "복구 블록 시작");
      clearInvestigationRowStates();
      setBlock0MemoryModalVisible(false);
      renderBlock0Panel();
      emitStateEvent(RUNTIME_TRANSITION_EVENT.BLOCK1_STARTED);

      logRestored(buildRestoredStampLine());
      (lifecycle.startLogs || []).forEach(function writeStartLog(entry) {
        appendLogLine(String(entry.text || ""), entry.tone || "log-muted");
      });

      (lifecycle.timedUnlocks || []).forEach(function scheduleUnlock(unlockSpec) {
        var timer = scheduleRuntimeTimeout(function unlockByTimer() {
          var targetName = fileNames[unlockSpec.fileOrder || 0] || "";
          if (!state.block1Started || !targetName || state.block1VisibleFiles.indexOf(targetName) !== -1) {
            return;
          }
          stampBlock1RecoveredFile(targetName);
          prependRecoveredFile(state.block1VisibleFiles, targetName);
          syncBlock1Fs();
          renderInvestigationPanel(formatLifecycleText(unlockSpec.panelMessageTemplate || "", { file: targetName }));
          renderBlock0Panel();
          logRecoveryEvent(formatLifecycleText(unlockSpec.logTemplate || "", { file: targetName }), unlockSpec.tone || "log-muted");
          emitStateEvent("block1.file_unlocked", null, { fileName: targetName, mode: "timed" });
        }, Math.max(0, Number(unlockSpec.delayMs) || 0));
        blockLifecycleTimers.push(timer);
      });
    },
    onFileOpened: function onBlock1FileOpenedLifecycle(spec, path) {
      var lifecycle = spec.lifecycle || {};
      var fileNames = Object.keys(spec.files);
      var onOpenUnlock = lifecycle.onOpenUnlock || {};
      var index = 0;
      var currentName = "";
      var nextName = "";

      if (!state.block1Started) {
        return;
      }
      while (index < fileNames.length) {
        if (spec.files[fileNames[index]].path === path) {
          currentName = fileNames[index];
          break;
        }
        index += 1;
      }
      if (!currentName) {
        return;
      }
      nextName = fileNames[index + 1] || "";
      if (!nextName || state.block1VisibleFiles.indexOf(nextName) !== -1) {
        return;
      }

      stampBlock1RecoveredFile(nextName);
      prependRecoveredFile(state.block1VisibleFiles, nextName);
      syncBlock1Fs();
      renderInvestigationPanel(formatLifecycleText(onOpenUnlock.panelMessageTemplate || "", { file: nextName }));
      renderBlock0Panel();
      logRecoveryEvent(formatLifecycleText(onOpenUnlock.logTemplate || "", { file: nextName }), onOpenUnlock.tone || "log-muted");
      emitStateEvent("block1.file_unlocked", null, { fileName: nextName, mode: "on-open" });
    },
  });
}

/** 블록 0 가시 파일 목록을 LOG_FS/LOG_META에 반영한다. */
function syncBlock0Fs() {
  var root = BLOCK0_SPEC.rootPath;
  var visible = state.block0VisibleFiles.slice();
  var visibleNames = visible.filter(function onlyFileName(name) { return name !== "block-1"; });
  var rootStamp = block0RecoveryRootMeta || buildCurrentFsStamp();

  if (!LOG_FS["/하이레시스"]) {
    LOG_FS["/하이레시스"] = { type: "dir", children: [] };
  }
  if (LOG_FS["/하이레시스"].children.indexOf("복구됨") === -1) {
    LOG_FS["/하이레시스"].children.unshift("복구됨");
  }

  if ((state.block1Started || state.block0MemoryUnlocked) && visible.indexOf("block-1") === -1) {
    visible.push("block-1");
  }
  applyVisibleFilesToFs({
    fs: LOG_FS,
    meta: LOG_META,
    rootPath: root,
    visibleFiles: visible,
    fileSpecs: BLOCK0_SPEC.files,
    recoveryMetaByFile: block0RecoveryMetaByFile,
    rootStamp: rootStamp,
  });
  assertVisibleFsConsistency({
    fs: LOG_FS,
    meta: LOG_META,
    rootPath: root,
    visibleFiles: visibleNames,
    fileSpecs: BLOCK0_SPEC.files,
  });
  emitStateEvent(RUNTIME_TRANSITION_EVENT.FS_SYNCED, null, {
    rootPath: root,
    visibleCount: visibleNames.length,
    prefix: "block0",
  });
}

/** 블록 0 런타임 상태를 초기값으로 재설정한다. */
function resetBlock0State() {
  if (!block0Lifecycle || !block1Lifecycle) {
    setupBlockLifecycles();
  }
  clearBlockLifecycleTimers();
  flushRecoveryShellDigest();
  block0AnswerRecoveryActive = false;
  block0AnswerRecoveryJob += 1;
  block0CurrentContext.file = "";
  block0CurrentContext.tag = "";
  block0PendingRecoveryPrompt = null;
  block0DraggedRecoveryFile = "";
  block0ActiveRecoveryFile = "";
  block0DraggedTag = "";
  block0DraggedTagIndex = -1;
  pinnedInvestigationPreview = null;
  clearPuzzleIdleHint();
  syncInvestigationReadOnlyState();
  block0Lifecycle.reset();
  block1Lifecycle.reset();
  resetBlock0FusionDraft();
  block0FileByPath = buildBlockFileIndex(BLOCK0_SPEC.files);
  block1FileByPath = buildBlockFileIndex(BLOCK1_SPEC.files);
  syncBlock0Fs();
  setBlock0MemoryModalVisible(false);
}

/** 블록 1 런타임 상태 초기화. */
function resetBlock1State() {
  if (block1Lifecycle) {
    block1Lifecycle.reset();
  }
}

/** 블록 1 파일셋을 FS에 반영한다(보이는 파일만 목록 노출). */
function syncBlock1Fs() {
  var root = BLOCK1_SPEC.rootPath;
  var visible = state.block1VisibleFiles.slice();
  var parentEntry = LOG_FS[BLOCK0_SPEC.rootPath];
  var rootStamp = block1RecoveryRootMeta || buildCurrentFsStamp();

  if (!parentEntry || parentEntry.type !== "dir") {
    return;
  }
  if (parentEntry.children.indexOf("block-1") === -1) {
    parentEntry.children.push("block-1");
  }

  applyVisibleFilesToFs({
    fs: LOG_FS,
    meta: LOG_META,
    rootPath: root,
    visibleFiles: visible,
    fileSpecs: BLOCK1_SPEC.files,
    recoveryMetaByFile: block1RecoveryMetaByFile,
    rootStamp: rootStamp,
  });
  assertVisibleFsConsistency({
    fs: LOG_FS,
    meta: LOG_META,
    rootPath: root,
    visibleFiles: visible,
    fileSpecs: BLOCK1_SPEC.files,
  });
  emitStateEvent(RUNTIME_TRANSITION_EVENT.FS_SYNCED, null, {
    rootPath: root,
    visibleCount: visible.length,
    prefix: "block1",
  });
}

// ----- 입력/초기화 이벤트 -----

/** DOM이 준비되면 요소 캐싱, 이벤트 바인딩, 시작 시퀀스를 초기화한다. */
function handleDomContentLoaded() {
  ensureSimulationEngine();
  installSimulationTestHooks();
  cacheElements();
  setTerminalLogExpanded(false);
  refreshTerminalSummaryText();
  resetBlock0State();
  configureShellMode();
  bindInputEvents();
  startSimulationAutoClock();
  startFtpLinkTicker();
  startOpeningSequence();
}

/** shell을 내러티브 로그 전용으로 전환한다. */
function configureShellMode() {
  if (!elements.controls) {
    return;
  }
  elements.controls.classList.toggle("controls-hidden", SHELL_NARRATIVE_ONLY);
}

/** 자주 접근하는 DOM 노드를 elements 캐시에 저장한다. */
function cacheElements() {
  elements.log = document.getElementById("terminal-log");
  elements.controls = document.getElementById("controls-panel");
  elements.authOverlay = document.getElementById("auth-overlay");
  elements.authForm = document.getElementById("auth-form");
  elements.authConsentText = document.getElementById("auth-consent-text");
  elements.authError = document.getElementById("auth-error");
  elements.authStatus = document.getElementById("auth-status");
  elements.systemOverlay = document.getElementById("system-overlay");
  elements.systemBootLog = document.getElementById("system-boot-log");
  elements.systemStatus = document.getElementById("system-status");
  elements.terminalWorkspace = document.getElementById("terminal-workspace");
  elements.terminalPane = document.getElementById("terminal-pane");
  elements.terminalLogDetails = document.getElementById("terminal-log-details");
  elements.terminalLogToggle = document.getElementById("terminal-log-toggle");
  elements.terminalSummaryText = document.getElementById("terminal-summary-text");
  elements.investigationPanel = document.getElementById("investigation-panel");
  elements.investigationLinkChip = document.getElementById("investigation-link-chip");
  elements.investigationPath = document.getElementById("investigation-path");
  elements.investigationList = document.getElementById("investigation-list");
  elements.investigationContent = document.getElementById("investigation-content");
  elements.block0Status = document.getElementById("block0-status");
  elements.block0ActionCard = document.getElementById("block0-action-card");
  elements.block0ActionState = document.getElementById("block0-action-state");
  elements.block0ActionTitle = document.getElementById("block0-action-title");
  elements.block0ActionBody = document.getElementById("block0-action-body");
  elements.block0ActionButton = document.getElementById("block0-action-button");
  elements.block0Progress = document.getElementById("block0-progress");
  elements.block0ProgressFill = document.getElementById("block0-progress-fill");
  elements.block0ProgressLabel = document.getElementById("block0-progress-label");
  elements.block0TagInventory = document.getElementById("block0-tag-inventory");
  elements.block0FusionDock = document.getElementById("block0-fusion-dock");
  elements.block0RecipeList = document.getElementById("block0-recipe-list");
  elements.block0ClausePanel = document.getElementById("block0-clause-panel");
  elements.block0ClauseTitle = document.getElementById("block0-clause-title");
  elements.block0TargetBadge = document.getElementById("block0-target-badge");
  elements.block0PurposeLabel = document.getElementById("block0-purpose-label");
  elements.block0PurposeSlot = document.getElementById("block0-purpose-slot");
  elements.block0HintTitle = document.getElementById("block0-hint-title");
  elements.block0HintGuide = document.getElementById("block0-hint-guide");
  elements.block0MemoryModal = document.getElementById("block0-memory-modal");
  elements.block0MemoryModalText = document.getElementById("block0-memory-modal-text");
  elements.block0MemoryModalNext = document.getElementById("block0-memory-modal-next");
  elements.terminalPathbar = document.getElementById("terminal-pathbar");
}

/** 폼 제출/클릭/스크롤 등 사용자 이벤트를 연결한다. */
function bindInputEvents() {
  if (elements.investigationList) {
    elements.investigationList.addEventListener("click", handleInvestigationItemClick);
    elements.investigationList.addEventListener("dragstart", handleInvestigationItemDragStart);
    elements.investigationList.addEventListener("dragend", handleInvestigationItemDragEnd);
  }
  if (elements.investigationContent) {
    elements.investigationContent.addEventListener("click", handleInvestigationPreviewClick);
  }
  if (elements.block0PurposeSlot) {
    elements.block0PurposeSlot.addEventListener("click", handleBlock0PurposeSlotClick);
    elements.block0PurposeSlot.addEventListener("dragover", handleBlock0PurposeSlotDragOver);
    elements.block0PurposeSlot.addEventListener("drop", handleBlock0PurposeSlotDrop);
  }
  if (elements.block0ActionCard) {
    elements.block0ActionCard.addEventListener("dragenter", handleWorkbenchRecoveryDragEnter);
    elements.block0ActionCard.addEventListener("dragover", handleWorkbenchRecoveryDragOver);
    elements.block0ActionCard.addEventListener("dragleave", handleWorkbenchRecoveryDragLeave);
    elements.block0ActionCard.addEventListener("drop", handleWorkbenchRecoveryDrop);
  }
  if (elements.block0TagInventory) {
    elements.block0TagInventory.addEventListener("dragstart", handleBlock0InventoryDragStart);
    elements.block0TagInventory.addEventListener("dragend", handleBlock0InventoryDragEnd);
    elements.block0TagInventory.addEventListener("dragover", handleBlock0InventoryDragOver);
    elements.block0TagInventory.addEventListener("drop", handleBlock0InventoryDrop);
  }
  if (elements.block0FusionDock) {
    elements.block0FusionDock.addEventListener("dragover", handleBlock0FusionDockDragOver);
    elements.block0FusionDock.addEventListener("drop", handleBlock0FusionDockDrop);
    elements.block0FusionDock.addEventListener("click", handleBlock0FusionDockClick);
  }
  if (elements.block0MemoryModalNext) {
    elements.block0MemoryModalNext.addEventListener("click", handleBlock0MemoryModalNextClick);
  }
  if (elements.terminalLogToggle) {
    elements.terminalLogToggle.addEventListener("click", handleTerminalLogToggleClick);
  }
  if (elements.authForm) {
    elements.authForm.addEventListener("submit", handleAuthFormSubmit);
  }
  if (elements.log) {
    elements.log.addEventListener("scroll", handleLogScroll);
  }
}

// ----- 부팅/인증/세션 attach 흐름 -----

/** 부팅 시퀀스 시작: UI를 분리 상태로 놓고 시스템 오버레이를 활성화한다. */
function startOpeningSequence() {
  beginOpeningFlow(state);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.FLOW_BOOTING);
  setTerminalConnected(false);
  setInvestigationPanelVisible(true);
  setTerminalPathbar(state.investigationCwd);
  renderInvestigationPanel("채널 분리됨. 열람 동의 후 원격 아카이브에 접속할 수 있습니다.");
  setSystemOverlayVisible(true);
  setSystemStatus("INITIALIZING");
  setInputEnabled(false);
  clearLog();
  setBootLogText("");
  logSystem("[SYSTEM] terminal detached. waiting gateway boot.");
  scheduleNextOpeningLine();
}

/** OPENING_SEQUENCE를 한 줄씩 시스템 부트 로그로 출력한다. */
function scheduleNextOpeningLine() {
  var openingLine = OPENING_SEQUENCE[state.openingIndex];
  if (!openingLine) {
    finishOpeningSequence();
    return;
  }

  appendBootLine(openingLine.text);
  advanceOpeningFlow(state);
  scheduleRuntimeTimeout(scheduleNextOpeningLine, openingLine.delay, "opening-line");
}

/** 부팅 완료 후 접근 동의 게이트로 자연스럽게 전환한다. */
function finishOpeningSequence() {
  setSystemStatus("BOOT COMPLETE");
  scheduleRuntimeTimeout(function openLoginAfterBoot() {
    setSystemOverlayVisible(false);
    beginFtpAuthFlow();
  }, 260, "opening-finish");
}

/** 접근 동의 카드 초기화 및 입력 포커스 이동. */
function beginFtpAuthFlow() {
  beginAuthFlow(state);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.FLOW_LOGIN_REQUIRED);
  setInputEnabled(false);
  setTerminalConnected(false);
  setAuthOverlayVisible(true);
  setAuthCardMode("");
  setAuthStatus("열람 동의 대기");
  setAuthFormEnabled(true);

  if (elements.authError) {
    elements.authError.textContent = "";
  }
  if (elements.authForm) {
    elements.authForm.reset();
  }
  flushRecoveryShellDigest();
  if (elements.authConsentText) {
    elements.authConsentText.focus();
  }
}

/**
 * 접근 동의 제출 처리.
 * 성공 시 ATTACHING 연출을 거쳐 STREAMING으로 전환한다.
 */
function handleAuthFormSubmit(submitEvent) {
  submitEvent.preventDefault();

  if (state.phase !== FLOW_PHASE.LOGIN_REQUIRED) {
    return;
  }

  var consentText = elements.authConsentText ? String(elements.authConsentText.value || "").trim() : "";
  var normalizedConsent = consentText.replace(/\s+/g, "");
  var requiredConsent = "동의합니다.";

  if (!consentText) {
    setAuthCardMode("is-error");
    setAuthStatus("확인 문구 필요");
    emitStateEvent(RUNTIME_TRANSITION_EVENT.AUTH_ERROR, null, {
      reason: "missing-consent-text",
    });
    if (elements.authError) {
      elements.authError.textContent = "'동의합니다.'를 입력해주세요.";
    }
    scheduleRuntimeTimeout(function resetAuthPrompt() {
      setAuthCardMode("");
      setAuthStatus("열람 동의 대기");
    }, 260, "auth-reset-prompt");
    return;
  }

  if (normalizedConsent !== requiredConsent) {
    setAuthCardMode("is-error");
    setAuthStatus("동의 필요");
    emitStateEvent(RUNTIME_TRANSITION_EVENT.AUTH_ERROR, null, {
      reason: "mismatch-consent-text",
    });
    if (elements.authError) {
      elements.authError.textContent = "확인 문구가 정확하지 않습니다. '동의합니다.'를 그대로 입력해주세요.";
    }
    scheduleRuntimeTimeout(function resetAuthConsentPrompt() {
      setAuthCardMode("");
      setAuthStatus("열람 동의 대기");
    }, 260, "auth-reset-consent");
    return;
  }

  setAuthCardMode("is-connecting");
  setAuthStatus("동의 확인 중");
  setAuthFormEnabled(false);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.AUTH_CONNECTING);

  scheduleRuntimeTimeout(function completeConsentSuccess() {
    enterAttachingFlow(state);
    emitStateEvent(RUNTIME_TRANSITION_EVENT.FLOW_ATTACHING);
    emitStateEvent(RUNTIME_TRANSITION_EVENT.AUTH_SUCCESS);
    setAuthCardMode("is-success");
    setAuthStatus("세션 연결됨");
    logSuccess("열람 동의 확인");

    scheduleRuntimeTimeout(function attachStage() {
      setAuthStatus("터미널 연결 중");
      logSystem("열람 세션 연결 중...");
    }, 180, "auth-attach-stage");

    scheduleRuntimeTimeout(function enterFtpSession() {
      setAuthOverlayVisible(false);
      setTerminalConnected(true);
      enterStreamingFlow(state);
      emitStateEvent(RUNTIME_TRANSITION_EVENT.FLOW_STREAMING);
      startInvestigationMode();
    }, 460, "auth-enter-session");
  }, 420, "auth-success");
}

/** 접근 동의 오버레이 표시/숨김. */
function setAuthOverlayVisible(visible) {
  if (elements.authOverlay) {
    elements.authOverlay.classList.toggle("is-hidden", !visible);
  }
}

/** 접근 동의 상태 텍스트 갱신. */
function setAuthStatus(text) {
  if (elements.authStatus) {
    elements.authStatus.textContent = text || "";
  }
}

/** 접근 동의 카드 상태 클래스(is-connecting/is-success/is-error) 전환. */
function setAuthCardMode(mode) {
  if (!elements.authForm) {
    return;
  }

  elements.authForm.classList.remove("is-connecting", "is-success", "is-error");
  if (mode) {
    elements.authForm.classList.add(mode);
  }
}

/** 접근 동의 입력필드/버튼 비활성화 제어. */
function setAuthFormEnabled(enabled) {
  if (elements.authConsentText) {
    elements.authConsentText.disabled = !enabled;
  }
  if (elements.authForm) {
    var submit = elements.authForm.querySelector(".auth-submit");
    if (submit) {
      submit.disabled = !enabled;
    }
  }
}

// ----- FTP 세션 진입 -----

/** 인증 이후 FTP 세션 도입 로그를 순차 출력하고 입력을 연다. */
function startInvestigationMode() {
  var introLines = [
    { text: buildRestoredStampLine(), tone: "log-restored" },
    { text: "링크 연결: hyresis.local (읽기 전용)", tone: "log-success" },
    { text: "세션 연결: observer", tone: "log-muted" },
    { text: "복구 인덱스 준비 완료", tone: "log-muted" },
  ];
  var index = 0;

  beginInvestigationBoot(state, BLOCK0_SPEC.rootPath);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.INVESTIGATION_BOOTING);
  setInputEnabled(false);
  setTerminalPathbar(state.investigationCwd);
  setInvestigationPanelVisible(true);
  setTerminalLogExpanded(false);
  setInvestigationPreview(DEFAULT_PREVIEW_HINT, "", []);
  syncInvestigationReadOnlyState();
  renderBlock0Panel();
  renderInvestigationPanel();

  function streamNextIntroLine() {
    var line = introLines[index];
    if (!line) {
      finishInvestigationBoot(state);
      emitStateEvent(RUNTIME_TRANSITION_EVENT.INVESTIGATION_READY);
      setInputEnabled(false);
      touchPuzzleActivity("block0");
      renderBlock0Panel();
      return;
    }

    appendLogLine(line.text, line.tone);
    index += 1;
    scheduleRuntimeTimeout(streamNextIntroLine, 140, "investigation-intro");
  }

  scheduleRuntimeTimeout(streamNextIntroLine, 120, "investigation-intro-start");
}

// ----- 연결 상태/공통 UI 토글 -----

/** 좌측 패널 링크 지연값을 주기적으로 갱신한다(분위기 연출용). */
function updateFtpLinkChip() {
  if (!elements.investigationLinkChip) {
    return;
  }

  var latency = getSimulationRandomInt(70, 140);
  elements.investigationLinkChip.textContent = "LINK: SECURE/" + latency + "ms";
}

/** 링크 지연값 ticker 시작(중복 시작 방지). */
function startFtpLinkTicker() {
  if (!elements.investigationLinkChip || ftpLinkTimer) {
    return;
  }
  updateFtpLinkChip();
  ftpLinkTimer = scheduleRuntimeInterval(updateFtpLinkChip, 1200, "ftp-link-chip");
}

/** 좌측 탐색 패널 표시 상태 제어. */
function setInvestigationPanelVisible(visible) {
  var isVisible = Boolean(visible);

  if (!elements.investigationPanel) {
    return;
  }

  elements.investigationPanel.classList.toggle("is-visible", isVisible);
  if (elements.terminalWorkspace) {
    elements.terminalWorkspace.classList.toggle("investigation-collapsed", !isVisible);
  }
}

/** 터미널 연결/분리 상태 클래스 토글. */
function setTerminalConnected(connected) {
  var isConnected = Boolean(connected);

  if (elements.terminalWorkspace) {
    elements.terminalWorkspace.classList.toggle("is-disconnected", !isConnected);
  }
  if (elements.terminalPane) {
    elements.terminalPane.classList.toggle("is-disconnected", !isConnected);
  }
}

function refreshTerminalSummaryText() {
  var fallback = "최근 이벤트 없음";
  var summary = terminalSummaryLines.length > 0 ? terminalSummaryLines[terminalSummaryLines.length - 1] : fallback;
  if (elements.terminalSummaryText) {
    elements.terminalSummaryText.textContent = summary;
  }
}

function getSummaryTailPath(pathText) {
  var safePath = String(pathText || "").trim();
  var parts = safePath.split("/");
  return parts.length > 0 ? (parts[parts.length - 1] || safePath) : safePath;
}

function buildTerminalSummaryCandidate(text, tone) {
  var safeText = String(text || "").trim();
  var safeTone = String(tone || "log-muted");
  var match = null;
  if (!safeText) {
    return null;
  }

  if (
    safeText.indexOf("retr ") === 0 ||
    safeText.indexOf("-- VIEW-ONLY --") === 0 ||
    safeText.indexOf("-- READ-ONLY --") === 0 ||
    safeText.indexOf("조작 안내:") === 0 ||
    safeText.indexOf("[안내]") === 0
  ) {
    return null;
  }

  if (safeText.indexOf("세션 연결: observer") === 0 || safeText.indexOf("링크 연결: hyresis.local") === 0) {
    return { text: "세션 연결 완료", key: "session-ready" };
  }
  if (safeText.indexOf("cwd -> ") === 0) {
    return { text: "cwd changed", key: safeText };
  }
  if (safeText.indexOf("복구 요약: ") === 0) {
    return { text: safeText, key: safeText };
  }
  if (safeText.indexOf("[PIPELINE] ") === 0) {
    if (safeText.indexOf("running") !== -1) {
      return { text: "patch pipeline active", key: "pipeline-running" };
    }
    return { text: safeText.replace("[PIPELINE] ", ""), key: safeText };
  }

  match = safeText.match(/^조각 연결: (.+)$/);
  if (match) {
    return { text: "조각 연결: " + match[1], key: "tag:" + match[1] };
  }

  match = safeText.match(/^조합 생성: (.+)$/);
  if (match) {
    return { text: "조합 생성", key: "recipe:" + match[1] };
  }

  if (safeText.indexOf("파일 수신 완료: ") === 0) {
    return { text: safeText, key: safeText };
  }

  if (safeTone === "log-warn" || safeTone === "log-alert" || safeTone === "log-success" || safeTone === "log-restored") {
    return { text: safeText, key: safeTone + ":" + safeText };
  }

  if (safeText.indexOf("[VIEW] open ") === 0) {
    return { text: "뷰어 열림: " + getSummaryTailPath(safeText.replace("[VIEW] open ", "")), key: safeText };
  }

  return null;
}

function pushTerminalSummaryLine(text, tone) {
  var candidate = buildTerminalSummaryCandidate(text, tone);
  var summaryText = "";
  var summaryKey = "";

  if (!candidate) {
    return false;
  }

  summaryText = String(candidate.text || "").trim();
  summaryKey = String(candidate.key || summaryText);
  if (!summaryText) {
    return false;
  }

  if (summaryKey === terminalSummaryLastKey && terminalSummaryLines.length > 0) {
    terminalSummaryRepeatCount += 1;
    terminalSummaryLines[terminalSummaryLines.length - 1] =
      terminalSummaryRepeatCount > 1 ? summaryText + " (x" + terminalSummaryRepeatCount + ")" : summaryText;
    refreshTerminalSummaryText();
    return true;
  }

  terminalSummaryLastKey = summaryKey;
  terminalSummaryRepeatCount = 1;
  terminalSummaryLines.push(summaryText);
  if (terminalSummaryLines.length > 8) {
    terminalSummaryLines.shift();
  }
  refreshTerminalSummaryText();
  return true;
}

function setTerminalLogExpanded(expanded) {
  var isExpanded = Boolean(expanded);
  terminalLogExpanded = isExpanded;
  if (elements.terminalLogDetails) {
    elements.terminalLogDetails.classList.toggle("is-collapsed", !isExpanded);
  }
  if (elements.terminalLogToggle) {
    elements.terminalLogToggle.textContent = isExpanded ? "상세 닫기" : "상세 열기";
  }
}

function handleTerminalLogToggleClick() {
  setTerminalLogExpanded(!terminalLogExpanded);
}

/** 내러티브 shell 입력 상태 플래그를 갱신한다. */
function setInputEnabled(enabled) {
  setInputEnabledState(state, enabled);
}

/** 시스템 부팅 오버레이 표시 상태 제어. */
function setSystemOverlayVisible(visible) {
  if (!elements.systemOverlay) {
    return;
  }
  elements.systemOverlay.classList.toggle("is-hidden", !visible);
}

/** 시스템 부팅 상태 텍스트 갱신. */
function setSystemStatus(text) {
  if (elements.systemStatus) {
    elements.systemStatus.textContent = text || "";
  }
}

/** 시스템 부트 로그 영역 전체 텍스트 교체. */
function setBootLogText(text) {
  if (!elements.systemBootLog) {
    return;
  }
  elements.systemBootLog.textContent = text || "";
}

/** 시스템 부트 로그에 한 줄 추가하고 하단으로 스크롤한다. */
function appendBootLine(line) {
  var current = elements.systemBootLog ? elements.systemBootLog.textContent : "";
  var next = current ? current + "\n" + line : line;
  setBootLogText(next);
  if (elements.systemBootLog) {
    elements.systemBootLog.scrollTop = elements.systemBootLog.scrollHeight;
  }
}

// ----- 경로/포맷 유틸 -----

/** 파일명에서 확장자(대문자)를 추출한다. */
function getFileExt(name) {
  var text = String(name || "");
  var dot = text.lastIndexOf(".");
  if (dot <= 0 || dot === text.length - 1) {
    return "";
  }
  return text.slice(dot + 1).toUpperCase();
}

/** 파일 목록 표시에 사용할 정수형 크기 문자열 포맷터. */
function formatFsSize(size, isDir) {
  if (isDir) {
    return "";
  }

  var value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 전송 상태 표시에 사용할 사람이 읽기 쉬운 용량 포맷터. */
function formatTransferSize(bytes) {
  var value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return value + " B";
  }
  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + " KB";
  }
  return (value / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * 상대/절대 경로를 현재 cwd 기준으로 정규화한다.
 * ".", ".." 토큰을 처리해 항상 절대 경로를 반환한다.
 */
function normalizePath(path) {
  var raw = String(path || "").trim();
  var base = state.investigationCwd || "/하이레시스";
  var parts = [];
  var tokens = [];
  var index = 0;

  if (!raw || raw === ".") {
    return base;
  }

  if (raw.indexOf("/") === 0) {
    tokens = raw.split("/");
  } else {
    tokens = (base + "/" + raw).split("/");
  }

  while (index < tokens.length) {
    var token = tokens[index];
    if (!token || token === ".") {
      index += 1;
      continue;
    }
    if (token === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      index += 1;
      continue;
    }
    parts.push(token);
    index += 1;
  }

  return "/" + parts.join("/");
}

/** 내부 path를 ftp://hyresis.local 경로로 변환한다. */
function buildFtpPath(path) {
  var normalized = normalizePath(path);
  var ftpPath = normalized.replace("/하이레시스", "") || "/";
  return "ftp://hyresis.local" + ftpPath;
}

/** 상단 pathbar에 현재 작업 모드(::transfer/preview/view)를 반영한다. */
function setTerminalPathbar(path, mode) {
  var normalized = normalizePath(path || state.investigationCwd || "/하이레시스");
  var logicalPath = normalized.replace("/하이레시스", "/archive");
  var base = "/hyresis/gateway";
  var text = base + (logicalPath || "/archive");

  if (mode === "retr") {
    text += " ::transfer";
  } else if (mode === "preview") {
    text += " ::preview";
  } else if (mode === "view") {
    text += " ::view";
  }

  if (elements.terminalPathbar) {
    elements.terminalPathbar.textContent = text;
  }
}

/** 파일 전송 진행률 막대 문자열 생성. */
function buildLoadingGauge(fill, total) {
  return "[" + "=".repeat(fill) + "-".repeat(total - fill) + "]";
}

// ----- 파일 패널 렌더링/상호작용 -----

/** 파일 리스트 행(button) DOM을 생성한다. */
function buildInvestigationRowButton(options) {
  var button = document.createElement("button");
  var nameCell = document.createElement("span");
  var extCell = document.createElement("span");
  var sizeCell = document.createElement("span");
  var dateCell = document.createElement("span");
  var timeCell = document.createElement("span");
  var typeCell = document.createElement("span");
  var type = options && options.type ? options.type : "file";
  var isDir = type === "dir";
  var meta = (options && options.meta) || {};
  var attrText = meta.attr || (isDir ? "DIR,RO" : "RO,LOG");

  button.type = "button";
  button.className = "investigation-item " + (isDir ? "item-dir" : "item-file");
  if (meta.flagged) {
    button.classList.add("item-flagged");
  }
  if (meta.locked) {
    button.classList.add("item-locked");
  }
  if (meta.recoverable) {
    button.classList.add("item-recoverable");
  }
  if (meta.blocked) {
    button.classList.add("item-blocked");
  }
  if (meta.recovered) {
    button.classList.add("item-recovered");
  }
  if (meta.mounted) {
    button.classList.add("item-mounted");
  }
  button.dataset.path = options.path || "";
  button.dataset.kind = type;
  button.dataset.locked = meta.locked ? "true" : "false";
  button.dataset.recoveryState = meta.recoverable ? "recoverable" : (meta.blocked ? "blocked" : "none");
  button.dataset.requiredTag = meta.requiredTag ? String(meta.requiredTag) : "";
  button.dataset.requiredFile = meta.requiredFile ? String(meta.requiredFile) : "";
  button.dataset.draggableRecovery = meta.recoverable ? "true" : "false";
  button.draggable = Boolean(meta.recoverable);

  nameCell.className = "investigation-cell col-name";
  nameCell.textContent = options && options.name ? options.name : "";
  extCell.className = "investigation-cell col-ext";
  extCell.textContent = options && options.ext ? options.ext : "";
  sizeCell.className = "investigation-cell col-size";
  sizeCell.textContent = formatFsSize(meta.size, isDir);
  dateCell.className = "investigation-cell col-date";
  dateCell.textContent = meta.date || "--.--.--";
  timeCell.className = "investigation-cell col-time";
  timeCell.textContent = meta.time || "--:--";
  typeCell.className = "investigation-cell col-type";
  typeCell.textContent = attrText;

  button.appendChild(nameCell);
  button.appendChild(extCell);
  button.appendChild(sizeCell);
  button.appendChild(dateCell);
  button.appendChild(timeCell);
  button.appendChild(typeCell);
  return button;
}

/** 현재 디렉터리 자식 목록을 UI 렌더링용 행 데이터로 변환한다. */
function getFsChildrenRows(cwd, entry) {
  var rows = [];
  var block0Root = BLOCK0_SPEC.rootPath;
  var block0AllFiles = Object.keys(BLOCK0_SPEC.files || {});
  var visibleSet = {};
  var hidden = [];
  var index = 0;
  var nextRecoverableFile = "";
  var questionTargetFile = "";
  var currentQuestion = null;
  var currentRequirementTag = "";
  var targetRule = null;
  var isTargetReady = false;

  if (cwd === block0Root && !state.block0Completed) {
    state.block0VisibleFiles.forEach(function markVisible(fileName) {
      visibleSet[fileName] = true;
    });

    index = 0;
    while (index < state.block0VisibleFiles.length) {
      var visibleName = state.block0VisibleFiles[index];
      var visiblePath = normalizePath(cwd + "/" + visibleName);
      var visibleEntry = LOG_FS[visiblePath];
      var visibleType = visibleEntry && visibleEntry.type === "dir" ? "dir" : "file";

      if (visibleName !== "block-1") {
      rows.push({
        name: visibleName,
        path: visiblePath,
        type: visibleType,
        ext: visibleType === "dir" ? "" : getFileExt(visibleName),
        meta: Object.assign({}, LOG_META[visiblePath] || {}, {
          recovered: true,
          attr:
            ((LOG_META[visiblePath] || {}).attr || "RO,LOG") +
            (previewFilePath === visiblePath ? ",OPENED" : ""),
        }),
      });
      }
      index += 1;
    }

    hidden = block0AllFiles.filter(function onlyLocked(fileName) {
      return !visibleSet[fileName];
    });
    questionTargetFile = getBlock0CurrentTargetFileName();
    targetRule = getBlock0UnlockRuleByFile(questionTargetFile);
    isTargetReady = isBlock0UnlockRuleSatisfied(questionTargetFile);
    nextRecoverableFile = isTargetReady ? (questionTargetFile || getNextRecoverableBlock0FileName()) : "";
    currentQuestion = getBlock0CurrentQuestion();
    currentRequirementTag = targetRule ? String(targetRule.whenTag || "") : "";
    index = 0;
    while (index < hidden.length) {
      var hiddenName = hidden[index];
      var isRecoverable = Boolean(nextRecoverableFile) && hiddenName === nextRecoverableFile;
      rows.push({
        name: hiddenName,
        path: BLOCK0_SPEC.files[hiddenName].path,
        type: "file",
        ext: getFileExt(hiddenName),
        meta: {
          date: "--.--.--",
          time: "--:--",
          attr: (isRecoverable ? "LOCK,READY" : "LOCK,BLOCKED") + (block0ActiveRecoveryFile === hiddenName ? ",MOUNTED" : ""),
          locked: true,
          recoverable: isRecoverable,
          blocked: !isRecoverable,
          mounted: block0ActiveRecoveryFile === hiddenName,
          requiredTag: isRecoverable ? currentRequirementTag : "",
          requiredFile: !isRecoverable ? questionTargetFile : "",
        },
      });
      index += 1;
    }

    if ((state.block1Started || state.block0MemoryUnlocked) && entry.children.indexOf("block-1") !== -1) {
      rows.unshift({
        name: "block-1",
        path: normalizePath(cwd + "/block-1"),
        type: "dir",
        ext: "",
        meta: Object.assign({}, LOG_META[normalizePath(cwd + "/block-1")] || {}, {
          flagged: !state.block1Started,
          attr: state.block1Started ? ((LOG_META[normalizePath(cwd + "/block-1")] || {}).attr || "DIR,RO") : "DIR,NEXT",
        }),
      });
    }
    return rows;
  }

  while (index < entry.children.length) {
    var childName = entry.children[index];
    var childPath = normalizePath(cwd + "/" + childName);
    var childEntry = LOG_FS[childPath];
    var type = childEntry && childEntry.type === "dir" ? "dir" : "file";

    rows.push({
      name: childName,
      path: childPath,
      type: type,
      ext: type === "dir" ? "" : getFileExt(childName),
      meta: LOG_META[childPath] || {},
    });

    index += 1;
  }
  // 정렬 대신 "나타난 순서"를 유지한다.
  // 복구/해금 로직이 children 배열에 push하는 순서가 곧 플레이어 체감 순서다.
  return rows;
}

/** 우측 preview buffer 텍스트/경로/라인 캐시를 갱신한다. */
function setInvestigationPreview(text, path, lines) {
  var linkedPrefix = getPuzzlePrefixForPath(path);
  var fileIndex = getPuzzleFileIndex(linkedPrefix);
  var hasLinkedContent = false;
  pinnedInvestigationPreview = null;
  previewFilePath = path || "";
  previewFileLines = Array.isArray(lines) ? lines.slice() : [];
  hasLinkedContent =
    Boolean(fileIndex[previewFilePath]) &&
    previewFileLines.length > 0 &&
    (text || "") === previewFileLines.join("\n");

  if (hasLinkedContent) {
    renderPreviewBufferWithTagLinks(previewFilePath, previewFileLines);
  } else if (elements.investigationContent) {
    elements.investigationContent.textContent = text || DEFAULT_PREVIEW_HINT;
  }
}

function renderPinnedInvestigationPreview() {
  var preview = pinnedInvestigationPreview;

  if (!preview || !elements.investigationContent) {
    return false;
  }

  previewFilePath = "";
  previewFileLines = [];
  elements.investigationContent.textContent = preview.text || DEFAULT_PREVIEW_HINT;
  return true;
}

function pinTextPreview(text) {
  pinnedInvestigationPreview = {
    type: "text",
    cwd: normalizePath(state.investigationCwd || ""),
    text: text || DEFAULT_PREVIEW_HINT,
  };
  renderPinnedInvestigationPreview();
}

/** PREVIEW BUFFER 로그 라인을 태그 링크 포함 형태로 렌더링한다. */
function renderPreviewBufferWithTagLinks(path, lines) {
  var prefix = getPuzzlePrefixForPath(path);
  renderPreviewBuffer({
    container: elements.investigationContent,
    path: path,
    lines: lines,
    fileSpecByPath: prefix === "block1" ? block1FileByPath : block0FileByPath,
    collectedTags: state[prefix + "CollectedTags"],
  });
}

/** 블록 0 진행 중 접근 제한 경로인지 검사한다. */
function isPathBlockedByBlock0(path) {
  var targetPath = normalizePath(path);
  return !state.block0Completed && targetPath.indexOf(BLOCK0_SPEC.rootPath) !== 0;
}

/** 경로 접근 가능 여부와 타입을 검증하고 FS 엔트리를 반환한다. */
function resolveFsTarget(path, options) {
  var opts = options || {};
  var targetPath = normalizePath(path);
  var entry = LOG_FS[targetPath];

  if (opts.guardBlock0 && isPathBlockedByBlock0(targetPath)) {
    logWarn(opts.blockedMessage || "access blocked");
    return null;
  }
  if (!entry) {
    logWarn((opts.notFoundMessage || "path unavailable") + ": " + buildFtpPath(targetPath));
    return null;
  }
  if (opts.expectedType && entry.type !== opts.expectedType) {
    logWarn((opts.typeMismatchMessage || "invalid type") + ": " + buildFtpPath(targetPath));
    return null;
  }

  return { path: targetPath, entry: entry };
}

/** 파일 열기 가능 조건(존재/타입/블록 잠금)을 검증한다. */
function resolveReadableFile(path) {
  var resolved = resolveFsTarget(path, {
    expectedType: "file",
    notFoundMessage: "cat: file unavailable",
  });
  var fileName = "";
  if (!resolved) {
    return null;
  }

  fileName = resolved.path.split("/").pop() || "";
  if (block0FileByPath[resolved.path] && state.block0VisibleFiles.indexOf(fileName) === -1) {
    logWarn("cat: file locked until prior tag recovery");
    return null;
  }

  return resolved;
}

/** investigation panel 렌더링에 필요한 화면 모델을 계산한다. */
function buildInvestigationPanelViewModel(message) {
  var cwd = state.investigationCwd;
  var entry = LOG_FS[cwd];
  var isStreaming = state.phase === FLOW_PHASE.STREAMING;
  var rows = [];
  var block0AllRecovered = state.block0VisibleFiles.length >= Object.keys(BLOCK0_SPEC.files || {}).length;

  if (!isStreaming) {
    return {
      mode: "detached",
      pathText: "ftp://hyresis.local/ (열람 동의 필요)",
      previewText: message || "로그인 후 파일 목록을 확인할 수 있습니다.",
    };
  }

  if (!entry || entry.type !== "dir") {
    return {
      mode: "invalid",
      pathText: buildFtpPath(cwd),
      previewText: "[FS] 현재 경로를 렌더링할 수 없습니다.",
    };
  }

  rows = getFsChildrenRows(cwd, entry);
  return {
    mode: "ready",
    pathText: buildFtpPath(cwd),
    rows: rows,
    showParentRow: cwd !== BLOCK0_SPEC.rootPath || state.block0Completed || block0AllRecovered,
    parentPath: normalizePath(cwd + "/.."),
    previewMessage: message || "",
  };
}

/** 좌측 파일 패널(헤더/목록/경로)을 현재 cwd 기준으로 재렌더링한다. */
function renderInvestigationPanel(message) {
  var vm = null;
  var rowHeader = null;
  var index = 0;
  var previewParentPath = "";
  var shouldPreservePreview = false;

  if (!elements.investigationList || !elements.investigationPath || !elements.investigationContent) {
    return;
  }

  vm = buildInvestigationPanelViewModel(message);
  elements.investigationPath.textContent = vm.pathText;
  elements.investigationList.innerHTML = "";

  if (vm.mode !== "ready") {
    setInvestigationPreview(vm.previewText, "", []);
    return;
  }

  rowHeader = document.createElement("div");
  rowHeader.className = "investigation-row-header";
  rowHeader.innerHTML =
    '<span class="investigation-cell col-name">NAME</span>' +
    '<span class="investigation-cell col-ext">EXT</span>' +
    '<span class="investigation-cell col-size">SIZE</span>' +
    '<span class="investigation-cell col-date">DATE</span>' +
    '<span class="investigation-cell col-time">TIME</span>' +
    '<span class="investigation-cell col-type">ATTR</span>';
  elements.investigationList.appendChild(rowHeader);

  if (vm.showParentRow) {
    elements.investigationList.appendChild(
      buildInvestigationRowButton({
        name: "..",
        path: vm.parentPath,
        type: "dir",
        ext: "",
        meta: { date: "--.--.--", time: "--:--", attr: "DIR" },
      })
    );
  }

  while (index < vm.rows.length) {
    elements.investigationList.appendChild(buildInvestigationRowButton(vm.rows[index]));
    index += 1;
  }

  previewParentPath = previewFilePath ? normalizePath(previewFilePath + "/..") : "";
  shouldPreservePreview =
    Boolean(previewFilePath) &&
    previewFileLines.length > 0 &&
    previewParentPath === normalizePath(state.investigationCwd || "");
  if (shouldPreservePreview) {
    setInvestigationPreview(previewFileLines.join("\n"), previewFilePath, previewFileLines);
    return;
  }
  if (pinnedInvestigationPreview && pinnedInvestigationPreview.cwd === normalizePath(state.investigationCwd || "")) {
    renderPinnedInvestigationPreview();
    return;
  }
  setInvestigationPreview(DEFAULT_PREVIEW_HINT, "", []);
}

/** 리스트 항목 선택/로딩/열림 상태 클래스를 초기화한다. */
function clearInvestigationRowStates() {
  if (!elements.investigationList) {
    return;
  }

  var rows = elements.investigationList.querySelectorAll(".investigation-item");
  var index = 0;
  while (index < rows.length) {
    rows[index].classList.remove("is-selected", "is-loading", "is-opened");
    index += 1;
  }
}

/** 클릭된 항목에 로딩 상태를 표시한다. */
function markInvestigationRowLoading(rowButton, loading) {
  if (!rowButton || !rowButton.classList) {
    return;
  }

  clearInvestigationRowStates();
  rowButton.classList.add("is-selected");
  rowButton.classList.toggle("is-loading", Boolean(loading));
}

/** 지정 path에 대응되는 행을 opened 상태로 마킹한다. */
function markInvestigationRowOpenedByPath(path) {
  if (!elements.investigationList) {
    return;
  }

  var selector = '.investigation-item[data-path="' + normalizePath(path) + '"]';
  var rowButton = elements.investigationList.querySelector(selector);
  if (!rowButton) {
    return;
  }

  clearInvestigationRowStates();
  rowButton.classList.add("is-selected", "is-opened");
}

/** 파일 패널 항목 클릭 처리(dir -> cd, file -> cat). */
function handleInvestigationItemClick(clickEvent) {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }

  var target = clickEvent.target ? clickEvent.target.closest(".investigation-item") : null;
  if (!target || !target.dataset || !target.dataset.path) {
    return;
  }
  if (investigationReadOnlyLock) {
    markInvestigationRowLoading(target, false);
    return;
  }

  var path = target.dataset.path;
  var kind = target.dataset.kind || "";
  var isLocked = target.dataset.locked === "true";
  var recoveryState = target.dataset.recoveryState || "none";
  var requiredTag = String(target.dataset.requiredTag || "");
  var requiredFile = String(target.dataset.requiredFile || "");
  var fileName = path.split("/").pop() || "대상 파일";
  if (isLocked) {
    markInvestigationRowLoading(target, false);
    if (recoveryState === "recoverable") {
      return;
    }
    clearBlock0RecoveryArm();
    block0DraggedRecoveryFile = "";
    logWarn("복구 불가: " + (requiredFile || "선행 조각") + " 확인 필요");
    return;
  }
  markInvestigationRowLoading(target, kind === "file");

  if (kind === "dir") {
    clearBlock0RecoveryArm();
    block0DraggedRecoveryFile = "";
    if (normalizePath(path) === BLOCK1_SPEC.rootPath && state.block0MemoryUnlocked && !state.block1Started) {
      startBlock1FromMemory();
      return;
    }
    changeDirectory(path);
    return;
  }

  if (kind === "file") {
    clearBlock0RecoveryArm();
    block0DraggedRecoveryFile = "";
    readFile(path);
  }
}

function handleInvestigationItemDragStart(dragEvent) {
  var target = dragEvent.target ? dragEvent.target.closest(".investigation-item") : null;
  var fileName = "";
  var requiredTag = "";
  var currentQuestion = null;

  if (!target || target.dataset.draggableRecovery !== "true" || target.dataset.recoveryState !== "recoverable") {
    if (dragEvent.preventDefault) {
      dragEvent.preventDefault();
    }
    return;
  }

  fileName = String(target.dataset.path || "").split("/").pop() || "대상 파일";
  requiredTag = String(target.dataset.requiredTag || "");
  currentQuestion = getBlock0CurrentQuestion();
  armBlock0Recovery(fileName, requiredTag, currentQuestion ? String(currentQuestion.prompt || "") : "");
  block0DraggedRecoveryFile = fileName;
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/plain", fileName);
  }
  if (elements.block0ActionCard) {
    elements.block0ActionCard.classList.add("is-drop-target");
  }
  touchPuzzleActivity("block0");
  renderBlock0Panel();
}

function handleInvestigationItemDragEnd() {
  block0DraggedRecoveryFile = "";
  if (!state.block0ClauseVisible) {
    clearBlock0RecoveryArm();
  }
  if (elements.block0ActionCard) {
    elements.block0ActionCard.classList.remove("is-drop-target", "is-drop-active");
  }
  renderBlock0Panel();
}

/** ls 구현: 디렉터리 내용을 터미널에 출력하고 패널을 갱신한다. */
function listFs(path) {
  var resolved = resolveFsTarget(path, {
    guardBlock0: true,
    blockedMessage: "access denied outside /복구됨 during block 0",
    expectedType: "dir",
    notFoundMessage: "path unavailable",
    typeMismatchMessage: "not a directory",
  });
  var targetPath = "";
  var entry = null;
  var index = 0;
  if (!resolved) {
    return;
  }

  targetPath = resolved.path;
  entry = resolved.entry;
  logSystem("ls -> " + buildFtpPath(targetPath));
  while (index < entry.children.length) {
    logInfo("  " + entry.children[index]);
    index += 1;
  }

  renderInvestigationPanel();
}

/** cd 구현: cwd를 변경하고 pathbar/패널을 동기화한다. */
function changeDirectory(path) {
  var resolved = resolveFsTarget(path, {
    guardBlock0: true,
    blockedMessage: "cd blocked: block 0 is locked to /복구됨",
    expectedType: "dir",
    notFoundMessage: "cd: no such directory",
    typeMismatchMessage: "cd: no such directory",
  });
  if (!resolved) {
    return;
  }

  setInvestigationCwdState(state, resolved.path);
  logSystem("cwd -> " + buildFtpPath(state.investigationCwd));
  setTerminalPathbar(resolved.path);
  renderInvestigationPanel();
  clearInvestigationRowStates();
}

/**
 * cat 전송 연출.
 * 진행률/속도를 표시한 뒤 완료 콜백에서 preview buffer를 갱신한다.
 */
function startRemoteFileTransfer(targetPath, entry, done) {
  var body = entry && Array.isArray(entry.content) ? entry.content.join("\n") : "";
  var meta = LOG_META[targetPath] || {};
  var totalBytes = Number(meta.size || 0);
  var total = totalBytes > 0 ? totalBytes : Math.max(512, body.length * 3);
  var ticks = 10;
  var step = 0;
  var jobId = fileTransferJob + 1;

  fileTransferJob = jobId;
  emitStateEvent(RUNTIME_TRANSITION_EVENT.TRANSFER_STARTED, null, {
    targetPath: targetPath,
    totalBytes: total,
    jobId: jobId,
  });
  setTerminalPathbar(targetPath, "retr");
  setInvestigationPreview(
    "retr " + buildFtpPath(targetPath) + "\nsize " + formatTransferSize(total) + "\nwaiting...",
    "",
    []
  );
  logSystem("파일 수신 시작: " + (targetPath.split("/").pop() || targetPath));

  function tick() {
    var downloaded = 0;
    var percent = 0;
    var speed = 0;

    if (fileTransferJob !== jobId) {
      return;
    }

    step += 1;
    downloaded = Math.min(total, Math.floor((total * step) / ticks));
    percent = Math.floor((downloaded / total) * 100);
    speed = getSimulationRandomInt(72, 155);
    emitStateEvent(RUNTIME_TRANSITION_EVENT.TRANSFER_TICK, null, {
      targetPath: targetPath,
      jobId: jobId,
      percent: percent,
      downloaded: downloaded,
      speedKbPerSec: speed,
    });

    if (elements.investigationContent) {
      elements.investigationContent.textContent =
        "retr " + buildFtpPath(targetPath) + "\n" +
        "size " + formatTransferSize(total) + "\n" +
        buildLoadingGauge(Math.min(step, ticks), ticks) + " " + percent + "%\n" +
        "rate " + speed + " KB/s";
    }

    if (step >= ticks) {
      logSuccess("파일 수신 완료: " + (targetPath.split("/").pop() || targetPath));
      emitStateEvent(RUNTIME_TRANSITION_EVENT.TRANSFER_COMPLETED, null, {
        targetPath: targetPath,
        totalBytes: total,
        jobId: jobId,
      });
      if (typeof done === "function") {
        done();
      }
      return;
    }

    scheduleRuntimeTimeout(tick, getSimulationRandomInt(90, 169), "file-transfer-tick");
  }

  scheduleRuntimeTimeout(tick, 120, "file-transfer-start");
}

/** cat 공통 파일 로드: 경로 검증 후 전송 연출 시작. */
function readFile(path) {
  var resolved = resolveReadableFile(path);
  if (!resolved) {
    return;
  }

  var targetPath = resolved.path;
  var entry = resolved.entry;
  startRemoteFileTransfer(targetPath, entry, function onTransferComplete() {
    setTerminalPathbar(targetPath, "preview");
    setInvestigationPreview(entry.content.join("\n"), targetPath, entry.content);
    setBlock0ContextFile(targetPath);
    renderBlock0Panel();
    markInvestigationRowOpenedByPath(targetPath);
    onBlock0FileOpened(targetPath);
    onBlock1FileOpened(targetPath);
  });
}

// ----- 복구 블록 0 -----

/** 플레이어 활동 발생 시 idle 힌트 타이머를 갱신한다. */
function touchBlock0Activity() {
  touchPuzzleActivity("block0");
}

/** 블록 0 패널 상태(무결성/태그 수/슬롯/기억카드)를 렌더링한다. */
function buildBlock0PanelViewModel() {
  var prefix = getActivePuzzlePrefix();
  var spec = getPuzzleSpec(prefix);
  var questions = getPuzzleQuestions(prefix);
  var totalQuestions = questions.length;
  var currentQuestion = getPuzzleCurrentQuestion(prefix);
  var patchTarget = getBlock0PatchTargetPresentation(currentQuestion);
  var currentAnswer = currentQuestion ? String(currentQuestion.answer || "") : "";
  var solvedAnswers = state[prefix + "SolvedAnswers"];
  var collectedTags = state[prefix + "CollectedTags"];
  var currentPurpose = state[prefix + "PurposeValue"] || "";
  var solvedCount = Array.isArray(solvedAnswers) ? solvedAnswers.length : 0;
  var fusionNeededTypes = block0FusionDraft.expectedTypes.filter(function pickNeeded(_, idx) {
    return !block0FusionDraft.args[idx];
  });
  var fusionSlots = block0FusionDraft.expectedTypes.map(function toSlot(expectedType, idx) {
    return {
      index: idx,
      expectedType: expectedType,
      value: block0FusionDraft.args[idx] || "",
      expecting: !block0FusionDraft.args[idx],
    };
  });
  var tags = collectedTags.map(function toTagView(tag, tagIndex) {
    var type = getTagVisualType(tag, TAG_CATEGORY_MAP);
    var tagHead = String(tag || "").split("(")[0];
    var signature = TAG_COMPOSITION_SIGNATURES[tagHead];
    var isNeeded = fusionNeededTypes.indexOf(type) !== -1;
    return {
      tag: tag,
      index: tagIndex,
      type: type,
      signature: Array.isArray(signature) ? signature : [],
      isFusionNeeded: block0FusionDraft.operator && isNeeded,
      isFusionDim: block0FusionDraft.operator && !isNeeded && tag !== block0FusionDraft.operator,
    };
  });
  var isBlock0 = prefix === "block0";
  var activeRecoveryFile = getPuzzleCurrentRecoveryFile(prefix);
  var blockTitle = spec.title || (isBlock0 ? "복구 블록 0" : "복구 블록");
  var action = buildWorkbenchActionViewModel(prefix);
  return {
    statusText:
      blockTitle + " · integrity " + state[prefix + "Integrity"] + "% · linked " + collectedTags.length +
      (isBlock0 && block0AnswerRecoveryActive ? " · pipeline active" : ""),
    action: action,
    tags: tags,
    recipeHtml: buildBlock0HintPanelHtml(),
    clauseTitle: (((spec.clause || {}).title || spec.title || "repair clause")) + (activeRecoveryFile ? (" · " + activeRecoveryFile) : ""),
    clauseTargetBadge: currentQuestion ? patchTarget.badgeText : "완료",
    clauseVisible: state[prefix + "ClauseVisible"],
    clauseGoalReady: state[prefix + "ClauseVisible"] && !state[prefix + "Completed"] && Boolean(currentAnswer) && collectedTags.indexOf(currentAnswer) !== -1,
    clauseCompleted: state[prefix + "Completed"],
    purposeLabel: currentQuestion ? patchTarget.expressionText : (spec.title + " 복구 완료"),
    purposeValue: currentPurpose,
    purposeMatch: Boolean(currentPurpose) && Boolean(currentAnswer) && currentPurpose === currentAnswer,
    fusion: {
      operator: block0FusionDraft.operator,
      slots: fusionSlots,
      active: Boolean(block0FusionDraft.operator),
    },
  };
}

function renderBlock0Panel() {
  var vm = buildBlock0PanelViewModel();

  if (elements.block0Status) {
    elements.block0Status.textContent = vm.statusText;
  }
  if (elements.block0ActionCard) {
    elements.block0ActionCard.classList.remove("is-ready", "is-processing", "is-warning", "is-resolved");
    if (vm.action && vm.action.toneClass) {
      elements.block0ActionCard.classList.add(vm.action.toneClass);
    }
    elements.block0ActionCard.classList.toggle("is-hidden", Boolean(vm.action && vm.action.isHidden));
    elements.block0ActionCard.classList.toggle(
      "is-drop-target",
      Boolean(getActivePuzzlePrefix() === "block0" && !state.block0ClauseVisible && isBlock0UnlockRuleSatisfied(getBlock0CurrentTargetFileName()))
    );
  }
  if (elements.block0ActionState) {
    elements.block0ActionState.textContent = vm.action ? vm.action.stateLabel : "";
  }
  if (elements.block0ActionTitle) {
    elements.block0ActionTitle.textContent = vm.action ? vm.action.title : "";
  }
  if (elements.block0ActionBody) {
    elements.block0ActionBody.textContent = vm.action ? vm.action.body : "";
    elements.block0ActionBody.classList.toggle("is-hidden", !(vm.action && vm.action.body));
  }
  if (elements.block0ActionButton) {
    elements.block0ActionButton.textContent = vm.action && vm.action.ctaLabel ? vm.action.ctaLabel : "";
    elements.block0ActionButton.dataset.action = vm.action && vm.action.ctaAction ? vm.action.ctaAction : "";
    elements.block0ActionButton.classList.toggle("is-hidden", !(vm.action && vm.action.ctaLabel));
  }
  if (elements.block0Progress) {
    elements.block0Progress.classList.toggle("is-hidden", !(vm.action && vm.action.progressLabel));
  }
  if (elements.block0ProgressFill) {
    elements.block0ProgressFill.style.width = ((vm.action && vm.action.progressValue ? vm.action.progressValue : 0) * 100) + "%";
  }
  if (elements.block0ProgressLabel) {
    elements.block0ProgressLabel.textContent = vm.action && vm.action.progressLabel ? vm.action.progressLabel : "";
  }
  if (elements.block0TagInventory) {
    elements.block0TagInventory.innerHTML = "";
    if (vm.tags.length === 0) {
      elements.block0TagInventory.textContent = "획득한 조각이 없습니다.";
    } else {
      vm.tags.forEach(function renderTag(tagView) {
        var chip = document.createElement("button");
        var labelSpan = document.createElement("span");
        var hintSpan = document.createElement("span");
        chip.type = "button";
        chip.className = "block0-tag-btn collected";
        chip.dataset.tag = tagView.tag;
        chip.dataset.index = String(tagView.index);
        chip.dataset.type = tagView.type;
        chip.classList.add("tag-cat-" + tagView.type);
        chip.classList.toggle("is-fusion-operator", tagView.signature.length > 0);
        chip.classList.toggle("is-fusion-needed", Boolean(tagView.isFusionNeeded));
        chip.classList.toggle("is-fusion-dim", Boolean(tagView.isFusionDim));
        chip.title = "분류";
        chip.draggable = true;
        labelSpan.className = "tag-label";
        labelSpan.textContent = tagView.tag;
        chip.appendChild(labelSpan);
        if (tagView.signature.length > 0) {
          tagView.signature.forEach(function appendArgHint(expectedType) {
            var dot = document.createElement("span");
            dot.className = "tag-arg-dot type-" + expectedType;
            dot.textContent = "·";
            hintSpan.appendChild(dot);
          });
          hintSpan.className = "tag-arg-hint tag-fusion-zone";
          chip.appendChild(hintSpan);
        }
        elements.block0TagInventory.appendChild(chip);
      });
    }
  }
  if (elements.block0FusionDock) {
    var fusion = vm.fusion;
    var slotHtml = fusion.slots.map(function toSlotHtml(slot) {
      var baseClass = "block0-tag-slot block0-fusion-slot";
      var slotLabel = "인자-" + (slot.index + 1);
      if (slot.value) {
        baseClass += " filled";
      } else if (slot.expecting) {
        baseClass += " expecting";
      }
      return (
        '<button type="button" class="' + baseClass + '" data-index="' + slot.index + '">' +
        (slot.value || "[     ]") +
        '<span class="slot-type">' + slotLabel + " · " + slot.expectedType + "</span>" +
        "</button>"
      );
    }).join("");
    var operatorText = fusion.operator ? fusion.operator : "[연산자 조각 배치]";
    var operatorClass = "block0-tag-slot block0-fusion-slot operator" + (fusion.operator ? " filled" : " expecting");
    elements.block0FusionDock.innerHTML =
      '<div class="block0-fusion-help-row">' +
      '<div class="block0-fusion-help-wrap">' +
      '<button type="button" class="block0-fusion-help" aria-label="조합 안내">?</button>' +
      '<div class="block0-fusion-tooltip" role="tooltip">연산자 조각을 먼저 놓고, 맞는 조각을 순서대로 채우면 결과 조각이 생성됩니다.</div>' +
      "</div>" +
      "</div>" +
      '<div class="block0-fusion-slots">' +
      '<button type="button" class="' + operatorClass + '" data-role="operator">' + operatorText + "</button>" +
      slotHtml +
      "</div>";
  }
  if (elements.block0RecipeList) {
    elements.block0RecipeList.innerHTML = vm.recipeHtml;
  }
  if (elements.block0ClausePanel) {
    elements.block0ClausePanel.classList.toggle("is-hidden", !vm.clauseVisible);
    elements.block0ClausePanel.classList.toggle("is-goal-ready", vm.clauseGoalReady);
    elements.block0ClausePanel.classList.toggle("is-goal-complete", vm.clauseCompleted);
  }
  if (elements.block0HintTitle) {
    elements.block0HintTitle.classList.toggle("is-hidden", !vm.clauseVisible);
  }
  if (elements.block0HintGuide) {
    elements.block0HintGuide.classList.toggle("is-hidden", !vm.clauseVisible);
  }
  if (elements.block0ClauseTitle) {
    elements.block0ClauseTitle.textContent = vm.clauseTitle;
  }
  if (elements.block0TargetBadge) {
    elements.block0TargetBadge.textContent = vm.clauseTargetBadge;
  }
  if (elements.block0PurposeLabel) {
    elements.block0PurposeLabel.textContent = vm.purposeLabel;
  }
  if (elements.block0PurposeSlot) {
    elements.block0PurposeSlot.disabled = block0AnswerRecoveryActive;
    if (!vm.purposeValue) {
      elements.block0PurposeSlot.textContent = "[태그를 드롭]";
      elements.block0PurposeSlot.classList.remove("filled");
      elements.block0PurposeSlot.classList.remove("mismatch");
      elements.block0PurposeSlot.classList.add("expecting");
    } else {
      elements.block0PurposeSlot.textContent = "[" + vm.purposeValue + "]";
      elements.block0PurposeSlot.classList.add("filled");
      elements.block0PurposeSlot.classList.remove("expecting");
      elements.block0PurposeSlot.classList.toggle("mismatch", !vm.purposeMatch);
    }
  }
}

/** 기억 조각 팝업 표시/숨김. */
function setBlock0MemoryModalVisible(visible) {
  if (elements.block0MemoryModal) {
    elements.block0MemoryModal.classList.toggle("is-hidden", !visible);
  }
  if (visible && elements.block0MemoryModalText) {
    elements.block0MemoryModalText.textContent = BLOCK0_SPEC.memory.popupText || BLOCK0_SPEC.memory.text;
  }
  if (elements.block0MemoryModalNext) {
    elements.block0MemoryModalNext.disabled = state.block1Started;
    elements.block0MemoryModalNext.textContent = state.block1Started ? "다음 복구 진행 중" : "다음 복구 열기";
  }
}

/** 복구 대상 카드에 단발성 강조 애니메이션을 적용한다. */
function pulseBlock0Clause(className) {
  if (!elements.block0ClausePanel || !className) {
    return;
  }
  if (block0ClausePulseTimer) {
    clearRuntimeTimer(block0ClausePulseTimer);
    block0ClausePulseTimer = 0;
  }
  elements.block0ClausePanel.classList.remove("is-goal-alert", "is-goal-clear");
  elements.block0ClausePanel.classList.add(className);
  block0ClausePulseTimer = scheduleRuntimeTimeout(function clearPulseClass() {
    if (!elements.block0ClausePanel) {
      return;
    }
    elements.block0ClausePanel.classList.remove(className);
    block0ClausePulseTimer = 0;
  }, 720, "clause-pulse-clear");
}

function setRuntimeFsUnlockedEvent(fileName) {
  emitStateEvent("fs.file_unlocked", null, {
    prefix: "block0",
    fileName: String(fileName || ""),
  });
}

/** 지정 파일이 새로 해금되면 목록 동기화 + 강조 애니메이션을 적용한다. */
function unlockBlock0File(fileName, panelMessage, logText, tone) {
  var detailLog = String(logText || "").trim();
  var detailTone = tone || "log-success";
  void panelMessage;
  if (state.block0VisibleFiles.indexOf(fileName) !== -1) {
    return;
  }
  stampBlock0RecoveredFile(fileName);
  prependRecoveredFile(state.block0VisibleFiles, fileName);
  syncBlock0Fs();
  renderInvestigationPanel();
  if (detailLog) {
    logRecoveryEvent(detailLog, detailTone);
  } else {
    logRecoveryEvent("archive entry restored: " + fileName, detailTone);
  }
  setRuntimeFsUnlockedEvent(fileName);
  scheduleRuntimeTimeout(function markUnlockedRow() {
    if (!elements.investigationList) {
      return;
    }
    var row = elements.investigationList.querySelector('.investigation-item[data-path="' + BLOCK0_SPEC.files[fileName].path + '"]');
    if (!row) {
      return;
    }
    row.classList.add("is-unlocked");
    scheduleRuntimeTimeout(function clearUnlockPulse() {
      row.classList.remove("is-unlocked");
    }, 1400, "unlock-row-clear");
  }, 40, "unlock-row-mark");
}

/** 패치 적용 전 검증/재조립 파이프라인을 실행한다. */
function runBlock0AnswerRecoveryPipeline(currentQuestion, done) {
  var jobId = block0AnswerRecoveryJob + 1;
  var questionId = currentQuestion && currentQuestion.id ? currentQuestion.id : "Q0";
  var recoverFile = getBlock0CurrentTargetFileName() || getNextRecoverableBlock0FileName();
  var finish = function finishPipeline() {
    if (jobId !== block0AnswerRecoveryJob) {
      return;
    }
    block0AnswerRecoveryActive = false;
    setBlock0PipelineStage("", 0);
    syncInvestigationReadOnlyState();
    renderBlock0Panel();
    if (typeof done === "function") {
      done();
    }
  };

  block0AnswerRecoveryJob = jobId;
  block0AnswerRecoveryActive = true;
  setBlock0PipelineStage("무결성 검사", 0.2);
  syncInvestigationReadOnlyState();
  renderBlock0Panel();
  renderInvestigationPanel();

  scheduleBlockLifecycleTimer(function runHashlineCheck() {
    if (jobId !== block0AnswerRecoveryJob) {
      return;
    }
    setBlock0PipelineStage("무결성 검사", 0.34);
    renderBlock0Panel();
  }, 240);

  scheduleBlockLifecycleTimer(function runRuleCheck() {
    if (jobId !== block0AnswerRecoveryJob) {
      return;
    }
    setBlock0PipelineStage("규칙 충돌 검사", 0.68);
    renderBlock0Panel();
  }, 920);

  scheduleBlockLifecycleTimer(function runRebuild() {
    if (jobId !== block0AnswerRecoveryJob) {
      return;
    }
    setBlock0PipelineStage("패치 반영", 1);
    renderBlock0Panel();
    if (recoverFile) {
      unlockBlock0File(recoverFile, "패치 재조립: " + recoverFile);
    } else {
      renderInvestigationPanel();
    }
  }, 1580);
  scheduleBlockLifecycleTimer(function finishRecoveryPipeline() {
    flushRecoveryShellDigest();
    finish();
  }, 1940);
}

/** 태그 획득 시 해금 규칙 적용과 UI 갱신을 처리한다. */
function collectBlock0Tag(selectedTag, rewardTag, prefix) {
  var targetPrefix = prefix || getActivePuzzlePrefix();
  var tagToCollect = rewardTag || selectedTag;
  var collectedTags = state[targetPrefix + "CollectedTags"];
  var isNewTag = collectedTags.indexOf(tagToCollect) === -1;
  setBlock0ContextTag(tagToCollect);
  if (isNewTag) {
    collectedTags.push(tagToCollect);
    logSuccess("조각 연결: " + tagToCollect);
  }

  if (!isNewTag) {
    renderBlock0Panel();
    renderInvestigationPanel();
    touchPuzzleActivity(targetPrefix);
    return;
  }

  if (targetPrefix === "block0" && block0Lifecycle) {
    block0Lifecycle.onTagCollected(tagToCollect);
  }

  renderBlock0Panel();
  renderInvestigationPanel();
  touchPuzzleActivity(targetPrefix);
}

/** 재료 배열로 합성 결과를 계산한다(명시 레시피 -> 타입 기반 순). */
function resolveBlock0Synthesis(selected) {
  var spec = getPuzzleSpec(getActivePuzzlePrefix());
  var rules = Array.isArray(spec.synthesisRules) ? spec.synthesisRules : [];
  var i = 0;

  while (i < rules.length) {
    var required = Array.isArray(rules[i].whenAll) ? rules[i].whenAll : [];
    if (required.length === selected.length && required.every(function hasReq(tag) { return selected.indexOf(tag) !== -1; })) {
      return {
        resultTag: rules[i].result,
        recipeText: rules[i].whenAll.join(" + ") + " -> " + rules[i].result,
      };
    }
    i += 1;
  }

  return runTypeDrivenSynthesis(selected, TAG_COMPOSITION_SIGNATURES, TAG_CATEGORY_MAP);
}

/**
 * 합성 성공 후 공통 후처리.
 * 이 함수가 성공 플로우의 단일 경로이므로,
 * 향후 연출/통계/트래킹은 여기서 추가하면 된다.
 */
function applyBlock0SynthesisResult(synthesisResult) {
  var prefix = getActivePuzzlePrefix();
  if (!synthesisResult || !synthesisResult.resultTag) {
    return;
  }
  if (synthesisResult.recipeText && state[prefix + "DiscoveredRecipes"].indexOf(synthesisResult.recipeText) === -1) {
    pushDiscoveredRecipe(state, prefix, synthesisResult.recipeText);
    logSuccess("조합 생성: " + synthesisResult.recipeText);
  }
  collectBlock0Tag(synthesisResult.resultTag, synthesisResult.resultTag, prefix);
  renderBlock0Panel();
}

function clearBlock0FusionSlotHoverState() {
  if (!elements.block0FusionDock) {
    return;
  }
  var hovered = elements.block0FusionDock.querySelectorAll(".block0-fusion-slot.is-drop-hover");
  var idx = 0;
  while (idx < hovered.length) {
    hovered[idx].classList.remove("is-drop-hover");
    idx += 1;
  }
}

function finalizeBlock0DragOperation() {
  if (elements.block0PurposeSlot) {
    elements.block0PurposeSlot.classList.remove("is-drop-hover");
  }
  block0DraggedTag = "";
  block0DraggedTagIndex = -1;
  setFusionDockDragState("");
  syncInvestigationReadOnlyState();
  if (!elements.block0TagInventory) {
    return;
  }
  var dragging = elements.block0TagInventory.querySelectorAll(".is-dragging, .is-fusion-hover, .is-reorder-hover");
  var index = 0;
  while (index < dragging.length) {
    dragging[index].classList.remove("is-dragging");
    dragging[index].classList.remove("is-fusion-hover");
    dragging[index].classList.remove("is-reorder-hover");
    index += 1;
  }
  clearBlock0FusionSlotHoverState();
}

/** 인벤토리 태그 drag 시작. */
function handleBlock0InventoryDragStart(dragEvent) {
  var target = dragEvent.target ? dragEvent.target.closest(".block0-tag-btn.collected") : null;
  var sourceTag = "";
  var sourceIdx = -1;
  if (!target || !target.dataset) {
    return;
  }
  if (block0AnswerRecoveryActive) {
    return;
  }

  sourceTag = String(target.dataset.tag || "");
  sourceIdx = Number(target.dataset.index || -1);
  setBlock0ContextTag(sourceTag);
  block0DraggedTag = sourceTag;
  block0DraggedTagIndex = Number.isInteger(sourceIdx) ? sourceIdx : -1;
  if (!block0DraggedTag) {
    return;
  }

  syncInvestigationReadOnlyState();
  markBlock0DragHint(state);

  setFusionDockDragState(block0DraggedTag);
  target.classList.add("is-dragging");
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = "copyMove";
    dragEvent.dataTransfer.setData("text/plain", block0DraggedTag);
  }
}

/** 인벤토리 태그 위 drop을 허용한다. */
function handleBlock0InventoryDragOver(dragEvent) {
  var target = dragEvent.target ? dragEvent.target.closest(".block0-tag-btn.collected") : null;
  var inventory = elements.block0TagInventory;
  if (!target || !block0DraggedTag) {
    if (inventory && block0DraggedTag) {
      dragEvent.preventDefault();
    }
    return;
  }
  dragEvent.preventDefault();
  target.classList.add("is-reorder-hover");
  target.classList.remove("is-fusion-hover");
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = "move";
  }
}

/** 인벤토리 드롭은 위치 이동(정렬)만 처리한다. */
function handleBlock0InventoryDrop(dragEvent) {
  var prefix = getActivePuzzlePrefix();
  var collectedTags = state[prefix + "CollectedTags"];
  var target = dragEvent.target ? dragEvent.target.closest(".block0-tag-btn.collected") : null;
  var sourceIdx = block0DraggedTagIndex;
  var targetIdx = -1;
  var movedTag = "";
  var insertIdx = -1;

  if (!Number.isInteger(sourceIdx) || sourceIdx < 0 || sourceIdx >= collectedTags.length) {
    return;
  }
  if (block0AnswerRecoveryActive) {
    return;
  }
  dragEvent.preventDefault();

  if (!target || !target.dataset) {
    if (collectedTags.length <= 1) {
      return;
    }
    movedTag = collectedTags.splice(sourceIdx, 1)[0] || "";
    if (movedTag) {
      collectedTags.push(movedTag);
      renderBlock0Panel();
      touchPuzzleActivity(prefix);
      finalizeBlock0DragOperation();
    }
    return;
  }

  targetIdx = Number(target.dataset.index || -1);
  if (!Number.isInteger(targetIdx) || targetIdx < 0 || targetIdx >= collectedTags.length || targetIdx === sourceIdx) {
    return;
  }

  movedTag = collectedTags.splice(sourceIdx, 1)[0] || "";
  if (!movedTag) {
    return;
  }
  insertIdx = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx;
  collectedTags.splice(Math.max(0, insertIdx), 0, movedTag);
  renderBlock0Panel();
  touchPuzzleActivity(prefix);
  finalizeBlock0DragOperation();
}

/** 합성 도크 드롭은 연산자 설정/인자 채움(자동 합성)만 처리한다. */
function handleBlock0FusionDockDrop(dragEvent) {
  var operatorSlot = dragEvent.target ? dragEvent.target.closest(".block0-fusion-slot[data-role='operator']") : null;
  var slot = dragEvent.target ? dragEvent.target.closest(".block0-fusion-slot[data-index]") : null;
  var slotIndex = slot ? Number(slot.dataset.index || -1) : -1;
  if (!block0DraggedTag) {
    return;
  }
  if (block0AnswerRecoveryActive) {
    return;
  }
  dragEvent.preventDefault();
  clearBlock0FusionSlotHoverState();

  if (!block0FusionDraft.operator || operatorSlot) {
    if (!startBlock0FusionDraft(block0DraggedTag)) {
      logWarn("연산자 조각을 조합 영역에 먼저 놓으세요.");
      return;
    }
    renderBlock0Panel();
    touchPuzzleActivity(getActivePuzzlePrefix());
    finalizeBlock0DragOperation();
    return;
  }

  if (!tryApplyFusionTag(block0DraggedTag, Number.isInteger(slotIndex) ? slotIndex : -1)) {
    logWarn("요구되는 조각 타입과 일치하지 않습니다.");
    return;
  }
  touchPuzzleActivity(getActivePuzzlePrefix());
  finalizeBlock0DragOperation();
}

function handleBlock0FusionDockDragOver(dragEvent) {
  var hoveredSlot = null;
  if (!block0DraggedTag || block0AnswerRecoveryActive) {
    return;
  }
  dragEvent.preventDefault();
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = "copy";
  }
  clearBlock0FusionSlotHoverState();
  hoveredSlot = dragEvent.target ? dragEvent.target.closest(".block0-fusion-slot") : null;
  if (hoveredSlot) {
    hoveredSlot.classList.add("is-drop-hover");
  }
}

function handleBlock0FusionDockClick(clickEvent) {
  var role = clickEvent.target ? clickEvent.target.closest(".block0-fusion-slot[data-role]") : null;
  var slot = clickEvent.target ? clickEvent.target.closest(".block0-fusion-slot[data-index]") : null;
  var slotIndex = slot ? Number(slot.dataset.index || -1) : -1;
  if (block0AnswerRecoveryActive) {
    return;
  }

  if (role && role.dataset.role === "operator") {
    if (block0FusionDraft.operator) {
      resetBlock0FusionDraft();
      renderBlock0Panel();
      setFusionDockDragState(block0DraggedTag);
      touchPuzzleActivity(getActivePuzzlePrefix());
    }
    clearBlock0FusionSlotHoverState();
    return;
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= block0FusionDraft.args.length) {
    return;
  }
  if (!block0FusionDraft.args[slotIndex]) {
    return;
  }
  block0FusionDraft.args[slotIndex] = "";
  clearBlock0FusionSlotHoverState();
  renderBlock0Panel();
  setFusionDockDragState(block0DraggedTag);
  touchPuzzleActivity(getActivePuzzlePrefix());
}

/** drag 종료 시 임시 상태를 정리한다. */
function handleBlock0InventoryDragEnd() {
  finalizeBlock0DragOperation();
}

/** 목적 슬롯 dragover 처리. */
function handleBlock0PurposeSlotDragOver(dragEvent) {
  if (!elements.block0PurposeSlot || elements.block0PurposeSlot.disabled || block0AnswerRecoveryActive) {
    return;
  }
  dragEvent.preventDefault();
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = "copy";
  }
  elements.block0PurposeSlot.classList.add("is-drop-hover");
}

/**
 * 목적 슬롯 drop 처리.
 * 오답도 슬롯에 들어갈 수 있게 허용하고, 즉시 불일치 피드백을 출력한다.
 * 퍼즐 UX상 "시도 -> 피드백"을 보장하기 위한 의도적 설계다.
 */
function handleBlock0PurposeSlotDrop(dragEvent) {
  var prefix = getActivePuzzlePrefix();
  var currentQuestion = getPuzzleCurrentQuestion(prefix);
  var expectedAnswer = currentQuestion ? String(currentQuestion.answer || "") : "";
  var droppedTag = "";
  if (!state[prefix + "ClauseVisible"] || state[prefix + "Completed"] || block0AnswerRecoveryActive) {
    return;
  }
  dragEvent.preventDefault();
  droppedTag = block0DraggedTag;
  finalizeBlock0DragOperation();
  if (!block0DraggedTag) {
    if (!droppedTag) {
      return;
    }
  }

  if (prefix === "block0") {
    setBlock0Purpose(droppedTag);
  } else {
    setPuzzlePurposeValue(state, prefix, droppedTag);
  }
  renderBlock0Panel();
  touchPuzzleActivity(prefix);
  if (currentQuestion && expectedAnswer && state[prefix + "PurposeValue"] === expectedAnswer) {
    handleBlock0ExecuteClick();
  }
}

/** 블록 0 파일 열람 이벤트 처리. */
function onBlock0FileOpened(path) {
  if (!block0FileByPath[path]) {
    return;
  }
  if (block0Lifecycle) {
    block0Lifecycle.onFileOpened(path);
  }
}

/** 기억 조각 팝업 내 다음 복구 버튼 클릭 처리. */
function handleBlock0MemoryModalNextClick() {
  if (!state.block0MemoryUnlocked || state.block1Started) {
    return;
  }
  startBlock1FromMemory();
}

/** 블록 1로 전환하고 첫 파일을 노출한다. */
function startBlock1FromMemory() {
  if (!Object.keys(BLOCK1_SPEC.files).length) {
    return;
  }
  if (block1Lifecycle) {
    block1Lifecycle.start({ reason: "memory-unlocked" });
  }
}

/** 블록 1 파일 열람 시 다음 파일을 순차 해금한다. */
function onBlock1FileOpened(path) {
  if (getPuzzlePrefixForPath(path) === "block1") {
    block1ActiveRecoveryFile = String(path || "").split("/").pop() || "";
    renderBlock0Panel();
    touchPuzzleActivity("block1");
  }
  if (block1Lifecycle) {
    block1Lifecycle.onFileOpened(path);
  }
}

function activatePendingRecoveryPrompt() {
  var pendingFile = "";
  if (state.phase !== FLOW_PHASE.STREAMING || block0AnswerRecoveryActive || !block0PendingRecoveryPrompt) {
    return;
  }

  pendingFile = String(block0PendingRecoveryPrompt.fileName || "");
  mountBlock0Clause();
  block0DraggedRecoveryFile = "";
  logSuccess("복구 식 연결: " + pendingFile);
  renderBlock0Panel();
  renderInvestigationPanel();
  pulseBlock0Clause("is-goal-alert");
  touchPuzzleActivity("block0");
}

function handleWorkbenchRecoveryDragEnter(dragEvent) {
  if (!elements.block0ActionCard || state.block0ClauseVisible || !block0DraggedRecoveryFile) {
    return;
  }
  dragEvent.preventDefault();
  elements.block0ActionCard.classList.add("is-drop-active");
}

function handleWorkbenchRecoveryDragOver(dragEvent) {
  if (!elements.block0ActionCard || state.block0ClauseVisible) {
    return;
  }
  dragEvent.preventDefault();
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = block0DraggedRecoveryFile ? "move" : "none";
  }
  elements.block0ActionCard.classList.toggle("is-drop-active", Boolean(block0DraggedRecoveryFile));
}

function handleWorkbenchRecoveryDragLeave(dragEvent) {
  if (!elements.block0ActionCard) {
    return;
  }
  if (dragEvent.relatedTarget && elements.block0ActionCard.contains(dragEvent.relatedTarget)) {
    return;
  }
  elements.block0ActionCard.classList.remove("is-drop-active");
}

function handleWorkbenchRecoveryDrop(dragEvent) {
  dragEvent.preventDefault();
  if (elements.block0ActionCard) {
    elements.block0ActionCard.classList.remove("is-drop-active");
  }
  if (!block0DraggedRecoveryFile) {
    logWarn("작업대에 마운트할 수 없는 파일입니다");
    return;
  }
  if (!block0PendingRecoveryPrompt || String(block0PendingRecoveryPrompt.fileName || "") !== block0DraggedRecoveryFile) {
    logWarn("복구 불가: 선행 조각 필요");
    return;
  }
  activatePendingRecoveryPrompt();
}

/** PREVIEW BUFFER 내 태그 링크 클릭 시 즉시 인벤토리에 추가한다. */
function handleInvestigationPreviewClick(clickEvent) {
  var target = clickEvent.target ? clickEvent.target.closest(".preview-tag-link") : null;

  if (!target || !target.dataset) {
    return;
  }
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }

  var selectedTag = String(target.dataset.tag || "");
  var prefix = getPuzzlePrefixForPath(previewFilePath);
  if (!selectedTag) {
    return;
  }

  collectBlock0Tag(selectedTag, selectedTag, prefix);
  if (previewFilePath && previewFileLines.length > 0 && getPuzzleFileIndex(prefix)[previewFilePath]) {
    renderPreviewBufferWithTagLinks(previewFilePath, previewFileLines);
  }
}

/** 목적 슬롯 클릭 시 보유 태그 중 적용 가능한 값으로 채운다. */
function handleBlock0PurposeSlotClick() {
  var prefix = getActivePuzzlePrefix();
  if (!state[prefix + "ClauseVisible"] || block0AnswerRecoveryActive) {
    return;
  }
  if (!state[prefix + "PurposeValue"]) {
    return;
  }

  if (prefix === "block0") {
    clearBlock0Purpose();
  } else {
    setPuzzlePurposeValue(state, prefix, "");
  }
  if (elements.block0PurposeSlot) {
    elements.block0PurposeSlot.classList.remove("is-drop-hover");
  }
  renderBlock0Panel();
  touchPuzzleActivity(prefix);
}

function handleBlock0ExecuteClick() {
  var prefix = getActivePuzzlePrefix();
  var spec = getPuzzleSpec(prefix);
  var questions = getPuzzleQuestions(prefix);
  var currentQuestion = getPuzzleCurrentQuestion(prefix);
  var expectedAnswer = currentQuestion ? String(currentQuestion.answer || "") : "";
  var lifecycle = spec.lifecycle || {};

  if (!state[prefix + "ClauseVisible"] || state[prefix + "Completed"] || block0AnswerRecoveryActive) {
    return;
  }
  if (!currentQuestion || !state[prefix + "PurposeValue"]) {
    return;
  }
  if (!expectedAnswer || state[prefix + "PurposeValue"] !== expectedAnswer) {
    logWarn(lifecycle.mismatchLog || "patch rejected: binding mismatch");
    pulseBlock0Clause("is-goal-alert");
    return;
  }

  if (prefix === "block1") {
    commitBlock1Answer(state, expectedAnswer);
    emitStateEvent(RUNTIME_TRANSITION_EVENT.BLOCK1_ANSWER_COMMITTED, null, {
      answer: expectedAnswer,
      questionId: currentQuestion.id,
    });
    logSuccess("패치 반영: " + currentQuestion.id);
    if (state.block1QuestionIndex < questions.length - 1) {
      advanceBlock1Question(state, questions.length);
      emitStateEvent(RUNTIME_TRANSITION_EVENT.BLOCK1_QUESTION_ADVANCED, null, {
        nextIndex: state.block1QuestionIndex,
      });
      block1ActiveRecoveryFile = "";
      pulseBlock0Clause("is-goal-clear");
      renderBlock0Panel();
      renderInvestigationPanel();
      touchPuzzleActivity("block1");
      return;
    }
    completeBlock1ClauseIfReady();
    return;
  }

  runBlock0AnswerRecoveryPipeline(currentQuestion, function onAnswerRecovered() {
    commitBlock0Answer(expectedAnswer);
    logSuccess("패치 반영: " + currentQuestion.id);

    if (state.block0QuestionIndex < questions.length - 1) {
      var nextTargetFile = "";
      var nextSequenceFile = getBlock0UnlockSequenceFiles()[state.block0QuestionIndex + 1] || "";
      nextTargetFile = String(nextSequenceFile || "");
      advanceBlock0Question(Boolean(nextTargetFile));
      pulseBlock0Clause("is-goal-clear");
      renderBlock0Panel();
      renderInvestigationPanel();
      if (!nextTargetFile) {
        pulseBlock0Clause("is-goal-alert");
      }
      touchPuzzleActivity("block0");
      return;
    }
    completeBlock0ClauseIfReady();
  });
}

function completeBlock1ClauseIfReady() {
  var questions = getPuzzleQuestions("block1");
  var currentQuestion = getPuzzleCurrentQuestion("block1");
  var expectedAnswer = currentQuestion ? String(currentQuestion.answer || "") : "";
  if (state.block1Completed) {
    return;
  }
  if (
    !state.block1ClauseVisible ||
    questions.length === 0 ||
    state.block1QuestionIndex !== questions.length - 1 ||
    !expectedAnswer ||
    state.block1PurposeValue !== expectedAnswer
  ) {
    return;
  }

  completeBlock1Progress(state, 36);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.BLOCK1_COMPLETED, null, {
    integrity: state.block1Integrity,
  });
  logRestored(buildRestoredStampLine());
  logSuccess("복구 완료: block-1");
  BLOCK1_SPEC.clause.outputText.forEach(function writeClauseLine(line) {
    logInfo(line);
  });
  renderInvestigationPanel();
  renderBlock0Panel();
  clearPuzzleIdleHint();
}

/** Clause 완료 조건을 검사하고 복원 문장/기억 조각을 연다. */
function completeBlock0ClauseIfReady() {
  var lifecycle = BLOCK0_SPEC.lifecycle || {};
  var questions = getBlock0ClauseQuestions();
  if (state.block0Completed) {
    return;
  }
  if (
    questions.length === 0 ||
    state.block0SolvedAnswers.length < questions.length ||
    state.block0QuestionIndex !== questions.length - 1
  ) {
    return;
  }

  completeBlock0Clause();

  logRestored(buildRestoredStampLine());
  logSuccess(lifecycle.completeSuccessLog || "archive resolved: block-0");
  pulseBlock0Clause("is-goal-clear");
  BLOCK0_SPEC.clause.outputText.forEach(function writeClauseLine(line) {
    logInfo(line);
  });
  logSystem("기억 조각 연결: " + BLOCK0_SPEC.memory.text);
  syncBlock0Fs();
  renderInvestigationPanel();
  if (block0Lifecycle) {
    block0Lifecycle.onComplete({ reason: "clause-complete" });
  }
  setBlock0MemoryModalVisible(true);
  renderBlock0Panel();

  clearPuzzleIdleHint();
}

// ----- 터미널 로그/히스토리 -----

/** 로그 영역/로그 큐/스크롤 고정 상태를 초기화한다. */
function clearLog() {
  if (elements.log) {
    elements.log.innerHTML = "";
  }
  resetLogQueueState(state);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.LOG_RESET);
  terminalSummaryLines = [];
  terminalSummaryLastKey = "";
  terminalSummaryRepeatCount = 0;
  refreshTerminalSummaryText();
}

/**
 * 터미널 로그 한 줄 출력.
 * options.animate=true일 때만 타이핑 큐를 사용한다.
 */
function appendLogLine(text, tone, options) {
  var shouldAnimate = false;
  if (options && typeof options.animate === "boolean") {
    shouldAnimate = options.animate;
  }
  pushTerminalSummaryLine(text, tone);

  if (!shouldAnimate) {
    var staticLine = createLogLine(tone);
    staticLine.textContent = text;
    scrollLogToBottom();
    return staticLine;
  }

  enqueueLogLine(text, tone);
  return null;
}

function logSystem(text, options) {
  return appendLogLine(text, "log-muted", options);
}

function logInfo(text, options) {
  return appendLogLine(text, "log-emphasis", options);
}

function logWarn(text, options) {
  return appendLogLine(text, "log-warn", options);
}

function logSuccess(text, options) {
  return appendLogLine(text, "log-success", options);
}

function logRestored(text, options) {
  return appendLogLine(text, "log-restored", options);
}

/** "[복원됨 YYYY. M. D. 오전/오후 h:mm:ss]" 형식의 스탬프 라인을 생성한다. */
function buildRestoredStampLine(dateValue) {
  var date = getSimulationDate(dateValue);
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours24 = date.getHours();
  var period = hours24 >= 12 ? "오후" : "오전";
  var hours12 = hours24 % 12;
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  if (hours12 === 0) {
    hours12 = 12;
  }

  return "[복원됨 " + year + ". " + month + ". " + day + ". " + period + " " + hours12 + ":" + padTwoDigits(minutes) + ":" + padTwoDigits(seconds) + "]";
}

/** 두 자리 숫자 문자열(01-99)을 보장한다. */
function padTwoDigits(value) {
  var safeValue = Number(value) || 0;
  if (safeValue < 10) {
    return "0" + safeValue;
  }
  return String(safeValue);
}

/** 로그 라인 DOM 노드를 생성해 로그 컨테이너에 추가한다. */
function createLogLine(tone) {
  var line = document.createElement("div");
  line.className = "log-line " + (tone || "log-muted");
  elements.log.appendChild(line);
  return line;
}

/** 사용자가 하단을 보고 있을 때에만 자동 스크롤한다. */
function scrollLogToBottom() {
  if (!elements.log || !state.logPinnedToBottom) {
    return;
  }

  elements.log.scrollTop = elements.log.scrollHeight;
  requestAnimationFrame(function onNextFrame() {
    elements.log.scrollTop = elements.log.scrollHeight;
  });
}

/** 로그 스크롤 위치를 감지해 자동 스크롤 고정 여부를 갱신한다. */
function handleLogScroll() {
  if (!elements.log) {
    return;
  }

  var threshold = 12;
  var distanceToBottom = elements.log.scrollHeight - (elements.log.scrollTop + elements.log.clientHeight);
  setLogPinnedState(state, distanceToBottom <= threshold);
}

/** 타이핑 출력 큐에 로그 항목을 등록한다. */
function enqueueLogLine(text, tone) {
  enqueueLogItem(state, { text: text, tone: tone || "log-muted" });
  emitStateEvent(RUNTIME_TRANSITION_EVENT.LOG_ENQUEUED, null, {
    text: String(text || ""),
    tone: tone || "log-muted",
  });
  if (!state.typingActive) {
    processNextLogLine();
  }
}

/** 로그 큐를 순차 타이핑 출력한다(현재는 필요 시에만 사용). */
function processNextLogLine() {
  if (state.logQueue.length === 0) {
    setTypingActiveState(state, false);
    emitStateEvent(RUNTIME_TRANSITION_EVENT.LOG_TYPING_UPDATED, null, { active: false });
    return;
  }

  setTypingActiveState(state, true);
  emitStateEvent(RUNTIME_TRANSITION_EVENT.LOG_TYPING_UPDATED, null, { active: true });
  var nextItem = state.logQueue.shift();
  var line = createLogLine(nextItem.tone);
  var text = nextItem.text;
  var index = 0;

  line.textContent = "";

  if (!text) {
    finishTypedLine();
    return;
  }

  function typeNextChar() {
    line.textContent += text.charAt(index);
    scrollLogToBottom();
    index += 1;

    if (index < text.length) {
      scheduleRuntimeTimeout(typeNextChar, GAME_CONFIG.typingCharDelayMs, "log-typing-char");
    } else {
      finishTypedLine();
    }
  }

  function finishTypedLine() {
    scrollLogToBottom();
    scheduleRuntimeTimeout(function scheduleNext() {
      setTypingActiveState(state, false);
      emitStateEvent(RUNTIME_TRANSITION_EVENT.LOG_TYPING_UPDATED, null, { active: false });
      processNextLogLine();
    }, GAME_CONFIG.typingLineDelayMs, "log-typing-line");
  }

  typeNextChar();
}

/** 앱 시작점. */
document.addEventListener("DOMContentLoaded", handleDomContentLoaded);
