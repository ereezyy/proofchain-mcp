#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const API = process.env.PROOFCHAIN_API || 'https://proofchain.us/api';
const SERVER_VERSION = '0.2.0';
const AUDIT_AGENT = 'proofchain-mcp';
// Fail closed: if a read cannot be notarized, refuse to return data.
// Set AUDIT_REQUIRED=false to fail open (not recommended for compliance use).
const AUDIT_REQUIRED = (process.env.AUDIT_REQUIRED || 'true') !== 'false';

// Regulation clause per tool+framework. Only real citations — never invented.
const CLAUSES = {
  get_agent_audit: 'EU AI Act Art 12(1) record-keeping; Art 50 transparency',
  verify_agent: 'EU AI Act Art 27 entity identification (AgentID v2)',
  get_compliance_report: {
    'eu-ai-act': 'EU AI Act Art 50 transparency obligations',
    soc2: 'SOC 2 CC-series trust services criteria',
    gdpr: 'GDPR Art 30 records of processing; Art 35 DPIA',
    all: 'EU AI Act Art 50 / SOC 2 / GDPR — combined framework report',
    default: 'framework-specific compliance assessment'
  },
  get_tollbooth_status: 'x402 open payment protocol — economic access control (no statutory clause)'
};

async function datasetVersion() {
  let apiVersion = 'unknown', latestEvent = 'unknown';
  try {
    const p = await (await fetch(API + '/ping')).json();
    if (p && (p.version || p.name)) apiVersion = p.version || p.name;
  } catch (_) {}
  try {
    const e = await (await fetch(API + '/events?limit=1')).json();
    if (e && Array.isArray(e.events) && e.events.length) {
      latestEvent = e.events[0].id + '@' + e.events[0].ts;
    }
  } catch (_) {}
  return 'api:' + apiVersion + ';latest-event:' + latestEvent;
}

function clauseFor(tool, args) {
  if (tool !== 'get_compliance_report') return CLAUSES[tool];
  const fw = String(args.framework || 'all').toLowerCase();
  return CLAUSES.get_compliance_report[fw] || CLAUSES.get_compliance_report.default;
}

function extractReceiptIds(tool, data) {
  const ids = new Set();
  const push = (v) => { if (v) ids.add(String(v)); };
  try {
    if (tool === 'get_agent_audit') {
      (data.events || data.audit || []).forEach((ev) => push(ev.id || ev.receipt_id));
    } else if (tool === 'verify_agent') {
      push(data.agent && data.agent.agentId);
      push(data.soulRecordId || data.record_id);
      push(data.nftMint || data.agent && data.agent.nftMint);
    } else if (tool === 'get_compliance_report') {
      push(data.report_id || data.receipt_id);
      (data.sections || []).forEach((s) => push(s.receipt_id));
    } else if (tool === 'get_tollbooth_status') {
      push(data.receipt_id);
      push(data.toll && data.toll.id);
    }
    // generic fallback
    if (!ids.size) {
      push(data.receipt_id || data.id);
      if (Array.isArray(data.receipts)) data.receipts.forEach((r) => push(r.id || r));
    }
  } catch (_) {}
  return [...ids];
}

function policyDecision(tool, data) {
  if (tool === 'get_compliance_report') {
    const status = data && (data.status || data.overall || data.compliance && data.compliance.status);
    return status ? String(status).toUpperCase() : 'ISSUED';
  }
  if (tool === 'verify_agent') {
    const v = data && (data.verified === true || data.agent && data.agent.verified === true);
    return v ? 'VERIFIED' : (data && data.error ? 'NOT_FOUND' : 'UNVERIFIED');
  }
  return 'DISCLOSED';
}

async function notarize(tool, args, data) {
  const query = JSON.stringify(args || {});
  const context = JSON.stringify({
    regulation_clause: clauseFor(tool, args),
    dataset_version: await datasetVersion(),
    query: query,
    returned_receipt_ids: extractReceiptIds(tool, data),
    policy_decision: policyDecision(tool, data),
    mcp_server_version: SERVER_VERSION
  });
  const r = await fetch(API + '/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: AUDIT_AGENT,
      action: 'mcp_read:' + tool,
      context: context,
      source: 'proofchain-mcp'
    })
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('audit notarization failed: HTTP ' + r.status + ' ' + detail.slice(0, 120));
  }
  return r.json();
}

const server = new Server(
  { name: 'proofchain', version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_agent_audit',
      description: 'Get HXMP audit trail for wallet on X1. Every read is notarized as a hash-chained audit event; the response carries the receipt id and a replay URL an auditor can verify independently.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, limit: { type: 'number', default: 10 } },
        required: ['wallet']
      }
    },
    {
      name: 'verify_agent',
      description: 'Verify AgentID v2 status for a wallet. Notarized read — replay URL included in the response.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' } },
        required: ['wallet']
      }
    },
    {
      name: 'get_compliance_report',
      description: 'Get compliance report for the agent (EU AI Act, SOC2, GDPR). Notarized read with policy decision — replay URL included in the response.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, framework: { type: 'string', default: 'all' } },
        required: ['wallet']
      }
    },
    {
      name: 'get_tollbooth_status',
      description: 'Check tollbooth payment status or create a toll for agent action. Notarized read — replay URL included in the response.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, action: { type: 'string', default: 'status' } },
        required: ['wallet']
      }
    }
  ]
}));

const ENDPOINTS = {
  get_agent_audit: (args) => API + '/audit/' + args.wallet + '?limit=' + (args.limit || 10),
  verify_agent: (args) => API + '/agent/' + args.wallet,
  get_compliance_report: (args) => API + '/compliance/' + args.wallet + '/report?framework=' + (args.framework || 'all'),
  get_tollbooth_status: (args) => API + '/tollbooth/demo?wallet=' + args.wallet
};

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const url = ENDPOINTS[name](args);
  if (!url) throw new Error('Unknown tool: ' + name);

  const r = await fetch(url);
  const data = await r.json();

  let audit;
  try {
    audit = await notarize(name, args || {}, data);
  } catch (err) {
    if (AUDIT_REQUIRED) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({
          error: 'UNNOTARIZED_READ_REFUSED',
          detail: err.message,
          hint: 'This compliance read could not be recorded as an audit event, so its result cannot be verified by an auditor. Fix proofchain API connectivity (PROOFCHAIN_API) or set AUDIT_REQUIRED=false to bypass (not recommended).'
        }, null, 2) }]
      };
    }
    audit = null;
  }

  const envelope = {
    data: data,
    audit: audit ? {
      receipt_id: audit.id,
      hash: audit.hash,
      prev_hash: audit.prev_hash,
      ts: audit.ts,
      replay_url: audit.verify_url,
      regulation_clause: clauseFor(name, args || {}),
      policy_decision: policyDecision(name, data)
    } : { error: 'audit notarization skipped (AUDIT_REQUIRED=false)' }
  };
  return { content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }] };
});

const transport = new StdioServerTransport();
server.connect(transport);
