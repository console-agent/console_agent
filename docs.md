# @console-agent/agent — Documentation

## Table of Contents
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Personas](#personas)
- [Tools](#tools)
- [Configuration](#configuration)
- [Budget & Rate Limiting](#budget--rate-limiting)
- [Caller Source Detection](#caller-source-detection)
- [File Attachments](#file-attachments)
- [Privacy & Anonymization](#privacy--anonymization)
- [Thinking Mode](#thinking-mode)
- [Console Output](#console-output)
- [Testing](#testing)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
bun add @console-agent/agent @ai-sdk/google
# or
npm install @console-agent/agent @ai-sdk/google
```

### Set your API key

```bash
# Option 1: .env file
echo "GEMINI_API_KEY=your-key-here" >> .env

# Option 2: Environment variable
export GEMINI_API_KEY=your-key-here
```

Get a free API key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Quick Start (Zero Config)

```typescript
// Just import — console.agent is automatically available
import '@console-agent/agent';

// Fire-and-forget (default) — logs results, never blocks your app
console.agent("analyze this error", error);

// Await for structured results
const result = await console.agent("validate this data", records);
console.log(result.success, result.summary, result.data);
```

### Quick Start (With Config)

```typescript
import { init } from '@console-agent/agent';

init({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.5-flash-lite',
  mode: 'blocking',
  logLevel: 'info',
});

// Now use console.agent anywhere
const result = await console.agent("check for vulnerabilities", code);
```

---

## How It Works

```
console.agent("prompt", context, options)
         ↓
    Parse arguments (prompt string, context object, options)
         ↓
    Select persona (auto-detect from keywords, or explicit)
         ↓
    Anonymize content (strip secrets, PII if enabled)
         ↓
    Check rate limits & budget
         ↓
    Format prompt with persona system prompt + context
         ↓
  ┌──────────────────┬──────────────────┐
  │ Fire-and-forget  │  Blocking mode   │
  │ (default)        │  (await)         │
  ↓                  ↓                  │
  Log spinner        Return Promise ────┘
  ↓                  ↓
  Send to Gemini via ToolLoopAgent
  ↓
  Agent reasons + optionally uses tools (search, code exec)
  ↓
  Parse structured output (AgentResult)
  ↓
  Log results to console with colors/icons
  ↓
  Return AgentResult (if awaited)
```

---

## API Reference

### `init(config?: Partial<AgentConfig>)`

Configure the agent. Call once at app startup. Optional — sensible defaults work.

```typescript
import { init } from '@console-agent/agent';

init({
  apiKey: 'your-key',              // Or use GEMINI_API_KEY env var
  model: 'gemini-2.5-flash-lite',  // Default model
  persona: 'general',              // Default persona
  mode: 'fire-and-forget',         // 'fire-and-forget' | 'blocking'
  timeout: 10000,                  // ms
  anonymize: true,                 // Strip secrets/PII
  localOnly: false,                // Disable cloud tools
  dryRun: false,                   // Log without API call
  logLevel: 'info',                // 'silent' | 'errors' | 'info' | 'debug'
  budget: {
    maxCallsPerDay: 100,
    maxTokensPerCall: 8000,
    costCapDaily: 1.00,
  },
});
```

### `console.agent(prompt, context?, options?)`

The main API. Call it like `console.log()`.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `prompt` | `string` | What you want the agent to do |
| `context` | `any` (optional) | Data for the agent to analyze |
| `options` | `AgentCallOptions` (optional) | Per-call overrides |

**Returns:** `Promise<AgentResult>` (always — but in fire-and-forget mode the result logs to console)

```typescript
// Simple
console.agent("explain this error", error);

// With context object
console.agent("optimize this query", { sql: query, duration: "3.2s" });

// With per-call options
const result = await console.agent("analyze", data, {
  persona: 'security',
  model: 'gemini-3-flash-preview',
  tools: ['google_search'],
  thinking: { level: 'high', includeThoughts: true },
});
```

### `console.agent.security(prompt, context?, options?)`

Shortcut that forces the **security** persona.

```typescript
console.agent.security("check for SQL injection", userInput);
// Equivalent to: console.agent("check for SQL injection", userInput, { persona: 'security' })
```

### `console.agent.debug(prompt, context?, options?)`

Shortcut that forces the **debugger** persona.

```typescript
console.agent.debug("why is this slow?", { duration, query, cacheHit });
```

### `console.agent.architect(prompt, context?, options?)`

Shortcut that forces the **architect** persona.

```typescript
console.agent.architect("review this API design", { endpoint, handler });
```

---

## AgentResult

Every `console.agent()` call returns an `AgentResult`:

```typescript
interface AgentResult {
  success: boolean;           // Did the agent complete the task?
  summary: string;            // One-line human-readable conclusion
  reasoning?: string;         // Agent's thought process (if thinking enabled)
  data: Record<string, any>;  // Structured findings (key-value pairs)
  actions: string[];          // Steps/tools the agent used
  confidence: number;         // 0-1 confidence score
  metadata: {
    model: string;            // Model used (e.g., "gemini-2.5-flash-lite")
    tokensUsed: number;       // Total tokens consumed
    latencyMs: number;        // Wall clock time
    toolCalls: ToolCall[];    // Detailed tool call info
    cached: boolean;          // Whether response used cache
  };
}
```

**Using results in your app:**

```typescript
const result = await console.agent("validate this email", email);

if (!result.success) {
  throw new Error(result.summary);
}

if (result.confidence < 0.8) {
  console.warn("Low confidence:", result.summary);
}

// Use structured data
const { risk, recommendation } = result.data;
```

---

## Personas

### Available Personas

| Persona | Icon | System Role | Default Tools |
|---------|------|-------------|---------------|
| `general` | 🔍 | Senior full-stack engineer | code_execution, google_search |
| `security` | 🛡️ | OWASP security expert | google_search |
| `debugger` | 🐛 | Senior debugging expert | code_execution, google_search |
| `architect` | 🏗️ | Principal engineer | google_search |

### Auto-Detection

Personas auto-detect from keywords in your prompt:

| Keywords | Persona |
|----------|---------|
| security, vuln, exploit, injection, xss, csrf, owasp, audit | `security` |
| slow, perf, optimize, debug, error, crash, memory, leak, fix, trace | `debugger` |
| design, architecture, pattern, schema, scalab, microservice, system | `architect` |
| (no match) | Falls back to configured default |

**Priority:** security > debugger > architect > general

```typescript
// Auto-detects "security" persona
console.agent("check for SQL injection vulnerabilities", input);

// Auto-detects "debugger" persona
console.agent("why is this slow?", metrics);

// Force a specific persona
console.agent("analyze this", data, { persona: 'architect' });
```

---

## Tools

### Built-in Google Tools

These are Google's server-side tools — no local code execution:

#### `code_execution`
Generates and runs Python code in Google's sandbox.

**Use for:** Math, algorithms, data transformations, calculations.

```typescript
console.agent(
  "calculate the optimal batch size given these constraints",
  { totalItems: 1000000, memoryLimit: "4GB", cpuCores: 8 },
  { tools: ['code_execution'] }
);
```

#### `google_search`
Searches the web with source attribution.

**Use for:** Security research, fact-checking, library vulnerabilities, current info.

```typescript
console.agent.security(
  "check if lodash@4.17.20 has known vulnerabilities",
  {},
  { tools: ['google_search'] }
);
```

#### `file_analysis`
Process files (PDF, images, video).

**Use for:** Document analysis, OCR, image understanding.

### Disabling Tools

```typescript
// No tools at all
console.agent("just analyze this text", data, { tools: [] });

// Enterprise mode — disable all cloud tools globally
init({ localOnly: true });
```

---

## Configuration

### Full Config Reference

```typescript
interface AgentConfig {
  provider: 'google';              // Only Google in v1.0
  apiKey?: string;                 // API key (or use GEMINI_API_KEY env)
  model: string;                   // Model name
  persona: PersonaName;            // Default persona
  mode: 'fire-and-forget' | 'blocking';
  timeout: number;                 // ms
  budget: {
    maxCallsPerDay: number;
    maxTokensPerCall: number;
    costCapDaily: number;          // USD
  };
  anonymize: boolean;              // Strip PII/secrets
  localOnly: boolean;              // Disable cloud tools
  dryRun: boolean;                 // Log without API calls
  logLevel: 'silent' | 'errors' | 'info' | 'debug';
  safetySettings?: SafetySetting[];
}
```

### Defaults

```typescript
{
  provider: 'google',
  model: 'gemini-2.5-flash-lite',
  persona: 'general',
  mode: 'fire-and-forget',
  timeout: 10000,
  anonymize: true,
  localOnly: false,
  dryRun: false,
  logLevel: 'info',
  budget: {
    maxCallsPerDay: 100,
    maxTokensPerCall: 8000,
    costCapDaily: 1.00,
  },
}
```

### Per-Call Options

Override config for a single call:

```typescript
interface AgentCallOptions {
  persona?: PersonaName;
  model?: string;
  tools?: (string | ToolConfig)[];
  thinking?: {
    level?: 'minimal' | 'low' | 'medium' | 'high';
    budget?: number;         // Token budget for reasoning
    includeThoughts?: boolean;
  };
}
```

---

## Budget & Rate Limiting

### How It Works

- **maxCallsPerDay**: Hard limit on API calls per 24h period
- **maxTokensPerCall**: Caps output tokens per call
- **costCapDaily**: Estimated daily cost cap in USD

When limits are hit, `console.agent()` returns an error result immediately (no API call):

```typescript
{
  success: false,
  summary: "Rate limited: Daily call limit reached (100/100)",
  data: {},
  actions: [],
  confidence: 0,
  metadata: { tokensUsed: 0, latencyMs: 0, ... }
}
```

### Configuration

```typescript
init({
  budget: {
    maxCallsPerDay: 100,     // 100 calls per day
    maxTokensPerCall: 8000,  // 8K tokens max per call
    costCapDaily: 1.00,      // $1/day max
  },
});
```

### Cost Estimation

| Model | Input Cost | Output Cost |
|-------|-----------|-------------|
| gemini-2.5-flash-lite | ~$0.01/1M tokens | ~$0.04/1M tokens |
| gemini-3-flash-preview | ~$0.03/1M tokens | ~$0.12/1M tokens |

At the default budget (100 calls/day, 8K tokens/call):
- **Estimated max daily cost:** ~$0.03 with flash-lite

---

## Caller Source Detection

When debugging, the agent **automatically reads the source file** where `console.agent()` was called (or where an Error originated) and sends it as context to the AI model. This gives the agent full visibility into your code without you having to copy-paste anything.

### How It Works

1. **Error path**: When you pass an `Error` as context, the agent parses the stack trace to find the originating file, reads it, and sends the source code with line numbers (arrow marking the error line).
2. **Caller path**: Even without an error, the agent detects which file called `console.agent()` and includes that file's source.

### Example — Automatic Error Source Detection

```typescript
// billing.ts
function calculateInvoice(user: User) {
  const total = user.plan.seats * user.plan.pricePerSeat; // BUG: plan can be undefined!
  return { userId: user.id, amount: total };
}

try {
  calculateInvoice(freeUser);
} catch (error) {
  // Agent auto-reads billing.ts from the error stack trace
  // and sends the full file with line numbers to Gemini
  console.agent.debug("analyze this billing error", error);
}
```

The agent sees:
```
--- Source File: billing.ts (line 3) ---
      1 | function calculateInvoice(user: User) {
      2 |   // BUG: plan can be undefined!
 →    3 |   const total = user.plan.seats * user.plan.pricePerSeat;
      4 |   return { userId: user.id, amount: total };
      5 | }
```

### Configuration

```typescript
// Enabled by default
init({ includeCallerSource: true });

// Disable globally
init({ includeCallerSource: false });

// Disable per-call
console.agent("analyze", data, { includeCallerSource: false });
```

### Limits

- Files larger than **100KB** are truncated to prevent excessive token usage
- Only `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs`, `.cjs` source files are read
- Internal frames (node_modules, node internals) are skipped automatically

---

## File Attachments

You can explicitly attach files (PDFs, images, etc.) to any agent call using the `files` option:

```typescript
import { readFileSync } from 'fs';

// Attach a PDF document
const result = await console.agent(
  "What is an embedding model according to this document?",
  undefined,
  {
    files: [
      {
        data: readFileSync('./data/ai.pdf'),
        mediaType: 'application/pdf',
        fileName: 'ai.pdf',
      },
    ],
  }
);

// Attach an image
const result2 = await console.agent(
  "Describe what's in this screenshot",
  undefined,
  {
    files: [
      {
        data: readFileSync('./screenshot.png'),
        mediaType: 'image/png',
        fileName: 'screenshot.png',
      },
    ],
  }
);

// Multiple files at once
const result3 = await console.agent(
  "Compare these two documents",
  undefined,
  {
    files: [
      { data: readFileSync('./doc1.pdf'), mediaType: 'application/pdf', fileName: 'doc1.pdf' },
      { data: readFileSync('./doc2.pdf'), mediaType: 'application/pdf', fileName: 'doc2.pdf' },
    ],
  }
);
```

### Supported Media Types

| Type | Media Type |
|------|-----------|
| PDF | `application/pdf` |
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| WebP | `image/webp` |
| GIF | `image/gif` |
| Plain text | `text/plain` |

### FileAttachment Interface

```typescript
interface FileAttachment {
  data: Buffer | Uint8Array | string;  // File content (Buffer, base64 string, etc.)
  mediaType: string;                    // MIME type
  fileName?: string;                    // Optional name for context
}
```

---

## Privacy & Anonymization

### What Gets Stripped (when `anonymize: true`)

| Pattern | Replacement |
|---------|-------------|
| Email addresses | `[EMAIL]` |
| IPv4 addresses | `[IP]` |
| Bearer tokens | `Bearer [REDACTED_TOKEN]` |
| AWS access keys (AKIA...) | `[REDACTED_AWS_KEY]` |
| Private keys (PEM) | `[REDACTED_PRIVATE_KEY]` |
| Connection strings (postgres://, mongodb://) | `[REDACTED_CONNECTION_STRING]` |
| Environment variables (KEY=value) | `KEY=[REDACTED]` |

### Enterprise Mode

```typescript
init({
  anonymize: true,    // Strip all PII/secrets
  localOnly: true,    // No cloud tools (code execution, search)
});
```

---

## Thinking Mode

### Gemini 2.5 Models (Budget-based)

```typescript
const result = await console.agent(
  "optimize this algorithm",
  code,
  {
    model: 'gemini-2.5-flash-lite',
    thinking: {
      budget: 8192,              // Token budget for reasoning
      includeThoughts: true,
    },
  }
);
console.log(result.reasoning);   // Agent's thought process
```

### Gemini 3 Models (Level-based)

```typescript
const result = await console.agent(
  "design database schema for multi-tenant SaaS",
  requirements,
  {
    model: 'gemini-3-flash-preview',
    thinking: {
      level: 'high',             // 'minimal' | 'low' | 'medium' | 'high'
      includeThoughts: true,
    },
  }
);
```

---

## Console Output

### Fire-and-Forget Mode

```
[AGENT] - 🛡️ Security audit... check for SQL injection
[AGENT] ✓ 🛡️ Security audit Complete
[AGENT] ├─ ✓ SQL injection vulnerability detected
[AGENT] ├─ Tool: google_search
[AGENT] ├─ risk: HIGH
[AGENT] ├─ fix: Use parameterized queries
[AGENT] └─ confidence: 0.94 | 247ms | 156 tokens
```

### Log Levels

| Level | Shows |
|-------|-------|
| `silent` | Nothing |
| `errors` | Only errors |
| `info` | Spinners, results, summaries |
| `debug` | Everything (model, persona, tools, prompts) |

### Dry Run Mode

Test without API calls:

```typescript
init({ dryRun: true });

console.agent("test prompt", data);
// → [AGENT] DRY RUN 🔍 Analyzing
// → [AGENT] ├─ Persona: general
// → [AGENT] ├─ Prompt: test prompt
// → [AGENT] └─ (No API call made)
```

---

## Testing

### Run Unit Tests (no API key needed)

```bash
bun run test          # Run all unit + integration tests
bun run test:watch    # Watch mode
bun run test:coverage # With coverage report
```

### Run E2E Tests (requires API key)

```bash
# Set your API key in .env
echo "GEMINI_API_KEY=your-real-key" > .env

# Run E2E tests (30s timeout per test)
bun run test:e2e
```

E2E tests auto-skip if no valid API key is set.

### Test Structure

```
tests/
├── unit/               # No API key needed
│   ├── personas.test.ts
│   ├── anonymize.test.ts
│   ├── rate-limit.test.ts
│   ├── budget.test.ts
│   └── agent-config.test.ts
├── integration/        # No API key needed (uses dryRun)
│   └── agent-dryrun.test.ts
└── e2e/                # Requires GEMINI_API_KEY
    ├── agent-real.test.ts    # Direct executeAgent() calls
    └── full-flow.test.ts     # Full import → init() → console.agent() flow
```

---

## Architecture

### Package Structure

```
src/
├── index.ts              # Main export, init(), console.agent attachment
├── agent.ts              # Core engine (config, executeAgent, dry run)
├── types.ts              # All TypeScript interfaces
├── providers/
│   └── google.ts         # ToolLoopAgent + Output.object + jsonSchema
├── personas/
│   ├── index.ts          # Registry, detection, getPersona()
│   ├── debugger.ts       # 🐛 Debugging expert
│   ├── security.ts       # 🛡️ OWASP expert
│   ├── architect.ts      # 🏗️ Principal engineer
│   └── general.ts        # 🔍 Full-stack engineer
├── tools/
│   ├── index.ts          # Tool registry
│   ├── code-execution.ts # Google code execution
│   ├── search.ts         # Google search grounding
│   └── file-analysis.ts  # File/image/PDF processing
└── utils/
    ├── format.ts         # Console output (chalk + ora)
    ├── rate-limit.ts     # Token bucket algorithm
    ├── budget.ts         # Cost/call tracking
    └── anonymize.ts      # PII/secret stripping
```

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| AI Agent | `ToolLoopAgent` from Vercel AI SDK | Built-in tool loop, output parsing, step callbacks |
| Structured Output | `jsonSchema()` (not zod) | Works reliably across all module systems |
| Console Attachment | `Proxy` on `console.agent` | Callable function + persona methods (`.security()`, `.debug()`, `.architect()`) |
| Config | Module-level singleton | Simple, no external state, `init()` pattern |
| Bundler | `tsup` | Zero-config dual ESM/CJS |
| Rate Limiting | Token bucket | Simple, reset daily |
| Anonymization | Regex patterns | Fast, no external deps |

### Dependencies

- `@ai-sdk/google` — Google Gemini provider
- `ai` — Vercel AI SDK (ToolLoopAgent, Output, jsonSchema)
- `chalk` — Console colors
- `ora` — Terminal spinners

---

## Troubleshooting

### "GEMINI_API_KEY not set"

Set the API key via environment or `init()`:

```bash
export GEMINI_API_KEY=your-key
```

Or:

```typescript
init({ apiKey: 'your-key' });
```

### "Rate limited"

You've hit the daily call limit. Either:
- Wait for the daily reset
- Increase `budget.maxCallsPerDay` in `init()`

### "Daily cost cap reached"

Increase `budget.costCapDaily` in `init()`.

### Agent returns `success: false`

The agent encountered an error. Check `result.summary` for details:

```typescript
const result = await console.agent("task", data);
if (!result.success) {
  console.error("Agent error:", result.summary);
}
```

### Console output is noisy

```typescript
init({ logLevel: 'errors' });  // Only show errors
init({ logLevel: 'silent' });  // No output at all
```

### Testing without API calls

```typescript
init({ dryRun: true });
// All calls return mock results without hitting the API
```

---

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type { AgentResult, AgentConfig, AgentCallOptions, PersonaName, ToolCall } from '@console-agent/agent';
```

The package ships with `.d.ts` and `.d.cts` declaration files for both ESM and CJS.

---

## Models Reference

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| `gemini-2.5-flash-lite` | General purpose, fast | ~200ms | Very low |
| `gemini-3-flash-preview` | Complex reasoning, thinking mode | ~400ms | Low |

**Default:** `gemini-2.5-flash-lite` — handles 99% of use cases.

---

## License

MIT © Pavel
