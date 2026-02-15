# System Patterns

## Architecture Overview
```
User calls console.agent()
         ↓
    Parse arguments (prompt, context, options)
         ↓
    Select persona (auto-detect from keywords or explicit)
         ↓
    Check rate limits / budget
         ↓
    Serialize context (handle Error objects, anonymize if enabled)
         ↓
    Auto-detect caller source file (stack trace → read file → add to context)
         ↓
  ┌──────┴──────┐
  │ Fire-forget │ Blocking mode
  ↓             ↓
Start async    Start async + return Promise
  ↓             ↓
Create ToolLoopAgent with:
  - model (google provider)
  - instructions (persona systemPrompt)
  - output (structured JSON schema via Output.object)
  - providerOptions (thinking config if specified)
  ↓
agent.generate({ prompt, timeout })
  ↓
Parse structured output (AgentResult) or fallback text parse
  ↓
Format + log to console ← Resolve Promise
```

## Key Design Patterns

### ToolLoopAgent Pattern (Vercel AI SDK)
```typescript
const agent = new ToolLoopAgent({
  model: google(modelName),
  instructions: persona.systemPrompt,
  output: Output.object({ schema: agentOutputSchema }),
  providerOptions: { google: { thinkingConfig: {...} } },
  onStepFinish: (step) => { /* collect tool calls */ },
});
const result = await agent.generate({ prompt, timeout });
```

### Proxy-Based Callable
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

### Caller Source File Detection
1. Parse Error stack trace → find originating file (skip internal frames)
2. Normalize ESM `file://` URLs to filesystem paths
3. Read source file (truncate at 100KB)
4. Format with line numbers + arrow marker on error line
5. Append to agent context for full code visibility

### Fire-and-Forget Pattern
Default mode — call starts async execution, returns promise but caller doesn't await:
```typescript
console.agent("task", data); // Runs in background, logs when done
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

### Structured Output via jsonSchema
```typescript
Output.object({
  schema: jsonSchema({
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'object', properties: { result: { type: 'string' } }, additionalProperties: true },
    },
  }),
});
```

### Content Anonymization Pipeline
Before sending to API:
1. Strip API keys (pattern: `[A-Za-z0-9_-]{20,}` near key/token/secret keywords)
2. Replace email addresses with `[EMAIL]`
3. Replace IP addresses with `[IP]`
4. Replace common secret patterns with `[REDACTED]`

### Token Bucket Rate Limiting
- Bucket fills at steady rate (calls per day / 86400 per second)
- Each call consumes one token
- Rejects when bucket is empty

### Budget Tracking
- Track daily token usage and estimated cost
- Hard cap prevents exceeding daily budget
- Reset at midnight UTC
