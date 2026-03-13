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
  phase: FLOW_PHASE.BOOTING,
  investigationBooting: false,
  investigationCwd: "/하이레시스",
  logPinnedToBottom: true,
  block0Started: false,
  block0Completed: false,
  block0Integrity: 12,
  block0VisibleFiles: ["부팅.log"],
  block0CollectedTags: [],
  block0ClauseVisible: false,
  block0PurposeValue: "",
  block0QuestionIndex: 0,
  block0SolvedAnswers: [],
  block0MemoryUnlocked: false,
  selectedProfileId: "",
  block0DragHintShown: false,
  block0DiscoveredRecipes: [],
  block0PipelineStage: "",
  block0PipelineProgress: 0,
  block1Started: false,
  block1VisibleFiles: [],
  block1Completed: false,
  block1Integrity: 18,
  block1CollectedTags: [],
  block1ClauseVisible: false,
  block1PurposeValue: "",
  block1QuestionIndex: 0,
  block1SolvedAnswers: [],
  block1DiscoveredRecipes: [],
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
  authConsentText: null,
  authError: null,
  authStatus: null,
  systemOverlay: null,
  systemBootLog: null,
  systemStatus: null,
  terminalWorkspace: null,
  terminalPane: null,
  terminalLogDetails: null,
  terminalLogToggle: null,
  terminalSummaryText: null,
  investigationPanel: null,
  investigationLinkChip: null,
  investigationPath: null,
  investigationList: null,
  investigationContent: null,
  block0Status: null,
  block0ActionCard: null,
  block0ActionState: null,
  block0ActionTitle: null,
  block0ActionBody: null,
  block0ActionButton: null,
  block0Progress: null,
  block0ProgressFill: null,
  block0ProgressLabel: null,
  block0TagInventory: null,
  block0FusionDock: null,
  block0ClausePanel: null,
  block0ClauseTitle: null,
  block0TargetBadge: null,
  block0PurposeLabel: null,
  block0PurposeSlot: null,
  block0ProfilePanel: null,
  block0ProfileCard: null,
  block0MemoryModal: null,
  block0MemoryModalText: null,
  block0MemoryModalNext: null,
  terminalPathbar: null,
};

/** phase 상태 전환 헬퍼. */
export function setFlowPhase(phase) {
  state.phase = phase;
}
