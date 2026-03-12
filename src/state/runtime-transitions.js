import { FLOW_PHASE } from "./state.js";

export const RUNTIME_TRANSITION_EVENT = Object.freeze({
  FLOW_BOOTING: "flow.booting",
  FLOW_LOGIN_REQUIRED: "flow.login_required",
  FLOW_ATTACHING: "flow.attaching",
  FLOW_STREAMING: "flow.streaming",
  AUTH_ERROR: "auth.error",
  AUTH_CONNECTING: "auth.connecting",
  AUTH_SUCCESS: "auth.success",
  INVESTIGATION_BOOTING: "flow.investigation_booting",
  INVESTIGATION_READY: "flow.investigation_ready",
  BLOCK1_RESET: "block1.reset",
  BLOCK1_STARTED: "block1.started",
  BLOCK1_ANSWER_COMMITTED: "block1.answer_committed",
  BLOCK1_QUESTION_ADVANCED: "block1.question_advanced",
  BLOCK1_COMPLETED: "block1.completed",
  PIPELINE_UPDATED: "pipeline.updated",
  LOG_RESET: "log.reset",
  LOG_ENQUEUED: "log.enqueued",
  LOG_TYPING_UPDATED: "log.typing_updated",
  FS_SYNCED: "fs.synced",
  TRANSFER_STARTED: "transfer.started",
  TRANSFER_TICK: "transfer.tick",
  TRANSFER_COMPLETED: "transfer.completed",
});

var FLOW_ORDER = {};
FLOW_ORDER[FLOW_PHASE.BOOTING] = 0;
FLOW_ORDER[FLOW_PHASE.LOGIN_REQUIRED] = 1;
FLOW_ORDER[FLOW_PHASE.ATTACHING] = 2;
FLOW_ORDER[FLOW_PHASE.STREAMING] = 3;
FLOW_ORDER[FLOW_PHASE.ENDED] = 4;

function ensureRuntimeState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Runtime transition requires mutable state object.");
  }
  return state;
}

function validatePhaseTransition(current, next) {
  if (!(next in FLOW_ORDER)) {
    throw new Error("Unknown flow phase: " + String(next));
  }
  if (!(current in FLOW_ORDER)) {
    return;
  }
  if (FLOW_ORDER[next] < FLOW_ORDER[current]) {
    throw new Error("Invalid flow phase regression: " + String(current) + " -> " + String(next));
  }
}

export function transitionFlowPhase(runtimeState, phase) {
  var state = ensureRuntimeState(runtimeState);
  validatePhaseTransition(state.phase, phase);
  state.phase = phase;
}

export function beginOpeningFlow(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  transitionFlowPhase(state, FLOW_PHASE.BOOTING);
  state.openingIndex = 0;
  state.inputEnabled = false;
}

export function advanceOpeningFlow(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  state.openingIndex += 1;
}

export function beginAuthFlow(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  transitionFlowPhase(state, FLOW_PHASE.LOGIN_REQUIRED);
  state.inputEnabled = false;
}

export function enterAttachingFlow(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  transitionFlowPhase(state, FLOW_PHASE.ATTACHING);
}

export function enterStreamingFlow(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  transitionFlowPhase(state, FLOW_PHASE.STREAMING);
}

export function beginInvestigationBoot(runtimeState, cwd) {
  var state = ensureRuntimeState(runtimeState);
  state.investigationBooting = true;
  state.investigationCwd = String(cwd || state.investigationCwd || "");
  state.inputEnabled = false;
}

export function finishInvestigationBoot(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  state.investigationBooting = false;
  state.inputEnabled = false;
}

export function setInputEnabledState(runtimeState, enabled) {
  var state = ensureRuntimeState(runtimeState);
  state.inputEnabled = Boolean(enabled);
}

export function setInvestigationCwdState(runtimeState, path) {
  var state = ensureRuntimeState(runtimeState);
  state.investigationCwd = String(path || state.investigationCwd || "");
}

export function resetBlock1Progress(runtimeState, initialIntegrity) {
  var state = ensureRuntimeState(runtimeState);
  state.block1Started = false;
  state.block1VisibleFiles = [];
  state.block1Completed = false;
  state.block1Integrity = Number(initialIntegrity) || 18;
  state.block1CollectedTags = [];
  state.block1ClauseVisible = false;
  state.block1PurposeValue = "";
  state.block1QuestionIndex = 0;
  state.block1SolvedAnswers = [];
  state.block1DiscoveredRecipes = [];
}

export function startBlock1Progress(runtimeState, initialIntegrity) {
  var state = ensureRuntimeState(runtimeState);
  state.block1Started = true;
  state.block1VisibleFiles = [];
  state.block1Completed = false;
  state.block1Integrity = Number(initialIntegrity) || state.block1Integrity || 18;
  state.block1CollectedTags = [];
  state.block1ClauseVisible = true;
  state.block1PurposeValue = "";
  state.block1QuestionIndex = 0;
  state.block1SolvedAnswers = [];
  state.block1DiscoveredRecipes = [];
}

export function commitBlock1Answer(runtimeState, answer) {
  var state = ensureRuntimeState(runtimeState);
  if (!Array.isArray(state.block1SolvedAnswers)) {
    state.block1SolvedAnswers = [];
  }
  state.block1SolvedAnswers.push(String(answer || ""));
}

export function advanceBlock1Question(runtimeState, questionCount) {
  var state = ensureRuntimeState(runtimeState);
  var max = Math.max(0, Number(questionCount) || 0);
  var nextIndex = Number(state.block1QuestionIndex || 0) + 1;
  if (max > 0 && nextIndex >= max) {
    throw new Error("Block1 invariant violated: question index out of range.");
  }
  state.block1QuestionIndex = nextIndex;
  state.block1PurposeValue = "";
}

export function setPuzzlePurposeValue(runtimeState, prefix, value) {
  var state = ensureRuntimeState(runtimeState);
  var key = String(prefix || "") + "PurposeValue";
  if (!(key in state)) {
    throw new Error("Unknown puzzle purpose key: " + key);
  }
  state[key] = String(value || "");
}

export function completeBlock1Progress(runtimeState, minIntegrity) {
  var state = ensureRuntimeState(runtimeState);
  state.block1Completed = true;
  state.block1Integrity = Math.max(Number(state.block1Integrity || 0), Number(minIntegrity) || 36);
}

export function pushDiscoveredRecipe(runtimeState, prefix, recipeText) {
  var state = ensureRuntimeState(runtimeState);
  var key = String(prefix || "") + "DiscoveredRecipes";
  if (!Array.isArray(state[key])) {
    state[key] = [];
  }
  state[key].push(String(recipeText || ""));
}

export function markBlock0DragHint(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  state.block0DragHintShown = true;
}

export function setBlock0Pipeline(runtimeState, stage, progress) {
  var state = ensureRuntimeState(runtimeState);
  state.block0PipelineStage = String(stage || "");
  state.block0PipelineProgress = Math.max(0, Math.min(1, Number(progress) || 0));
}

export function resetLogQueueState(runtimeState) {
  var state = ensureRuntimeState(runtimeState);
  state.logQueue = [];
  state.typingActive = false;
  state.logPinnedToBottom = true;
}

export function enqueueLogItem(runtimeState, item) {
  var state = ensureRuntimeState(runtimeState);
  if (!Array.isArray(state.logQueue)) {
    state.logQueue = [];
  }
  state.logQueue.push(item || { text: "", tone: "log-muted" });
}

export function setTypingActiveState(runtimeState, active) {
  var state = ensureRuntimeState(runtimeState);
  state.typingActive = Boolean(active);
}

export function setLogPinnedState(runtimeState, pinned) {
  var state = ensureRuntimeState(runtimeState);
  state.logPinnedToBottom = Boolean(pinned);
}
