# System Patterns

## Architecture Overview
```
User calls console.agent()
         ↓
    Parse arguments (prompt, context, options)
         ↓
    Select persona (auto-detect from keywords or explicit)
         ↓
    Format prompt with system prompt + context
         ↓
    Check rate limits / budget
         ↓
  ┌──────┴──────┐
  │ Fire-forget │ Blocking mode
  ↓             ↓
Log start     Log start + return Promise
  ↓             ↓
Send to Google AI via Vercel AI SDK (async)
  ↓             ↓
Process tool calls (code, search, files)
  ↓             ↓
Parse structured result (AgentResult)
  ↓             ↓
Format + log to console ← Resolve Promise
```

## Key Design Patterns

### Proxy-Based Callable
`console.agent` is a Proxy object that is both callable and has methods:
```typescript
console.agent("prompt", data)           // Direct call
console.agent.security("prompt", data)  // Persona method
console.agent.debug("prompt", data)     // Persona method
console.agent.architect("prompt", data) // Persona method
```

### Module-Level Singleton Config
```typescript
let globalConfig: AgentConfig = { ...defaults };
export function init(config: Partial<AgentConfig>) {
  globalConfig = { ...defaults, ...config };
}
```

### Fire-and-Forget Pattern
Default mode — call starts async execution but returns void immediately:
```typescript
console.agent("task", data); // Returns void, logs when done
```

### Blocking/Awaitable Pattern
When awaited, returns Promise<AgentResult>:
```typescript
const result = await console.agent("task", data); // Returns AgentResult
```

### Persona Auto-Detection
Keywords in prompt trigger persona overrides:
- "security", "vuln", "exploit", "injection", "xss", "csrf" → security
- "slow", "perf", "optimize", "debug", "error", "bug" → debugger
- "design", "architecture", "pattern", "scalab" → architect
- Default → general

### Token Bucket Rate Limiting
- Bucket fills at a steady rate (calls per day / 86400 per second)
- Each call consumes one token
- Rejects when bucket is empty

### Budget Tracking
- Track daily token usage and estimated cost
- Hard cap prevents exceeding daily budget
- Reset at midnight UTC

### Content Anonymization Pipeline
Before sending to API:
1. Strip API keys (pattern: `[A-Za-z0-9_-]{20,}` near key/token/secret keywords)
2. Replace email addresses with `[EMAIL]`
3. Replace IP addresses with `[IP]`
4. Replace common secret patterns with `[REDACTED]`
