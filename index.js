#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const API = process.env.PROOFCHAIN_API || 'https://proofchain.us/api';

const server = new Server(
  { name: 'proofchain', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_agent_audit',
      description: 'Get HXMP audit trail for wallet on X1. Returns real soul records and compliance data.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, limit: { type: 'number', default: 10 } },
        required: ['wallet']
      }
    },
    {
      name: 'verify_agent',
      description: 'Verify AgentID v2 status for a wallet.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' } },
        required: ['wallet']
      }
    },
    {
      name: 'get_compliance_report',
      description: 'Get compliance report for the agent (EU AI Act, SOC2, GDPR).',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, framework: { type: 'string', default: 'all' } },
        required: ['wallet']
      }
    },
    {
      name: 'get_tollbooth_status',
      description: 'Check tollbooth payment status or create a toll for agent action.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, action: { type: 'string', default: 'status' } },
        required: ['wallet']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === 'get_agent_audit') {
    const r = await fetch(API + '/audit/' + args.wallet + '?limit=' + (args.limit || 10));
    const data = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
  if (name === 'verify_agent') {
    const r = await fetch(API + '/agent/' + args.wallet);
    const data = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
  if (name === 'get_compliance_report') {
    const r = await fetch(API + '/compliance/' + args.wallet + '/report?framework=' + (args.framework || 'all'));
    const data = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
  if (name === 'get_tollbooth_status') {
    const r = await fetch(API + '/tollbooth/demo?wallet=' + args.wallet);
    const data = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
  throw new Error('Unknown tool: ' + name);
});

const transport = new StdioServerTransport();
server.connect(transport);
