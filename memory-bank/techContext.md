# Tech Context

## Tech Stack
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js (no browser support in v1.0)
- **AI SDK:** Vercel AI SDK (`ai` ^6.0.0 + `@ai-sdk/google` ^1.2.23)
- **Bundler:** tsup (dual ESM/CJS output)
- **Testing:** vitest
- **Console styling:** chalk v5 (ESM), ora v8 (spinners)

## Package Identity
- **Name:** `@consoleag/console-agent`
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
    "vitest": "^1.2.0"
  }
}
```

## Supported Google Models
| Model | Speed | Use Case | Default |
|-------|-------|----------|---------|
| gemini-2.5-flash-lite | ~200ms | Fast, cheap, general purpose | ✅ Yes |
| gemini-3-flash-preview | ~400ms | High thinking, complex reasoning | No |

## Built-in Tools (Google)
- **code_execution** — Run Python code in sandbox
- **google_search** — Search grounding with source attribution
- **file_analysis** — PDF, images, video processing

## Build Outputs
- `dist/index.mjs` — ESM
- `dist/index.cjs` — CJS
- `dist/index.d.ts` — Type declarations
