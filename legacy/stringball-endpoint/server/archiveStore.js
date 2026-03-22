/**
 * File-backed archive store for per-user game progress.
 * Stores all user archives in a single JSON file keyed by userId.
 */
const fs = require('fs');
const path = require('path');

const ARCHIVE_FILE = path.resolve(__dirname, 'archives.json');
const MAX_HISTORY = 6;
const MAX_ARCHIVE_SIZE = 8192; // bytes, per-user limit

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeArchive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    totalRuns: Math.max(0, Math.floor(Number(raw.totalRuns) || 0)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
    bestResonance: Math.max(0, Math.floor(Number(raw.bestResonance) || 0)),
    totalDiscoveries: Math.max(0, Math.floor(Number(raw.totalDiscoveries) || 0)),
    archiveTier: Math.min(6, Math.max(0, Math.floor(Number(raw.archiveTier) || 0))),
    history: sanitizeHistory(raw.history),
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(Boolean)
    .slice(0, MAX_HISTORY)
    .map((e) => ({
      timestamp: Number(e.timestamp) || 0,
      score: Math.max(0, Math.floor(Number(e.score) || 0)),
      victory: Boolean(e.victory),
      discoveries: Math.max(0, Math.floor(Number(e.discoveries) || 0)),
      resonance: Math.max(0, Math.floor(Number(e.resonance) || 0)),
      stability: Math.max(0, Math.floor(Number(e.stability) || 0)),
      rupturesResolved: Math.max(0, Math.floor(Number(e.rupturesResolved) || 0)),
      beaconsPlaced: Math.max(0, Math.floor(Number(e.beaconsPlaced) || 0)),
      pulsesUsed: Math.max(0, Math.floor(Number(e.pulsesUsed) || 0)),
      anchorsUsed: Math.max(0, Math.floor(Number(e.anchorsUsed) || 0)),
      seedLabel: typeof e.seedLabel === 'string' ? e.seedLabel.slice(0, 20) : '--------',
      modifierLabels: Array.isArray(e.modifierLabels)
        ? e.modifierLabels.filter((l) => typeof l === 'string').slice(0, 3).map((l) => l.slice(0, 40))
        : [],
      archiveTier: Math.min(6, Math.max(0, Math.floor(Number(e.archiveTier) || 0))),
    }));
}

function getArchive(userId) {
  const all = readAll();
  return all[userId] || null;
}

function saveArchive(userId, archive) {
  const sanitized = sanitizeArchive(archive);
  if (!sanitized) throw new Error('Invalid archive data');

  // Size guard
  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_ARCHIVE_SIZE) {
    throw new Error('Archive data too large');
  }

  const all = readAll();
  all[userId] = sanitized;
  writeAll(all);
  return sanitized;
}

module.exports = { getArchive, saveArchive };
