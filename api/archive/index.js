const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agi3dgame';
const DEFAULT_GAME_ID = 'unsupervised-agi-3d';
const MAX_HISTORY = 6;
const MAX_ARCHIVE_SIZE = 8192;
const LB_SIZE = 10;
const LB_CATEGORIES = ['stability', 'ruptures', 'coherence', 'autonomy'];
const LB_CATEGORIES_EXTRA = ['xp', 'tasks', 'streak', 'time'];

let tableClient;

async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('AzureWebJobsStorage not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  await tableClient.createTable();
  return tableClient;
}

function getUserId(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return null;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return decoded.userId || null;
  } catch {
    return null;
  }
}

function getUserName(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return 'Player';
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return decoded.userDetails || 'Player';
  } catch {
    return 'Player';
  }
}

function sanitizeGameId(value) {
  const cleaned = String(value || DEFAULT_GAME_ID)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return cleaned || DEFAULT_GAME_ID;
}

function getRequestedGame(req) {
  return sanitizeGameId(req.query?.game || req.body?.game);
}

function archivePartitionKey(gameId) {
  return `archive-${gameId}`;
}

function leaderboardPartitionKey(gameId, category) {
  return `lb-${gameId}-${category}`;
}

function sanitizeArchive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    totalRuns: Math.max(0, Math.floor(Number(raw.totalRuns) || 0)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
    bestResonance: Math.max(0, Math.floor(Number(raw.bestResonance) || 0)),
    totalDiscoveries: Math.max(0, Math.floor(Number(raw.totalDiscoveries) || 0)),
    totalRunDuration: Math.max(0, Math.floor(Number(raw.totalRunDuration) || 0)),
    archiveTier: Math.min(6, Math.max(0, Math.floor(Number(raw.archiveTier) || 0))),
    history: sanitizeHistory(raw.history),
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter(Boolean).slice(0, MAX_HISTORY).map((e) => ({
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
    runDuration: Math.max(0, Math.floor(Number(e.runDuration) || 0)),
    autonomyRatio: Math.max(0, Math.round((Number(e.autonomyRatio) || 0) * 10) / 10),
    seedLabel: typeof e.seedLabel === 'string' ? e.seedLabel.slice(0, 20) : '--------',
    modifierLabels: Array.isArray(e.modifierLabels)
      ? e.modifierLabels.filter((l) => typeof l === 'string').slice(0, 3).map((l) => l.slice(0, 40))
      : [],
    archiveTier: Math.min(6, Math.max(0, Math.floor(Number(e.archiveTier) || 0))),
  }));
}

function lbMetric(entry, category) {
  switch (category) {
    case 'stability': return entry.stability || 0;
    case 'ruptures': return entry.rupturesResolved || 0;
    case 'coherence': return entry.runDuration || 0;
    case 'autonomy': return entry.autonomyRatio || 0;
    // TASKRUNNER categories (mapped to existing archive fields)
    case 'xp': return entry.stability || entry.score || 0;
    case 'tasks': return entry.rupturesResolved || entry.discoveries || 0;
    case 'streak': return entry.resonance || 0;
    case 'tier': return entry.autonomyRatio || entry.archiveTier || 0;
    case 'time': return entry.runDuration || 0;
    default: return 0;
  }
}

async function updateLeaderboards(client, entry, userName, gameId) {
  // Choose categories based on game
  const categories = gameId === 'taskrunner' ? LB_CATEGORIES_EXTRA : LB_CATEGORIES;
  for (const cat of categories) {
    const metric = lbMetric(entry, cat);
    if (metric <= 0) continue;

    // Read current top entries for this category
    const existing = [];
    const partitionKey = leaderboardPartitionKey(gameId, cat);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } });
    for await (const e of iter) existing.push(e);
    existing.sort((a, b) => (Number(b.metric) || 0) - (Number(a.metric) || 0));

    // Check if this run qualifies
    if (existing.length >= LB_SIZE && metric <= (Number(existing[existing.length - 1].metric) || 0)) continue;

    // Add entry
    const newEntry = {
      partitionKey,
      rowKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      gameId,
      metric: metric,
      playerName: (userName || 'Player').slice(0, 50),
      score: entry.score || 0,
      victory: entry.victory || false,
      runDuration: entry.runDuration || 0,
      discoveries: entry.discoveries || 0,
      rupturesResolved: entry.rupturesResolved || 0,
      stability: entry.stability || 0,
      autonomyRatio: entry.autonomyRatio || 0,
      seedLabel: (entry.seedLabel || '').slice(0, 20),
      timestamp: entry.timestamp || Date.now(),
    };
    await client.upsertEntity(newEntry, 'Replace');

    // Trim to top N
    existing.push(newEntry);
    existing.sort((a, b) => (Number(b.metric) || 0) - (Number(a.metric) || 0));
    for (let i = LB_SIZE; i < existing.length; i++) {
      try { await client.deleteEntity(existing[i].partitionKey, existing[i].rowKey); } catch {}
    }
  }
}

module.exports = async function (context, req) {
  const userId = getUserId(req);
  if (!userId) {
    context.res = { status: 401, body: { ok: false, error: 'Not authenticated' } };
    return;
  }

  const gameId = getRequestedGame(req);

  try {
    const client = await getTableClient();

    if (req.method === 'GET') {
      try {
        const entity = await client.getEntity(archivePartitionKey(gameId), userId);
        const archive = JSON.parse(entity.data);
        context.res = { status: 200, body: { ok: true, game: gameId, archive } };
      } catch (e) {
        if (e.statusCode === 404) {
          context.res = { status: 200, body: { ok: true, game: gameId, archive: null } };
        } else {
          throw e;
        }
      }
      return;
    }

    if (req.method === 'PUT') {
      const archive = sanitizeArchive(req.body && req.body.archive);
      if (!archive) {
        context.res = { status: 400, body: { ok: false, error: 'Invalid archive data' } };
        return;
      }
      const serialized = JSON.stringify(archive);
      if (serialized.length > MAX_ARCHIVE_SIZE) {
        context.res = { status: 400, body: { ok: false, error: 'Archive data too large' } };
        return;
      }

      // Save archive
      await client.upsertEntity({
        partitionKey: archivePartitionKey(gameId),
        rowKey: userId,
        gameId,
        data: serialized,
        updatedAt: new Date().toISOString(),
      }, 'Replace');

      // Update leaderboards from the latest run (first entry in history)
      if (archive.history && archive.history.length > 0) {
        const latestRun = archive.history[0];
        const userName = getUserName(req);
        try {
          await updateLeaderboards(client, latestRun, userName, gameId);
        } catch (lbErr) {
          context.log.warn('Leaderboard update failed:', lbErr.message);
        }
      }

      context.res = { status: 200, body: { ok: true, game: gameId, archive } };
      return;
    }

    context.res = { status: 405, body: { ok: false, error: 'Method not allowed' } };
  } catch (e) {
    context.log.error('Archive function error:', e);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error' } };
  }
};
