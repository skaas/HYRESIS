export const BLOCK0_TRANSITION_ACTION = Object.freeze({
  ARM_RECOVERY: "ARM_RECOVERY",
  CLEAR_RECOVERY_ARM: "CLEAR_RECOVERY_ARM",
  MOUNT_CLAUSE: "MOUNT_CLAUSE",
  SET_PURPOSE: "SET_PURPOSE",
  CLEAR_PURPOSE: "CLEAR_PURPOSE",
  COMMIT_ANSWER: "COMMIT_ANSWER",
  ADVANCE_QUESTION: "ADVANCE_QUESTION",
  COMPLETE_BLOCK0: "COMPLETE_BLOCK0",
});

export const BLOCK0_TRANSITION_EVENT = Object.freeze({
  RECOVERY_ARMED: "block0.recovery_armed",
  RECOVERY_ARM_CLEARED: "block0.recovery_arm_cleared",
  CLAUSE_MOUNTED: "block0.clause_mounted",
  PURPOSE_SET: "block0.purpose_set",
  PURPOSE_CLEARED: "block0.purpose_cleared",
  ANSWER_COMMITTED: "block0.answer_committed",
  QUESTION_ADVANCED: "block0.question_advanced",
  COMPLETED: "block0.completed",
});

function sanitizePrompt(payload) {
  var source = payload || {};
  return {
    fileName: String(source.fileName || "대상 파일"),
    requiredTag: String(source.requiredTag || ""),
    questionText: String(source.questionText || ""),
  };
}

function readModel(model) {
  return {
    state: model.getState(),
    pendingRecoveryPrompt: model.getPendingRecoveryPrompt(),
    activeRecoveryFile: String(model.getActiveRecoveryFile() || ""),
  };
}

export function buildBlock0Snapshot(model) {
  var current = readModel(model);
  return {
    phase: current.state.phase,
    block0Started: Boolean(current.state.block0Started),
    block0Completed: Boolean(current.state.block0Completed),
    block0QuestionIndex: Number(current.state.block0QuestionIndex || 0),
    block0VisibleFiles: Array.isArray(current.state.block0VisibleFiles)
      ? current.state.block0VisibleFiles.slice()
      : [],
    block0PurposeValue: String(current.state.block0PurposeValue || ""),
    hasPendingRecoveryPrompt: Boolean(current.pendingRecoveryPrompt),
    block0ActiveRecoveryFile: current.activeRecoveryFile,
  };
}

export function assertBlock0TransitionInvariants(model, options) {
  var current = readModel(model);
  var state = current.state;
  var pending = current.pendingRecoveryPrompt;
  var active = current.activeRecoveryFile;
  var questionCount = Number((options && options.questionCount) || 0);

  if (pending) {
    if (state.block0ClauseVisible) {
      throw new Error("Block0 invariant violated: armed state must keep clause hidden.");
    }
    if (String(state.block0PurposeValue || "") !== "") {
      throw new Error("Block0 invariant violated: armed state must keep purpose empty.");
    }
    if (active !== "") {
      throw new Error("Block0 invariant violated: armed state must keep active recovery file empty.");
    }
  }

  if (!pending && state.block0ClauseVisible && !state.block0Completed && active === "") {
    throw new Error("Block0 invariant violated: mounted clause requires an active recovery file.");
  }

  if (questionCount > 0) {
    var index = Number(state.block0QuestionIndex || 0);
    if (index < 0 || index >= questionCount) {
      throw new Error("Block0 invariant violated: question index out of range.");
    }
  }

  if (state.block0Completed && !state.block0MemoryUnlocked) {
    throw new Error("Block0 invariant violated: completed block must unlock memory.");
  }
}

export function createBlock0TransitionDispatcher(options) {
  var deps = options || {};
  var model = {
    getState: deps.getState,
    getPendingRecoveryPrompt: deps.getPendingRecoveryPrompt,
    setPendingRecoveryPrompt: deps.setPendingRecoveryPrompt,
    getActiveRecoveryFile: deps.getActiveRecoveryFile,
    setActiveRecoveryFile: deps.setActiveRecoveryFile,
  };

  if (
    typeof model.getState !== "function" ||
    typeof model.getPendingRecoveryPrompt !== "function" ||
    typeof model.setPendingRecoveryPrompt !== "function" ||
    typeof model.getActiveRecoveryFile !== "function" ||
    typeof model.setActiveRecoveryFile !== "function"
  ) {
    throw new Error("createBlock0TransitionDispatcher requires full model accessors.");
  }

  var emitStateEvent = typeof deps.emitStateEvent === "function" ? deps.emitStateEvent : function noopEmit() {};
  var getQuestionCount = typeof deps.getQuestionCount === "function" ? deps.getQuestionCount : function noQuestionCount() { return 0; };

  function emit(eventName) {
    var snapshot = buildBlock0Snapshot(model);
    emitStateEvent(eventName, snapshot);
    return { eventName: eventName, snapshot: snapshot };
  }

  function assertInvariants() {
    assertBlock0TransitionInvariants(model, { questionCount: Number(getQuestionCount() || 0) });
  }

  function transitionBlock0(action, payload) {
    var state = model.getState();
    var safePayload = payload || {};

    switch (action) {
      case BLOCK0_TRANSITION_ACTION.ARM_RECOVERY: {
        var prompt = sanitizePrompt(safePayload);
        model.setPendingRecoveryPrompt(prompt);
        model.setActiveRecoveryFile("");
        state.block0ClauseVisible = false;
        state.block0PurposeValue = "";
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.RECOVERY_ARMED);
      }
      case BLOCK0_TRANSITION_ACTION.CLEAR_RECOVERY_ARM:
        model.setPendingRecoveryPrompt(null);
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.RECOVERY_ARM_CLEARED);
      case BLOCK0_TRANSITION_ACTION.MOUNT_CLAUSE: {
        var pending = model.getPendingRecoveryPrompt();
        if (!pending) {
          throw new Error("Cannot mount clause without pending recovery prompt.");
        }
        model.setActiveRecoveryFile(String(pending.fileName || ""));
        model.setPendingRecoveryPrompt(null);
        state.block0ClauseVisible = true;
        state.block0PurposeValue = "";
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.CLAUSE_MOUNTED);
      }
      case BLOCK0_TRANSITION_ACTION.SET_PURPOSE:
        if (!state.block0ClauseVisible) {
          throw new Error("Cannot set purpose while clause is hidden.");
        }
        state.block0PurposeValue = String(safePayload.purposeValue || "");
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.PURPOSE_SET);
      case BLOCK0_TRANSITION_ACTION.CLEAR_PURPOSE:
        state.block0PurposeValue = "";
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.PURPOSE_CLEARED);
      case BLOCK0_TRANSITION_ACTION.COMMIT_ANSWER:
        if (!Array.isArray(state.block0SolvedAnswers)) {
          state.block0SolvedAnswers = [];
        }
        state.block0SolvedAnswers.push(String(safePayload.answer || ""));
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.ANSWER_COMMITTED);
      case BLOCK0_TRANSITION_ACTION.ADVANCE_QUESTION:
        state.block0QuestionIndex += 1;
        state.block0PurposeValue = "";
        model.setActiveRecoveryFile("");
        if (safePayload.hasNextTargetFile) {
          state.block0ClauseVisible = false;
        } else {
          state.block0ClauseVisible = true;
          model.setActiveRecoveryFile(String(safePayload.finalRecoveryFile || "최종 복구식"));
        }
        assertInvariants();
        return emit(BLOCK0_TRANSITION_EVENT.QUESTION_ADVANCED);
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
