const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agi3dgame';
const DEFAULT_GAME_ID = 'unsupervised-agi-3d';
const VALID = ['stability', 'ruptures', 'coherence', 'autonomy', 'xp', 'tasks', 'streak', 'tier', 'time'];

let tableClient;
async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  return tableClient;
}

function sanitizeGameId(value) {
  const cleaned = String(value || DEFAULT_GAME_ID)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return cleaned || DEFAULT_GAME_ID;
}

module.exports = async function (context, req) {
  const category = (req.query.category || 'stability').toLowerCase();
  const gameId = sanitizeGameId(req.query.game);
  if (!VALID.includes(category)) {
    context.res = { status: 400, body: { ok: false, error: 'Invalid category. Use: ' + VALID.join(', ') } };
    return;
  }

  try {
    const client = await getTableClient();
    const entries = [];
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq 'lb-${gameId}-${category}'` } });
    for await (const e of iter) {
      entries.push({
        gameId: e.gameId || gameId,
        playerName: e.playerName || 'Player',
        metric: Number(e.metric) || 0,
        score: Number(e.score) || 0,
        victory: Boolean(e.victory),
        runDuration: Number(e.runDuration) || 0,
        discoveries: Number(e.discoveries) || 0,
        rupturesResolved: Number(e.rupturesResolved) || 0,
        stability: Number(e.stability) || 0,
        autonomyRatio: Number(e.autonomyRatio) || 0,
        seedLabel: e.seedLabel || '',
        timestamp: Number(e.timestamp) || 0,
      });
    }
    entries.sort((a, b) => b.metric - a.metric);

    context.res = {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      body: { ok: true, game: gameId, category, entries },
    };
  } catch (e) {
    context.log.error('Leaderboard read error:', e);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error' } };
  }
};
