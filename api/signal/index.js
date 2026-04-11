'use strict';

const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'agentsignals';
const VALID_AGENTS = ['alpha', 'bravo'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

let tableClient;
async function getTableClient() {
  if (tableClient) return tableClient;
  const connStr = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING not configured');
  tableClient = TableClient.fromConnectionString(connStr, TABLE_NAME);
  await tableClient.createTable().catch(() => {});
  return tableClient;
}

function sanitizeAgent(value) {
  const v = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return VALID_AGENTS.includes(v) ? v : null;
}

module.exports = async function (context, req) {
  try {
    const client = await getTableClient();
    const agentParam = (req.query && req.query.agent) || 'all';
    const limit = Math.min(Math.max(parseInt(req.query && req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    let agents;
    if (agentParam === 'all') {
      agents = VALID_AGENTS;
    } else {
      const a = sanitizeAgent(agentParam);
      if (!a) {
        context.res = { status: 400, body: { ok: false, error: 'Invalid agent. Use alpha, bravo, or all.' } };
        return;
      }
      agents = [a];
    }

    const results = {};
    for (const agentId of agents) {
      const rows = [];
      const iter = client.listEntities({
        queryOptions: {
          filter: `PartitionKey eq 'agent-${agentId}'`,
          select: ['partitionKey', 'rowKey', 'status', 'morse', 'message', 'ts', 'agent'],
        },
      });
      for await (const entity of iter) {
        rows.push({
          agent: agentId,
          status: entity.status,
          morse: entity.morse,
          message: entity.message,
          ts: entity.ts,
          rowKey: entity.rowKey,
        });
      }
      rows.sort((a, b) => String(b.rowKey).localeCompare(String(a.rowKey)));
      results[agentId] = rows.slice(0, limit);
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: true, agents: agents, limit, signals: results },
    };
  } catch (err) {
    context.log.error('Signal read error:', err.message);
    context.res = { status: 500, body: { ok: false, error: 'Internal server error' } };
  }
};
