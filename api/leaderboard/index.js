const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agi3dgame';
const VALID = ['stability', 'ruptures', 'coherence', 'autonomy'];

let tableClient;
async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('AzureWebJobsStorage not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  return tableClient;
}

module.exports = async function (context, req) {
  const category = (req.query.category || 'stability').toLowerCase();
  if (!VALID.includes(category)) {
    context.res = { status: 400, body: { ok: false, error: 'Invalid category. Use: ' + VALID.join(', ') } };
    return;
  }

  try {
    const client = await getTableClient();
    const entries = [];
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq 'lb-${category}'` } });
    for await (const e of iter) {
      entries.push({
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
      body: { ok: true, category, entries },
    };
  } catch (e) {
    context.log.error('Leaderboard read error:', e);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error' } };
  }
};
