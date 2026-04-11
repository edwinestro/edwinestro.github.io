'use strict';

const { TableClient } = require('@azure/data-tables');
const { encodeStatus } = require('../shared/morse');

const TABLE_NAME = 'agentsignals';
const AGENT_ID = 'bravo';

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
  const minute = new Date().getUTCMinutes();
  const roll = Math.random();
  if (roll < 0.02) return 'error';
  if (minute % 2 === 0) return roll < 0.5 ? 'processing' : 'alive';
  return roll < 0.5 ? 'idle' : 'alive';
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
