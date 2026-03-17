const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agi3darchives';
const MAX_HISTORY = 6;
const MAX_ARCHIVE_SIZE = 8192;

let tableClient;

async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('AzureWebJobsStorage not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  await tableClient.createTable(); // no-op if exists
  return tableClient;
}

/** Extract the authenticated userId from the SWA client principal header. */
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

module.exports = async function (context, req) {
  const userId = getUserId(req);
  if (!userId) {
    context.res = { status: 401, body: { ok: false, error: 'Not authenticated' } };
    return;
  }

  try {
    const client = await getTableClient();

    if (req.method === 'GET') {
      try {
        const entity = await client.getEntity('archive', userId);
        const archive = JSON.parse(entity.data);
        context.res = { status: 200, body: { ok: true, archive } };
      } catch (e) {
        if (e.statusCode === 404) {
          context.res = { status: 200, body: { ok: true, archive: null } };
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
      await client.upsertEntity({
        partitionKey: 'archive',
        rowKey: userId,
        data: serialized,
        updatedAt: new Date().toISOString(),
      }, 'Replace');
      context.res = { status: 200, body: { ok: true, archive } };
      return;
    }

    context.res = { status: 405, body: { ok: false, error: 'Method not allowed' } };
  } catch (e) {
    context.log.error('Archive function error:', e);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error' } };
  }
};
