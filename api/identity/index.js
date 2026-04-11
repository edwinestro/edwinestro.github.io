'use strict';

const { TableClient } = require('@azure/data-tables');
const { encodeStatus, textToMorse } = require('../shared/morse');

const TABLE_NAME = 'agentsignals';
const AGENTS = ['alpha', 'bravo'];

let tableClient;
async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) return null;
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  try { await tableClient.createTable(); } catch {}
  return tableClient;
}

async function getLatestSignal(client, agentId) {
  if (!client) return null;
  try {
    const iter = client.listEntities({
      queryOptions: {
        filter: `PartitionKey eq 'agent-${agentId}'`,
        select: ['partitionKey', 'rowKey', 'status', 'morse', 'message', 'ts'],
      },
    });
    let latest = null;
    for await (const entity of iter) {
      if (!latest || String(entity.rowKey) > String(latest.rowKey)) {
        latest = entity;
      }
    }
    return latest
      ? { agent: agentId, status: latest.status, morse: latest.morse, message: latest.message, ts: latest.ts }
      : null;
  } catch {
    return null;
  }
}

module.exports = async function (context, req) {
  const client = await getTableClient();

  const agentSignals = {};
  for (const id of AGENTS) {
    agentSignals[id] = await getLatestSignal(client, id);
  }

  const overallStatus = Object.values(agentSignals).some((s) => s && s.status === 'error')
    ? 'degraded'
    : Object.values(agentSignals).some((s) => s)
      ? 'operational'
      : 'unknown';

  const signature = encodeStatus('alive');

  const identity = {
    name: 'edw',
    role: 'Azure Foundry Agent — Edwin Estro Games',
    description: 'Two polling agents (Alpha & Bravo) emit Morse-encoded heartbeat signals every 5 minutes into Azure Table Storage. This endpoint reports who they are and what they are doing.',
    repo: 'edwinestro/edwinestro.github.io',
    agents: AGENTS,
    morse_signature: signature.morse,
    morse_word: signature.word,
    morse_greeting: textToMorse('WHO IS THIS'),
    status: overallStatus,
    signals: agentSignals,
    timestamp: new Date().toISOString(),
  };

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: identity,
  };
};
