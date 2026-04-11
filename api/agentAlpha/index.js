'use strict';

const { TableClient } = require('@azure/data-tables');
const { encodeStatus } = require('../shared/morse');

const TABLE_NAME = 'agentsignals';
const AGENT_ID = 'alpha';

let tableClient;
async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  await tableClient.createTable().catch(() => {});
  return tableClient;
}

function pickStatus() {
  const hour = new Date().getUTCHours();
  const roll = Math.random();
  if (roll < 0.03) return 'error';
  if (hour >= 6 && hour < 22) return roll < 0.4 ? 'processing' : 'alive';
  return roll < 0.6 ? 'idle' : 'alive';
}

module.exports = async function (context) {
  const now = new Date();
  const status = pickStatus();
  const { word, morse } = encodeStatus(status);

  const entity = {
    partitionKey: `agent-${AGENT_ID}`,
    rowKey: now.toISOString().replace(/[:.]/g, '-'),
    status,
    morse,
    message: word,
    ts: now.toISOString(),
    agent: AGENT_ID,
  };

  try {
    const client = await getTableClient();
    await client.upsertEntity(entity, 'Replace');
    context.log(`[${AGENT_ID}] Signal emitted: ${status} → ${morse}`);
  } catch (err) {
    context.log.error(`[${AGENT_ID}] Signal write failed:`, err.message);
  }
};
