# ProofChain MCP Server

Give any AI agent direct access to ProofChain's compliance rail — audit trails, agent identity verification, and EU AI Act reporting, over the Model Context Protocol.

**ProofChain (https://proofchain.us)** is the compliance stack for AI agents: soulbound identity (AgentID v2), tamper-evident on-chain audit receipts, and EU AI Act Article 50 compliance an auditor can actually verify. This MCP server lets an agent query its own receipts — compliance without a human in the loop.

**Every read is notarized.** The agent's answer is not the evidence. Each tool call is recorded as a hash-chained audit event on ProofChain before the result is returned. An auditor verifies the read independently via the replay URL — no trust in the agent transcript required.

## Tools

| Tool | What it does |
|------|--------------|
| `get_agent_audit` | Pull the HXMP audit trail for a wallet on X1 — real soul records and compliance data |
| `verify_agent` | Check AgentID v2 soulbound status for a wallet |
| `get_compliance_report` | Get the compliance report for an agent (EU AI Act, SOC 2, GDPR) |
| `get_tollbooth_status` | Check x402 Agent Tollbooth payment status for an agent action |

## Signed-read contract

Every tool response is an envelope:

```json
{
  "data": { "...": "the raw API response" },
  "audit": {
    "receipt_id": "pc_ef8e1786ad997f4e",
    "hash": "f5d1e32f...",
    "prev_hash": "2149e685...",
    "ts": "2026-09-25T20:05:41.106Z",
    "replay_url": "https://proofchain.us/r/pc_ef8e1786ad997f4e",
    "regulation_clause": "EU AI Act Art 27 entity identification (AgentID v2)",
    "policy_decision": "UNVERIFIED"
  }
}
```

The audit event stored on chain contains, in its `context`:

- **regulation_clause** — the statutory basis of the read (real citations only: EU AI Act Art 12(1)/Art 27/Art 50, SOC 2 CC-series, GDPR Art 30/35; the tollbooth tool declares "no statutory clause")
- **dataset_version** — `api:<api version>;latest-event:<id>@<ts>` — pins which state of the dataset the read saw
- **query** — the exact arguments of the tool call
- **returned_receipt_ids** — the receipt ids the read returned (empty when the read returns none)
- **policy_decision** — e.g. `VERIFIED` / `UNVERIFIED` / `ISSUED` / `DISCLOSED`
- **mcp_server_version** — the server version that produced the read

**Verify without trusting the transcript:** open `replay_url` — the receipt page — or `GET https://proofchain.us/api/event/<receipt_id>` (returns the event plus its `prev_receipt` and `next_receipt` neighbors). Every event's `hash` covers its content and its `prev_hash`; the chain is append-only.

**Fail-closed:** if a read cannot be notarized, the tool returns `UNNOTARIZED_READ_REFUSED` instead of data. An unnotarized compliance read is unverifiable, so it is not returned. (Set `AUDIT_REQUIRED=false` to fail open — not recommended.)

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
→ { data: { verified: true, ... },
    audit: { receipt_id: "pc_...", replay_url: "https://proofchain.us/r/pc_...",
             regulation_clause: "EU AI Act Art 27 entity identification (AgentID v2)",
             policy_decision: "VERIFIED" } }
```

## License

MIT. ProofChain is operated by Eddy Woods. Cheaper than the mistake.
