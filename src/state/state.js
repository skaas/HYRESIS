/**
 * 런타임 상태 상수.
 * BOOTING -> LOGIN_REQUIRED -> ATTACHING -> STREAMING 순으로 진행한다.
 */
export const FLOW_PHASE = {
  BOOTING: "BOOTING",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  ATTACHING: "ATTACHING",
  STREAMING: "STREAMING",
  ENDED: "ENDED",
};

/**
 * 전역 런타임 상태.
 * app.js의 화면 전환/입력 가능 여부/로그 동작이 이 객체를 기준으로 동작한다.
 */
export const state = {
  openingIndex: 0,
  inputEnabled: false,
  logQueue: [],
  typingActive: false,
  inputHistory: [],
  inputHistoryCursor: -1,
  phase: FLOW_PHASE.BOOTING,
  investigationBooting: false,
  investigationCwd: "/하이레시스",
  logPinnedToBottom: true,
  block0Started: false,
  block0Completed: false,
  block0Integrity: 12,
  block0VisibleFiles: ["부팅.log"],
  block0CollectedTags: [],
  block0ClauseVisible: true,
  block0PurposeValue: "",
  block0MemoryUnlocked: false,
  block0DragHintShown: false,
  block0IdleHintTimer: 0,
  block0DiscoveredRecipes: [],
  block1Started: false,
  block1VisibleFiles: [],
};

/**
 * DOM 캐시.
 * querySelector 호출 중복을 피하고, 화면 갱신 함수가 동일 참조를 사용하도록 고정한다.
 */
export const elements = {
  log: null,
  controls: null,
  authOverlay: null,
  authForm: null,
  authUsername: null,
  authPassword: null,
  authError: null,
  authStatus: null,
  systemOverlay: null,
  systemBootLog: null,
  systemStatus: null,
  terminalWorkspace: null,
  terminalPane: null,
  investigationPanel: null,
  investigationLinkChip: null,
  investigationPath: null,
  investigationList: null,
  investigationContent: null,
  investigationEditButton: null,
  investigationDownloadButton: null,
  block0Status: null,
  block0TagInventory: null,
  block0RecipeList: null,
  block0ClausePanel: null,
  block0ClauseTitle: null,
  block0PurposeLabel: null,
  block0PurposeSlot: null,
  block0PremiseSlot: null,
  block0MemoryModal: null,
  block0MemoryModalText: null,
  block0MemoryModalNext: null,
  auditMonitor: null,
  auditRefreshButton: null,
  auditKpiGrid: null,
  auditAnomalyList: null,
  auditDownloadAll: null,
  previewDownloadAll: null,
  previewDownloadList: null,
  thresholdUnresolved: null,
  thresholdLatency: null,
  terminalPathbar: null,
  input: null,
  submit: null,
  form: null,
};

/** phase 상태 전환 헬퍼. */
export function setFlowPhase(phase) {
  state.phase = phase;
}

/** 터미널 입력 가능 조건 체크(세션 연결 후 STREAMING 상태에서만 허용). */
export function canUseTerminalInput() {
  return state.inputEnabled && state.phase === FLOW_PHASE.STREAMING;
}
