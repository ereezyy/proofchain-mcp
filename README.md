# ProofChain MCP Server

Give any AI agent direct access to ProofChain's compliance rail — audit trails, agent identity verification, and EU AI Act reporting, over the Model Context Protocol.

**ProofChain (https://proofchain.us)** is the compliance stack for AI agents: soulbound identity (AgentID v2), tamper-evident on-chain audit receipts, and EU AI Act Article 50 compliance an auditor can actually verify. This MCP server lets an agent query its own receipts — compliance without a human in the loop.

## Tools

| Tool | What it does |
|------|--------------|
| `get_agent_audit` | Pull the HXMP audit trail for a wallet on X1 — real soul records and compliance data |
| `verify_agent` | Check AgentID v2 soulbound status for a wallet |
| `get_compliance_report` | Get the compliance report for an agent (EU AI Act, SOC 2, GDPR) |
| `get_tollbooth_status` | Check x402 Agent Tollbooth payment status for an agent action |

## Install

Requires Node 18+. Run it locally against the public API:

```bash
git clone https://github.com/ereezyy/proofchain-mcp
cd proofchain-mcp
npm install
```

Then point your MCP client at it:

```json
{
  "mcpServers": {
    "proofchain": {
      "command": "node",
      "args": ["/path/to/proofchain-mcp/index.js"],
      "env": { "PROOFCHAIN_API": "https://proofchain.us/api" }
    }
  }
}
```

No API key required. `PROOFCHAIN_API` defaults to `https://proofchain.us/api`; point it at a self-hosted ProofChain instance if you run your own.

## Example

```text
User: does wallet FKwU1im...G9B have a soulbound AgentID?

Tool call: verify_agent { wallet: "FKwU1im523MSGnuJG6YLHEZu4rUGj3xqxHJ6ipQMBG9B" }
→ { "verified": true, ... }
```

## License

MIT. ProofChain is operated by Eddy Woods. Cheaper than the mistake.
