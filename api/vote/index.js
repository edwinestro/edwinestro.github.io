const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agi3dgame';
let tableClient;

async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING not configured');
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
  } catch { return null; }
}

function getUserName(req) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) return 'Player';
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return decoded.userDetails || 'Player';
  } catch { return 'Player'; }
}

function sanitizeGameId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'unknown';
}

function sanitizeReason(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[<>&"']/g, '').slice(0, 200);
}

// Partition key for vote tallies per game
function tallyPartitionKey(gameId) { return `votes-${gameId}`; }
// Partition key for individual user votes
function userVotePartitionKey(gameId) { return `uservote-${gameId}`; }

module.exports = async function (context, req) {
  const userId = getUserId(req);
  if (!userId) {
    context.res = { status: 401, body: { ok: false, error: 'Not authenticated' } };
    return;
  }

  try {
    const client = await getTableClient();

    // GET /api/vote?game=all  → returns tallies for all games
    // GET /api/vote?game=<id> → returns tally + user's own vote for that game
    if (req.method === 'GET') {
      const gameId = req.query?.game;

      if (gameId === 'all') {
        // Fetch all vote tallies
        const tallies = {};
        const iter = client.listEntities({
          queryOptions: { filter: "PartitionKey ge 'votes-' and PartitionKey lt 'votes-~'" }
        });
        for await (const e of iter) {
          const gid = e.partitionKey.replace('votes-', '');
          tallies[gid] = { up: Number(e.up) || 0, down: Number(e.down) || 0 };
        }
        context.res = { status: 200, body: { ok: true, tallies } };
        return;
      }

      if (gameId) {
        const gid = sanitizeGameId(gameId);
        let tally = { up: 0, down: 0 };
        let userVote = null;
        try {
          const te = await client.getEntity(tallyPartitionKey(gid), 'tally');
          tally = { up: Number(te.up) || 0, down: Number(te.down) || 0 };
        } catch (e) { if (e.statusCode !== 404) throw e; }
        try {
          const ue = await client.getEntity(userVotePartitionKey(gid), userId);
          userVote = { vote: ue.vote, reason: ue.reason || '' };
        } catch (e) { if (e.statusCode !== 404) throw e; }
        context.res = { status: 200, body: { ok: true, game: gid, tally, userVote } };
        return;
      }

      context.res = { status: 400, body: { ok: false, error: 'game parameter required' } };
      return;
    }

    // PUT /api/vote  → cast or change vote
    // Body: { game: "id", vote: "up"|"down", reason: "..." (required for down) }
    if (req.method === 'PUT') {
      const body = req.body || {};
      const gid = sanitizeGameId(body.game);
      const vote = body.vote === 'up' ? 'up' : body.vote === 'down' ? 'down' : null;

      if (!gid || !vote) {
        context.res = { status: 400, body: { ok: false, error: 'game and vote (up/down) required' } };
        return;
      }

      // Downvote requires a reason
      if (vote === 'down' && !body.reason) {
        context.res = { status: 400, body: { ok: false, error: 'Reason required for downvote' } };
        return;
      }

      const reason = vote === 'down' ? sanitizeReason(body.reason) : '';

      // Check if user already voted on this game
      let prevVote = null;
      try {
        const prev = await client.getEntity(userVotePartitionKey(gid), userId);
        prevVote = prev.vote;
      } catch (e) {
        // 404 = no previous vote (expected)
        if (!e.statusCode && e.code !== 'ResourceNotFound') {
          if (!(e.message || '').includes('404') && !(e.message || '').includes('NotFound')) throw e;
        } else if (e.statusCode && e.statusCode !== 404) throw e;
      }

      // Get current tally
      let tally;
      try {
        tally = await client.getEntity(tallyPartitionKey(gid), 'tally');
      } catch (e) {
        const is404 = e.statusCode === 404 || e.code === 'ResourceNotFound' || (e.message || '').includes('404') || (e.message || '').includes('NotFound');
        if (is404) {
          tally = { partitionKey: tallyPartitionKey(gid), rowKey: 'tally', up: 0, down: 0 };
        } else throw e;
      }

      // Adjust tally: remove previous vote, add new vote
      let up = Number(tally.up) || 0;
      let down = Number(tally.down) || 0;
      if (prevVote === 'up') up = Math.max(0, up - 1);
      if (prevVote === 'down') down = Math.max(0, down - 1);
      if (vote === 'up') up++;
      if (vote === 'down') down++;

      // Save tally
      await client.upsertEntity({
        partitionKey: tallyPartitionKey(gid),
        rowKey: 'tally',
        up, down,
      }, 'Replace');

      // Save user vote
      await client.upsertEntity({
        partitionKey: userVotePartitionKey(gid),
        rowKey: userId,
        vote,
        reason,
        playerName: getUserName(req).slice(0, 50),
        timestamp: Date.now(),
      }, 'Replace');

      context.res = { status: 200, body: { ok: true, game: gid, tally: { up, down }, userVote: { vote, reason } } };
      return;
    }

    // DELETE /api/vote?game=<id>  → remove user's vote
    if (req.method === 'DELETE') {
      const gid = sanitizeGameId(req.query?.game);
      if (!gid) {
        context.res = { status: 400, body: { ok: false, error: 'game parameter required' } };
        return;
      }

      let prevVote = null;
      try {
        const prev = await client.getEntity(userVotePartitionKey(gid), userId);
        prevVote = prev.vote;
        await client.deleteEntity(userVotePartitionKey(gid), userId);
      } catch (e) {
        const is404 = e.statusCode === 404 || e.code === 'ResourceNotFound' || (e.message || '').includes('404');
        if (!is404) throw e;
      }

      if (prevVote) {
        let tally;
        try { tally = await client.getEntity(tallyPartitionKey(gid), 'tally'); } catch {
        tally = { partitionKey: tallyPartitionKey(gid), rowKey: 'tally', up: 0, down: 0 };
      }
        let up = Number(tally.up) || 0, down = Number(tally.down) || 0;
        if (prevVote === 'up') up = Math.max(0, up - 1);
        if (prevVote === 'down') down = Math.max(0, down - 1);
        await client.upsertEntity({ partitionKey: tallyPartitionKey(gid), rowKey: 'tally', up, down }, 'Replace');
      }

      context.res = { status: 200, body: { ok: true, game: gid, removed: true } };
      return;
    }

    context.res = { status: 405, body: { ok: false, error: 'Method not allowed' } };
  } catch (e) {
    context.log.error('Vote function error:', e.message, e.code, e.statusCode, e.stack?.split('\n')[0]);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error', detail: e.message } };
  }
};
