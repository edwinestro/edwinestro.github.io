import { DIAGNOSTIC_STORAGE_KEY } from './config.js';

const MAX_EVENTS = 120;
const MAX_ERRORS = 16;
const MAX_STALLS = 24;
const MIN_STALL_SECONDS = 0.085;
const RESUME_GAP_SECONDS = 1.25;

function nowIso() {
  return new Date().toISOString();
}

function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushBounded(list, value, max) {
  list.unshift(value);
  if (list.length > max) list.length = max;
}

function trimString(value, max = 240) {
  if (typeof value !== 'string') return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function serializeError(error) {
  if (!error) return { name: 'Error', message: 'Unknown error' };
  if (typeof error === 'string') return { name: 'Error', message: trimString(error) };
  return {
    name: trimString(error.name || 'Error', 80),
    message: trimString(error.message || 'Unknown error'),
    stack: trimString(error.stack || '', 1200),
  };
}

function safeSnapshot(getSnapshot) {
  try {
    return typeof getSnapshot === 'function' ? getSnapshot() : null;
  } catch (error) {
    return { snapshotError: serializeError(error) };
  }
}

export function createRuntimeDiagnostics({ gameId, getSnapshot }) {
  const state = {
    gameId,
    sessionId: createSessionId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'stable',
    counters: {
      events: 0,
      errors: 0,
      stalls: 0,
    },
    capabilities: {
      href: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || null : null,
      memoryGB: typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      screen: typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight }
        : null,
    },
    events: [],
    errors: [],
    stalls: [],
  };

  function persist() {
    state.updatedAt = nowIso();
    try {
      window.localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage failures. Diagnostics should never crash the game.
    }
  }

  function setStatus(next) {
    const order = { stable: 0, warning: 1, critical: 2 };
    if ((order[next] || 0) > (order[state.status] || 0)) {
      state.status = next;
    }
  }

  function recordEvent(type, detail = {}) {
    pushBounded(state.events, {
      at: nowIso(),
      type,
      detail,
    }, MAX_EVENTS);
    state.counters.events += 1;
    persist();
  }

  function recordError(type, error, detail = {}, severity = 'critical') {
    pushBounded(state.errors, {
      at: nowIso(),
      type,
      error: serializeError(error),
      detail,
      snapshot: safeSnapshot(getSnapshot),
    }, MAX_ERRORS);
    state.counters.errors += 1;
    setStatus(severity);
    persist();
  }

  function trackFrame(rawDeltaSeconds) {
    if (!Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds < MIN_STALL_SECONDS) return;
    if (typeof document !== 'undefined' && document.hidden) {
      recordEvent('hidden-frame-gap', { frameMs: Math.round(rawDeltaSeconds * 1000) });
      return;
    }
    if (rawDeltaSeconds >= RESUME_GAP_SECONDS) {
      recordEvent('resume-gap', { frameMs: Math.round(rawDeltaSeconds * 1000) });
      return;
    }
    pushBounded(state.stalls, {
      at: nowIso(),
      frameMs: Math.round(rawDeltaSeconds * 1000),
      snapshot: safeSnapshot(getSnapshot),
    }, MAX_STALLS);
    state.counters.stalls += 1;
    setStatus(state.counters.stalls >= 3 ? 'warning' : 'stable');
    persist();
  }

  async function copyReport() {
    const report = JSON.stringify({
      ...state,
      exportedAt: nowIso(),
      snapshot: safeSnapshot(getSnapshot),
    }, null, 2);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(report);
      return report;
    }

    if (typeof window !== 'undefined') {
      window.prompt('Copy AGI3D2 diagnostics', report);
    }
    return report;
  }

  function clear() {
    state.status = 'stable';
    state.counters.events = 0;
    state.counters.errors = 0;
    state.counters.stalls = 0;
    state.events.length = 0;
    state.errors.length = 0;
    state.stalls.length = 0;
    persist();
  }

  function summarize() {
    const latestError = state.errors[0];
    if (latestError) {
      return `${latestError.type}: ${latestError.error.message}`;
    }
    const latestStall = state.stalls[0];
    if (latestStall) {
      return `Longest recent frame ${latestStall.frameMs}ms`;
    }
    return 'No runtime faults captured.';
  }

  function onWindowError(event) {
    recordError('window-error', event.error || new Error(event.message || 'Window error'), {
      source: event.filename || '',
      line: event.lineno || 0,
      column: event.colno || 0,
    });
  }

  function onUnhandledRejection(event) {
    recordError('unhandled-rejection', event.reason || new Error('Unhandled promise rejection'), {}, 'warning');
  }

  function onVisibilityChange() {
    recordEvent(document.hidden ? 'document-hidden' : 'document-visible');
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
  }

  persist();

  return {
    state,
    recordEvent,
    recordError,
    trackFrame,
    copyReport,
    clear,
    summarize,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', onWindowError);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
      }
    },
  };
}