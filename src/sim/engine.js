/**
 * Deterministic simulation engine.
 * - Schedules timers by (dueTime, sequence)
 * - Supports deterministic RNG and virtual time advancement
 * - Records machine-checkable events with snapshots
 */

function cloneSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultSnapshotBuilder(state, timeMs) {
  return {
    timeMs: Number(timeMs || 0),
    state: cloneSnapshot(state || {}),
  };
}

export function createSeededRng(seedValue) {
  var seed = (Number(seedValue) >>> 0) || 1;
  return function nextRandom() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createSimulationEngine(options) {
  var config = options || {};
  var sharedState = config.initialState || {};
  var snapshotBuilder = typeof config.snapshotBuilder === "function"
    ? config.snapshotBuilder
    : defaultSnapshotBuilder;
  var reducer = typeof config.reducer === "function" ? config.reducer : null;
  var now = Number.isFinite(config.nowMs) ? Number(config.nowMs) : Date.now();
  var randomFn = typeof config.rng === "function"
    ? config.rng
    : createSeededRng(Number(config.seed) || now);

  var queue = [];
  var nextTimerId = 1;
  var nextSequence = 1;
  var eventQueue = [];

  function getSnapshot() {
    return snapshotBuilder(sharedState, now);
  }

  function pushEvent(name, payload, snapshotOverride) {
    var eventName = String(name || "sim.event");
    var eventPayload = payload && typeof payload === "object" ? cloneSnapshot(payload) : payload;
    var snapshot = snapshotOverride ? cloneSnapshot(snapshotOverride) : getSnapshot();
    var event = {
      name: eventName,
      timeMs: now,
      payload: eventPayload,
      snapshot: snapshot,
    };
    eventQueue.push(event);
    return event;
  }

  function scheduleInternal(callback, delayMs, options) {
    var safeDelay = Math.max(0, Number(delayMs) || 0);
    var timerOptions = options || {};
    var intervalMs = timerOptions.intervalMs != null ? Math.max(1, Number(timerOptions.intervalMs) || 1) : null;
    var timer = {
      id: nextTimerId++,
      dueTime: now + safeDelay,
      sequence: nextSequence++,
      callback: callback,
      intervalMs: intervalMs,
      cancelled: false,
      meta: timerOptions.meta || null,
    };
    queue.push(timer);
    return timer.id;
  }

  function sortQueue() {
    queue.sort(function byDueThenSequence(a, b) {
      if (a.dueTime !== b.dueTime) {
        return a.dueTime - b.dueTime;
      }
      return a.sequence - b.sequence;
    });
  }

  function clearScheduled(timerId) {
    var id = Number(timerId);
    queue = queue.filter(function keepActive(timer) {
      return timer.id !== id;
    });
  }

  function runDueTimers(targetTime) {
    var guard = 0;
    while (true) {
      var nextTimer = null;
      var i = 0;
      sortQueue();

      while (i < queue.length) {
        if (!queue[i].cancelled) {
          nextTimer = queue[i];
          break;
        }
        i += 1;
      }

      if (!nextTimer || nextTimer.dueTime > targetTime) {
        break;
      }

      queue = queue.filter(function keepOthers(timer) {
        return timer.id !== nextTimer.id;
      });

      now = nextTimer.dueTime;
      if (!nextTimer.cancelled && typeof nextTimer.callback === "function") {
        nextTimer.callback();
      }

      if (!nextTimer.cancelled && nextTimer.intervalMs != null) {
        scheduleInternal(nextTimer.callback, nextTimer.intervalMs, {
          intervalMs: nextTimer.intervalMs,
          meta: nextTimer.meta,
        });
      }

      guard += 1;
      if (guard > 10000) {
        throw new Error("Simulation scheduler guard triggered; possible infinite timer loop.");
      }
    }

    now = targetTime;
  }

  function advanceTime(ms) {
    var delta = Math.max(0, Number(ms) || 0);
    var target = now + delta;
    runDueTimers(target);
    return getSnapshot();
  }

  function dispatch(action) {
    var safeAction = action || {};
    if (reducer) {
      reducer(sharedState, safeAction, {
        nowMs: function nowMs() {
          return now;
        },
        random: function random() {
          return randomFn();
        },
        scheduleTimeout: scheduleTimeout,
        scheduleInterval: scheduleInterval,
        clearScheduled: clearScheduled,
        emitEvent: pushEvent,
      });
    }

    return pushEvent(
      safeAction.eventName || safeAction.type || "sim.dispatch",
      safeAction.payload || null,
      safeAction.snapshot || null,
    );
  }

  function scheduleTimeout(callback, delayMs, meta) {
    return scheduleInternal(callback, delayMs, { meta: meta || null });
  }

  function scheduleInterval(callback, intervalMs, meta) {
    return scheduleInternal(callback, intervalMs, {
      intervalMs: Math.max(1, Number(intervalMs) || 1),
      meta: meta || null,
    });
  }

  function drainEvents() {
    var copy = eventQueue.slice();
    eventQueue = [];
    return copy;
  }

  return {
    dispatch: dispatch,
    advanceTime: advanceTime,
    getSnapshot: getSnapshot,
    drainEvents: drainEvents,
    scheduleTimeout: scheduleTimeout,
    scheduleInterval: scheduleInterval,
    clearScheduled: clearScheduled,
    emitEvent: pushEvent,
    nowMs: function nowMs() {
      return now;
    },
    random: function random() {
      return randomFn();
    },
  };
}
