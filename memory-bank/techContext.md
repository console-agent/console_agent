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
- **CI/CD:** GitHub Actions → npm publish with provenance (Sigstore)

## Package Identity
- **Name:** `@console-agent/agent`
- **Version:** 1.2.2
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

## Key Features (v1.2.x)
- **Caller source detection**: Auto-reads source file where `console.agent()` was called or where an Error originated (via stack trace parsing + ESM file:// URL normalization)
- **File attachments**: Pass files (PDF, images) via `files` option using Vercel AI SDK file handling
- **Verbose/quiet modes**: `verbose: true` shows full [AGENT] tree with tool calls, reasoning, metadata
- **Native Gemini tools**: google_search, code_execution, url_context (server-side, no local execution)
- **Structured output**: Zod schemas or plain JSON Schema for typed responses
- **Thinking mode**: Budget-based (Gemini 2.5) or level-based (Gemini 3)

## Structured Output Schema
Gemini requires OBJECT types to have non-empty `properties`. The schema uses `jsonSchema()` from `ai` package:
```typescript
Output.object({
  schema: jsonSchema({
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      summary: { type: 'string' },
      reasoning: { type: 'string' },
      data: {
        type: 'object',
        properties: { result: { type: 'string' } },
        additionalProperties: true,
      },
      actions: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['success', 'summary', 'data', 'actions', 'confidence'],
  }),
});
```

## Critical Gemini API Limitations
1. **Tools + JSON output incompatible**: Built-in tools (code_execution, google_search) cannot be used with `response_mime_type: application/json`. Using structured output means no built-in tools.
2. **OBJECT schema requires non-empty properties**: Every `type: 'object'` must have at least one property defined.
3. **Thinking config**: Must use `providerOptions: { google: { thinkingConfig: { thinkingBudget: N } } }`.

## Build Outputs
- `dist/index.js` — ESM (24KB)
- `dist/index.cjs` — CJS (25KB)
- `dist/index.d.ts` — Type declarations (5KB)
- `dist/index.d.cts` — CJS type declarations (5KB)
- `dist/*.map` — Source maps (~60KB each)

## Error Object Handling
`JSON.stringify(new Error("msg"))` returns `"{}"` because Error properties (message, stack, name) are non-enumerable. The agent explicitly extracts these via `Object.getOwnPropertyNames()` before serializing context.

## Website (console-agent.github.io)
- Static HTML/CSS/JS (no framework)
- GSAP animations, Prism.js syntax highlighting
- JS/PY toggle switches all code examples, terminal demos, GitHub link
- Reference page uses marked.js v12 to render docs.md from GitHub raw URLs
- Deployed via GitHub Pages
