# Active Context

## Current Focus
Building v1.0.0 MVP of @consoleag/console-agent from scratch.

## Recent Decisions
- **Models:** gemini-2.5-flash-lite (default), gemini-3-flash-preview (high thinking)
- **Bundler:** tsup for dual ESM/CJS
- **Config pattern:** Module-level singleton with `init()`
- **console.agent:** Proxy-based callable with persona methods

## Current Phase
Phase 1: Project scaffolding — setting up package.json, tsconfig, directory structure, dev tooling.

## What's Working
- Memory bank initialized
- .clinerules configured

## What's Next
1. Create all project config files (package.json, tsconfig, tsup, vitest)
2. Implement core types (types.ts)
3. Build agent engine + Google provider
4. Add personas, tools, utilities
5. Write tests
6. Polish README

## Key Files to Create
```
src/index.ts         — Main export, init(), console.agent attachment
src/agent.ts         — Core execution engine
src/types.ts         — All TypeScript interfaces
src/providers/google.ts — Google AI integration
src/personas/*.ts    — Persona definitions
src/tools/*.ts       — Tool wrappers
src/utils/*.ts       — Format, rate-limit, budget, anonymize
tests/unit/*.test.ts — Unit tests
tests/integration/*.test.ts — Integration tests
```
