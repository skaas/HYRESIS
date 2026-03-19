export const BLOCK0_SLOT_KEYS = Object.freeze(["purpose", "mapping", "design"]);

export const BLOCK0_TRANSITION_ACTION = Object.freeze({
  SHOW_BATCH_CLAUSE: "SHOW_BATCH_CLAUSE",
  SET_BATCH_SLOT: "SET_BATCH_SLOT",
  CLEAR_BATCH_SLOT: "CLEAR_BATCH_SLOT",
  COMMIT_BATCH: "COMMIT_BATCH",
  COMPLETE_BLOCK0: "COMPLETE_BLOCK0",
});

export const BLOCK0_TRANSITION_EVENT = Object.freeze({
  CLAUSE_SHOWN: "block0.clause_shown",
  SLOT_SET: "block0.slot_set",
  SLOT_CLEARED: "block0.slot_cleared",
  BATCH_COMMITTED: "block0.batch_committed",
  COMPLETED: "block0.completed",
});

function readModel(model) {
  return {
    state: model.getState(),
  };
}

function ensureClauseAnswers(state) {
  if (!state.block0ClauseAnswers || typeof state.block0ClauseAnswers !== "object") {
    state.block0ClauseAnswers = {
      purpose: "",
      mapping: "",
      design: "",
    };
  }
  BLOCK0_SLOT_KEYS.forEach(function ensureKey(key) {
    if (typeof state.block0ClauseAnswers[key] !== "string") {
      state.block0ClauseAnswers[key] = String(state.block0ClauseAnswers[key] || "");
    }
  });
  return state.block0ClauseAnswers;
}

function ensureValidSlotKey(slotKey) {
  var key = String(slotKey || "");
  if (BLOCK0_SLOT_KEYS.indexOf(key) === -1) {
    throw new Error("Unknown block0 batch slot: " + key);
  }
  return key;
}

export function buildBlock0Snapshot(model) {
  var current = readModel(model);
  var answers = ensureClauseAnswers(current.state);
  return {
    phase: current.state.phase,
    block0Started: Boolean(current.state.block0Started),
    block0Completed: Boolean(current.state.block0Completed),
    block0QuestionIndex: Number(current.state.block0QuestionIndex || 0),
    block0VisibleFiles: Array.isArray(current.state.block0VisibleFiles)
      ? current.state.block0VisibleFiles.slice()
      : [],
    block0ClauseVisible: Boolean(current.state.block0ClauseVisible),
    block0ClauseAnswers: {
      purpose: String(answers.purpose || ""),
      mapping: String(answers.mapping || ""),
      design: String(answers.design || ""),
    },
    block0SolvedAnswers: Array.isArray(current.state.block0SolvedAnswers)
      ? current.state.block0SolvedAnswers.slice()
      : [],
  };
}

export function assertBlock0TransitionInvariants(model, options) {
  var current = readModel(model);
  var state = current.state;
  var answers = ensureClauseAnswers(state);
  var expectedAnswerCount = Math.max(0, Number((options && options.expectedAnswerCount) || 0));

  BLOCK0_SLOT_KEYS.forEach(function validateKey(key) {
    if (typeof answers[key] !== "string") {
      throw new Error("Block0 invariant violated: clause slot must hold strings.");
    }
  });

  if (!state.block0ClauseVisible && (answers.purpose || answers.mapping || answers.design)) {
    throw new Error("Block0 invariant violated: hidden batch clause must keep all slot values empty.");
  }

  if (state.block0Completed && !state.block0MemoryUnlocked) {
    throw new Error("Block0 invariant violated: completed block must unlock memory.");
  }

  if (expectedAnswerCount > 0 && Array.isArray(state.block0SolvedAnswers)) {
    if (state.block0Completed && state.block0SolvedAnswers.length !== expectedAnswerCount) {
      throw new Error("Block0 invariant violated: completed block must commit all expected answers.");
    }
    if (!state.block0Completed && state.block0SolvedAnswers.length > expectedAnswerCount) {
      throw new Error("Block0 invariant violated: solved answers exceed expected batch size.");
    }
  }
}

export function createBlock0TransitionDispatcher(options) {
  var deps = options || {};
  var model = {
    getState: deps.getState,
  };

  if (typeof model.getState !== "function") {
    throw new Error("createBlock0TransitionDispatcher requires state accessors.");
  }

  var emitStateEvent = typeof deps.emitStateEvent === "function" ? deps.emitStateEvent : function noopEmit() {};
  var getExpectedAnswerCount =
    typeof deps.getExpectedAnswerCount === "function"
      ? deps.getExpectedAnswerCount
      : function noAnswerCount() { return BLOCK0_SLOT_KEYS.length; };

  function emit(eventName, detail) {
    var snapshot = buildBlock0Snapshot(model);
    emitStateEvent(eventName, snapshot, detail || null);
    return { eventName: eventName, snapshot: snapshot };
  }

  function assertInvariants() {
    assertBlock0TransitionInvariants(model, {
      expectedAnswerCount: Number(getExpectedAnswerCount() || 0),
    });
  }

  function transitionBlock0(action, payload) {
    var state = model.getState();
    var safePayload = payload || {};
    var answers = ensureClauseAnswers(state);
    var slotKey = "";

    switch (action) {
      case BLOCK0_TRANSITION_ACTION.SHOW_BATCH_CLAUSE:
        state.block0ClauseVisible = true;
        state.block0QuestionIndex = 0;
        BLOCK0_SLOT_KEYS.forEach(function clearSlot(key) {
          answers[key] = "";
        });
        state.block0PurposeValue = "";
        state.block0SolvedAnswers = [];
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.CLAUSE_SHOWN);
      case BLOCK0_TRANSITION_ACTION.SET_BATCH_SLOT:
        if (!state.block0ClauseVisible) {
          throw new Error("Cannot set block0 batch slot while clause is hidden.");
        }
        slotKey = ensureValidSlotKey(safePayload.slotKey);
        answers[slotKey] = String(safePayload.value || "");
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.SLOT_SET, { slotKey: slotKey });
      case BLOCK0_TRANSITION_ACTION.CLEAR_BATCH_SLOT:
        slotKey = ensureValidSlotKey(safePayload.slotKey);
        answers[slotKey] = "";
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.SLOT_CLEARED, { slotKey: slotKey });
      case BLOCK0_TRANSITION_ACTION.COMMIT_BATCH:
        state.block0SolvedAnswers = BLOCK0_SLOT_KEYS.map(function toSolvedAnswer(key) {
          return String(answers[key] || "");
        });
        state.block0PurposeValue = String((safePayload.integratedAnswer || "") || "");
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.BATCH_COMMITTED, {
          integratedAnswer: String(safePayload.integratedAnswer || ""),
        });
      case BLOCK0_TRANSITION_ACTION.COMPLETE_BLOCK0:
        state.block0Completed = true;
        state.block0MemoryUnlocked = true;
        state.block0Integrity = Math.max(Number(state.block0Integrity || 0), Number(safePayload.minIntegrity || 35));
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.COMPLETED);
      default:
        throw new Error("Unknown block0 transition action: " + String(action));
    }
  }

  return {
    transitionBlock0: transitionBlock0,
  };
}
