const { BlobServiceClient } = require('@azure/storage-blob');

function sanitizeGameId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'unknown';
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const gid = sanitizeGameId(body.game);
  const vote = body.vote === 'up' ? 'up' : body.vote === 'down' ? 'down' : null;

  if (!gid || !vote) {
    context.res = { status: 400, body: { ok: false, error: 'game and vote (up/down) required' } };
    return;
  }

  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) {
    context.res = { status: 500, body: { ok: false, error: 'STORAGE_CONNECTION_STRING or AzureWebJobsStorage not configured' } };
    return;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient('upvotes');
    await containerClient.createIfNotExists();

    let userId = 'anon';
    const header = req.headers && (req.headers['x-ms-client-principal'] || req.headers['x-ms-client-principal-name']);
    if (header) {
      try {
        const decoded = JSON.parse(Buffer.from(req.headers['x-ms-client-principal'], 'base64').toString('utf8'));
        userId = decoded.userId || decoded.userId || 'anon';
      } catch (e) { /* fallthrough */ }
    }
    userId = body.userId || userId || 'anon';

    const safeUser = String(userId).replace(/[^a-z0-9-_]/gi, '').slice(0, 64) || 'anon';
    const filename = `${gid}/${Date.now()}-${safeUser}.json`;

    const payload = {
      game: gid,
      vote,
      userId: safeUser,
      reason: body.reason || '',
      timestamp: new Date().toISOString()
    };

    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    await blockBlobClient.uploadData(Buffer.from(JSON.stringify(payload)), {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    context.res = { status: 200, body: { ok: true, saved: true, path: filename } };
  } catch (e) {
    context.log.error('voteBlob error', e.message || e);
    context.res = { status: 500, body: { ok: false, error: e.message || String(e) } };
  }
};
