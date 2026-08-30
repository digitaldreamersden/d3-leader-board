import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

// Task 2.1: TimerState and TimerContextValue interfaces
export interface TimerState {
  mode: "count-up" | "countdown";
  durationSeconds: number;
  startTimestamp: number | null;
  pausedAtElapsed: number;
  status: "idle" | "running" | "paused" | "expired";
}

export interface TimerContextValue {
  state: TimerState;
  displaySeconds: number;
  configure: (opts: { mode: TimerState["mode"]; durationSeconds: number }) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  addTime: (seconds: number) => void;
  stop: () => void;
}

const STORAGE_KEY = "timer-state";

const DEFAULT_STATE: TimerState = {
  mode: "countdown",
  durationSeconds: 3600,
  startTimestamp: null,
  pausedAtElapsed: 0,
  status: "idle",
};

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

// Task 2.9: Persist state to localStorage
function persistState(state: TimerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // If localStorage quota exceeded, silently continue with in-memory state
  }
}

// Task 2.10: Restore state from localStorage
function loadStateFromStorage(): TimerState {
  if (typeof window === "undefined") {
    return DEFAULT_STATE;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return DEFAULT_STATE;
  }
  try {
    const parsed = JSON.parse(saved);

    // Validate required fields exist
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !["count-up", "countdown"].includes(parsed.mode) ||
      typeof parsed.durationSeconds !== "number" ||
      !["idle", "running", "paused", "expired"].includes(parsed.status)
    ) {
      return DEFAULT_STATE;
    }

    const state: TimerState = {
      mode: parsed.mode,
      durationSeconds: parsed.durationSeconds,
      startTimestamp: parsed.startTimestamp ?? null,
      pausedAtElapsed: parsed.pausedAtElapsed ?? 0,
      status: parsed.status,
    };

    // Handle restore for "running" state — recalculate elapsed and check expiration
    if (state.status === "running" && state.startTimestamp !== null) {
      const elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000);
      if (state.mode === "countdown" && elapsed >= state.durationSeconds) {
        // Countdown expired while page was closed
        state.status = "expired";
        state.pausedAtElapsed = state.durationSeconds;
        state.startTimestamp = null;
      }
      // Otherwise continue as running — the tick effect will pick it up
    }

    return state;
  } catch {
    return DEFAULT_STATE;
  }
}

function computeDisplaySeconds(state: TimerState): number {
  if (state.status === "idle") {
    return state.mode === "countdown" ? state.durationSeconds : 0;
  }

  if (state.status === "expired") {
    return 0;
  }

  let elapsed: number;
  if (state.status === "running" && state.startTimestamp !== null) {
    elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000);
  } else {
    // paused
    elapsed = state.pausedAtElapsed;
  }

  if (state.mode === "count-up") {
    return elapsed;
  }

  // countdown: remaining seconds clamped to 0
  return Math.max(0, state.durationSeconds - elapsed);
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TimerState>(loadStateFromStorage);
  const [displaySeconds, setDisplaySeconds] = useState<number>(() => computeDisplaySeconds(state));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper to update state and persist
  const updateState = useCallback((newState: TimerState) => {
    setState(newState);
    persistState(newState);
  }, []);

  // Task 2.2: configure() — sets mode and durationSeconds when status is "idle"
  const configure = useCallback(
    (opts: { mode: TimerState["mode"]; durationSeconds: number }) => {
      if (state.status !== "idle") return;
      const newState: TimerState = {
        ...state,
        mode: opts.mode,
        durationSeconds: opts.durationSeconds,
      };
      updateState(newState);
    },
    [state, updateState]
  );

  // Task 2.3: start() — sets startTimestamp to Date.now(), status to "running"
  const start = useCallback(() => {
    const newState: TimerState = {
      ...state,
      startTimestamp: Date.now(),
      status: "running",
      pausedAtElapsed: 0,
    };
    updateState(newState);
  }, [state, updateState]);

  // Task 2.4: pause() — calculates elapsed, stores in pausedAtElapsed, sets status to "paused"
  const pause = useCallback(() => {
    if (state.status !== "running" || state.startTimestamp === null) return;
    const elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000);
    const newState: TimerState = {
      ...state,
      pausedAtElapsed: elapsed,
      startTimestamp: null,
      status: "paused",
    };
    updateState(newState);
  }, [state, updateState]);

  // Task 2.5: resume() — adjusts startTimestamp to account for paused duration, sets status to "running"
  const resume = useCallback(() => {
    if (state.status !== "paused") return;
    const newState: TimerState = {
      ...state,
      startTimestamp: Date.now() - state.pausedAtElapsed * 1000,
      status: "running",
    };
    updateState(newState);
  }, [state, updateState]);

  // Task 2.6: reset() — resets all state to idle defaults, removes localStorage("timer-state")
  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
  }, []);

  // addTime() — adds extra seconds to durationSeconds (grace period), works while running/paused/expired
  const addTime = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    const newState: TimerState = {
      ...state,
      durationSeconds: state.durationSeconds + seconds,
      // If expired, bring it back to running so the added time is usable
      status: state.status === "expired" ? "running" : state.status,
      startTimestamp: state.status === "expired"
        ? Date.now() - state.durationSeconds * 1000 // resume from where it expired
        : state.startTimestamp,
    };
    updateState(newState);
  }, [state, updateState]);

  // stop() — hard stop, immediately sets status to "expired" regardless of current state
  const stop = useCallback(() => {
    if (state.status === "idle" || state.status === "expired") return;
    const newState: TimerState = {
      ...state,
      status: "expired",
      startTimestamp: null,
      pausedAtElapsed: state.startTimestamp
        ? Math.floor((Date.now() - state.startTimestamp) / 1000)
        : state.pausedAtElapsed,
    };
    updateState(newState);
  }, [state, updateState]);

  // Task 2.7 & 2.8: Tick mechanism and countdown expiration
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state.status === "running") {
      // Compute immediately
      setDisplaySeconds(computeDisplaySeconds(state));

      intervalRef.current = setInterval(() => {
        if (state.startTimestamp === null) return;

        const elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000);

        // Task 2.8: Check countdown expiration
        if (state.mode === "countdown" && elapsed >= state.durationSeconds) {
          const expiredState: TimerState = {
            ...state,
            status: "expired",
            pausedAtElapsed: state.durationSeconds,
            startTimestamp: null,
          };
          setState(expiredState);
          persistState(expiredState);
          setDisplaySeconds(0);
          return;
        }

        // Update display
        if (state.mode === "count-up") {
          setDisplaySeconds(elapsed);
        } else {
          setDisplaySeconds(Math.max(0, state.durationSeconds - elapsed));
        }
      }, 1000);
    } else {
      // Not running — compute display from current state
      setDisplaySeconds(computeDisplaySeconds(state));
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state]);

  return (
    <TimerContext.Provider
      value={{ state, displaySeconds, configure, start, pause, resume, reset, addTime, stop }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
