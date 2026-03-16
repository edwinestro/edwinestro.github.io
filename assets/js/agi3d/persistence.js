import { HISTORY_LIMIT, STORAGE_KEY, clamp } from './config.js';

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
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextArchive));
  }

  return { archive: nextArchive, entry };
}

export function describeHistory(history) {
  if (!history.length) return 'No archived runs yet.';

  return history
    .slice(0, 3)
    .map((entry) => `${entry.victory ? 'Win' : 'Collapse'} ${entry.score} ${entry.seedLabel}`)
    .join(' • ');
}
