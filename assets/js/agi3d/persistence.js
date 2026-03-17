import { HISTORY_LIMIT, STORAGE_KEY, clamp } from './config.js';

let _userId = null;

/** Set the current user ID to namespace storage. Call once at startup. */
export function setUserId(id) {
  _userId = id || null;
}

function storageKey() {
  return _userId ? `${STORAGE_KEY}.${_userId}` : STORAGE_KEY;
}

function defaultArchive() {
  return {
    totalRuns: 0,
    wins: 0,
    bestScore: 0,
    bestResonance: 0,
    totalDiscoveries: 0,
    archiveTier: 0,
    history: [],
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(Boolean)
    .map((entry) => ({
      timestamp: Number(entry.timestamp) || Date.now(),
      score: Number(entry.score) || 0,
      victory: Boolean(entry.victory),
      discoveries: Number(entry.discoveries) || 0,
      resonance: Number(entry.resonance) || 0,
      stability: Number(entry.stability) || 0,
      rupturesResolved: Number(entry.rupturesResolved) || 0,
      beaconsPlaced: Number(entry.beaconsPlaced) || 0,
      pulsesUsed: Number(entry.pulsesUsed) || 0,
      anchorsUsed: Number(entry.anchorsUsed) || 0,
      seedLabel: typeof entry.seedLabel === 'string' ? entry.seedLabel : '--------',
      modifierLabels: Array.isArray(entry.modifierLabels) ? entry.modifierLabels.filter((label) => typeof label === 'string').slice(0, 3) : [],
      archiveTier: Number(entry.archiveTier) || 0,
    }))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, HISTORY_LIMIT);
}

function computeArchiveTier(archive) {
  const momentum = archive.wins * 2 + archive.bestScore / 1000 + archive.totalDiscoveries / 40 + archive.bestResonance / 50;
  return clamp(Math.floor(momentum), 0, 6);
}

export function loadArchive() {
  if (typeof window === 'undefined') return defaultArchive();

  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return defaultArchive();

    const parsed = JSON.parse(raw);
    const archive = {
      totalRuns: Number(parsed.totalRuns) || 0,
      wins: Number(parsed.wins) || 0,
      bestScore: Number(parsed.bestScore) || 0,
      bestResonance: Number(parsed.bestResonance) || 0,
      totalDiscoveries: Number(parsed.totalDiscoveries) || 0,
      archiveTier: Number(parsed.archiveTier) || 0,
      history: normalizeHistory(parsed.history),
    };
    archive.archiveTier = computeArchiveTier(archive);
    return archive;
  } catch {
    return defaultArchive();
  }
}

export function getArchiveBonuses(archive) {
  return {
    coherence: archive.archiveTier * 0.03,
    startingResonance: clamp(archive.wins * 2, 0, 12),
    anchorCooldownReduction: archive.archiveTier * 0.55,
    pulseCooldownReduction: archive.archiveTier * 0.75,
    scoreMultiplier: 1 + archive.archiveTier * 0.04,
  };
}

export function computeRunScore(summary, archiveTier = 0) {
  const baseScore =
    summary.discoveries * 85 +
    summary.rupturesResolved * 140 +
    summary.resonance * 6 +
    summary.stability * 2 +
    (summary.anchorsUsed || 0) * 20 +
    (summary.victory ? 600 : 0) -
    summary.beaconsPlaced * 5;

  return Math.max(0, Math.round(baseScore * (1 + archiveTier * 0.04)));
}

export function recordRun(previousArchive, summary) {
  const entry = {
    timestamp: Date.now(),
    score: computeRunScore(summary, previousArchive.archiveTier),
    victory: Boolean(summary.victory),
    discoveries: Math.round(summary.discoveries),
    resonance: Math.round(summary.resonance),
    stability: Math.round(summary.stability),
    rupturesResolved: Math.round(summary.rupturesResolved),
    beaconsPlaced: Math.round(summary.beaconsPlaced),
    pulsesUsed: Math.round(summary.pulsesUsed),
    anchorsUsed: Math.round(summary.anchorsUsed),
    seedLabel: typeof summary.seedLabel === 'string' ? summary.seedLabel : '--------',
    modifierLabels: Array.isArray(summary.modifierLabels) ? summary.modifierLabels.slice(0, 3) : [],
    archiveTier: previousArchive.archiveTier,
  };

  const nextArchive = {
    totalRuns: previousArchive.totalRuns + 1,
    wins: previousArchive.wins + (entry.victory ? 1 : 0),
    bestScore: Math.max(previousArchive.bestScore, entry.score),
    bestResonance: Math.max(previousArchive.bestResonance, entry.resonance),
    totalDiscoveries: previousArchive.totalDiscoveries + entry.discoveries,
    archiveTier: previousArchive.archiveTier,
    history: [entry, ...normalizeHistory(previousArchive.history)].slice(0, HISTORY_LIMIT),
  };

  nextArchive.archiveTier = computeArchiveTier(nextArchive);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(), JSON.stringify(nextArchive));
  }

  // Fire-and-forget server sync
  pushArchiveToServer(nextArchive);

  return { archive: nextArchive, entry };
}

export function describeHistory(history) {
  if (!history.length) return 'No archived runs yet.';

  return history
    .slice(0, 3)
    .map((entry) => `${entry.victory ? 'Win' : 'Collapse'} ${entry.score} ${entry.seedLabel}`)
    .join(' • ');
}

// --- Server-side persistence ---

/**
 * Fetch archive from server (same-origin SWA function).
 * SWA forwards the auth cookie, so no userId needed in the request.
 * Non-blocking — if the server is unreachable, returns null.
 */
export async function loadArchiveFromServer() {
  if (!_userId) return null;
  try {
    const res = await fetch('/api/archive', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok || !data.archive) return null;

    const remote = {
      totalRuns: Number(data.archive.totalRuns) || 0,
      wins: Number(data.archive.wins) || 0,
      bestScore: Number(data.archive.bestScore) || 0,
      bestResonance: Number(data.archive.bestResonance) || 0,
      totalDiscoveries: Number(data.archive.totalDiscoveries) || 0,
      archiveTier: Number(data.archive.archiveTier) || 0,
      history: normalizeHistory(data.archive.history),
    };
    remote.archiveTier = computeArchiveTier(remote);
    return remote;
  } catch {
    return null;
  }
}

/** Merge local and remote archives, keeping whichever has more progress. */
export function mergeArchives(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  if (remote.totalRuns > local.totalRuns) return remote;
  if (remote.totalRuns === local.totalRuns && remote.bestScore > local.bestScore) return remote;
  return local;
}

/** Push archive to server. Non-blocking, best-effort. */
function pushArchiveToServer(archive) {
  if (!_userId) return;
  fetch('/api/archive', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archive }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => { /* silent — localStorage is the fallback */ });
}
