# Tech Context

## Tech Stack
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js >=18.0.0 (no browser support in v1.0)
- **Package Manager:** bun (not npm; PATH must be in ~/.zshrc on macOS)
- **AI SDK:** Vercel AI SDK (`ai` ^6.0.0 + `@ai-sdk/google` ^1.2.23)
- **AI Pattern:** `ToolLoopAgent` for multi-step reasoning with structured output
- **Bundler:** tsup (dual ESM/CJS output)
- **Testing:** vitest (44 unit/integration + 14 E2E tests)
- **Console styling:** chalk v5 (ESM), ora v8 (spinners)

## Package Identity
- **Name:** `@console-agent/agent`
- **Version:** 1.0.0
- **License:** MIT
- **Node engines:** >=18.0.0

## Key Dependencies
```json
{
  "dependencies": {
    "@ai-sdk/google": "^1.2.23",
    "ai": "^6.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "vitest": "^4.0.0"
  }
}
```

## Supported Google Models
| Model | Speed | Use Case | Default |
|-------|-------|----------|---------|
| gemini-2.5-flash-lite | ~1-2s | Fast, cheap, general purpose | ✅ Yes |
| gemini-3-flash-preview | ~7-10s | High thinking, complex reasoning | No |

## Structured Output Schema
Gemini requires OBJECT types to have non-empty `properties`. The schema uses `jsonSchema()` from `ai` package:
```typescript
const schema = jsonSchema({
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    summary: { type: 'string' },
    reasoning: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        result: { type: 'string' }  // REQUIRED: non-empty properties for OBJECT type
      },
      additionalProperties: true,
    },
    actions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['success', 'summary', 'data', 'actions', 'confidence'],
});
```

## Critical Gemini API Limitations
1. **Tools + JSON output incompatible**: Built-in tools (code_execution, google_search) cannot be used with `response_mime_type: application/json`. Using structured output means no built-in tools.
2. **OBJECT schema requires non-empty properties**: Every `type: 'object'` must have at least one property defined.
3. **Thinking config**: Must use `providerOptions: { google: { thinkingConfig: { thinkingBudget: N } } }` — NOT nested under `thinkingConfig` directly.

## Build Outputs
- `dist/index.js` — ESM (24KB)
- `dist/index.cjs` — CJS (25KB)
- `dist/index.d.ts` — Type declarations (5KB)
- `dist/index.d.cts` — CJS type declarations (5KB)
- `dist/*.map` — Source maps (~60KB each)

## Error Object Handling
`JSON.stringify(new Error("msg"))` returns `"{}"` because Error properties (message, stack, name) are non-enumerable. The agent explicitly extracts these via `Object.getOwnPropertyNames()` before serializing context.
