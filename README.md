# @console-agent/agent

> Drop `console.agent(...)` anywhere in your code to execute agentic workflows — as easy as `console.log()`

[![npm](https://img.shields.io/npm/v/@console-agent/agent)](https://www.npmjs.com/package/@console-agent/agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

- **Agents are too complicated.** Langchain requires 100+ lines of boilerplate.
- **Wrong abstraction layer.** Existing tools are for chat apps, not runtime utilities.
- **console.agent is the jQuery of agents.** Simple API, powerful capabilities.

## Install

```bash
bun add @console-agent/agent
# or
npm install @console-agent/agent
```

## Quick Start

```typescript
import '@console-agent/agent';

// That's it! console.agent is now available everywhere.

// Fire-and-forget (default) — never blocks your app
console.agent("analyze this error", error);

// Blocking mode — await for structured results
const result = await console.agent("validate email format", email);
if (!result.success) throw new Error(result.summary);

// Persona shortcuts
console.agent.security("check for SQL injection", userInput);
console.agent.debug("why is this slow?", { duration, query });
console.agent.architect("review this API design", endpoint);
```

## Configuration

```typescript
import { init } from '@console-agent/agent';

init({
  apiKey: process.env.GEMINI_API_KEY,    // Or set GEMINI_API_KEY env var
  model: 'gemini-2.5-flash-lite',        // Default (fast & cheap)
  persona: 'general',                     // 'debugger' | 'security' | 'architect' | 'general'
  mode: 'fire-and-forget',               // 'fire-and-forget' | 'blocking'
  timeout: 10000,                         // ms

  budget: {
    maxCallsPerDay: 100,
    maxTokensPerCall: 8000,
    costCapDaily: 1.00,                   // USD
  },

  anonymize: true,                        // Auto-strip secrets/PII
  localOnly: false,                       // Disable cloud tools
  dryRun: false,                          // Log without calling API
  logLevel: 'info',                       // 'silent' | 'errors' | 'info' | 'debug'
});
```

> **Zero config works!** Just set `GEMINI_API_KEY` env var and import the package.

## Models

| Model | Use Case | Default |
|-------|----------|---------|
| `gemini-2.5-flash-lite` | Fast, cheap, general purpose | ✅ |
| `gemini-3-flash-preview` | High thinking, complex reasoning | |

```typescript
// Use high-thinking model for complex tasks
const result = await console.agent(
  "design optimal database schema",
  requirements,
  {
    model: 'gemini-3-flash-preview',
    thinking: { level: 'high', includeThoughts: true },
  }
);
console.log(result.reasoning); // Agent's thought process
```

## Personas

Personas auto-detect from prompt keywords, or set explicitly:

| Persona | Icon | Auto-detects | System Role |
|---------|------|--------------|-------------|
| `security` | 🛡️ | "injection", "xss", "vulnerability" | OWASP security expert |
| `debugger` | 🐛 | "slow", "error", "optimize" | Senior debugging expert |
| `architect` | 🏗️ | "design", "architecture", "schema" | Principal engineer |
| `general` | 🔍 | (default fallback) | Full-stack senior engineer |

## Built-in Tools

Google's built-in tools are enabled per-persona:

- **code_execution** — Run Python in sandbox (math, algorithms, data transforms)
- **google_search** — Real-time search grounding with source attribution
- **file_analysis** — PDF, images, video processing

```typescript
// Explicit tool selection
console.agent(
  "research this company",
  { domain: "acme.com" },
  { tools: ['google_search', 'code_execution'] }
);
```

## Return Type

When awaited, `console.agent()` returns a structured `AgentResult`:

```typescript
interface AgentResult {
  success: boolean;           // Overall task success
  summary: string;            // Human-readable conclusion
  reasoning?: string;         // Agent's thought process
  data: Record<string, any>;  // Structured findings
  actions: string[];          // Tools used / steps taken
  confidence: number;         // 0-1 confidence score
  metadata: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
    toolCalls: ToolCall[];
    cached: boolean;
  };
}
```

## Console Output

```
[AGENT] 🛡️ Security audit Complete
[AGENT] ├─ ✓ HIGH RISK: SQL injection detected in user input
[AGENT] ├─ Tool: google_search
[AGENT] ├─ vulnerability: SQL Injection via unsanitized input
[AGENT] ├─ fix: Use parameterized queries
[AGENT] └─ confidence: 0.94 | 247ms | 156 tokens
```

## Safety & Privacy

```typescript
init({
  // Auto-strips API keys, emails, IPs, secrets before sending
  anonymize: true,

  // Disable all cloud tools (code execution, search)
  localOnly: true,

  // Safety filters
  safetySettings: [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  ],
});
```

## Budget Controls

Hard limits prevent cost explosion:

```typescript
init({
  budget: {
    maxCallsPerDay: 100,     // Rate limit
    maxTokensPerCall: 8000,  // Per-call cap
    costCapDaily: 1.00,      // Hard daily USD cap
  },
});
```

## Use Cases

```typescript
// 🛡️ Security auditing
console.agent.security("check for SQL injection", userInput);

// 🐛 Debugging
console.agent.debug("why is this slow?", { duration, query, cacheHit });

// 📊 Data validation
const result = await console.agent("validate this batch meets schema", records);

// 🏗️ Architecture review
console.agent.architect("review this API design", { endpoint, handler });

// 🔢 Mathematical reasoning
const calc = await console.agent("calculate optimal batch size", metrics,
  { tools: ['code_execution'] }
);
```

## Development

```bash
bun install          # Install dependencies
bun run build        # Build ESM + CJS + types
bun run test         # Run tests
bun run test:watch   # Watch mode
bun run lint         # Type check
```

## License

MIT © Pavel
