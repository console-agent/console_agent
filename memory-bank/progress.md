# Progress

## Completed
- [x] Memory bank initialized
- [x] .clinerules configured
- [x] Project scaffolding (package.json, tsconfig, tsup, vitest, .gitignore)
- [x] Core types (src/types.ts) — all interfaces defined
- [x] Personas (debugger, security, architect, general) with auto-detection
- [x] Utilities (anonymize, rate-limit, budget, format)
- [x] Tools (code-execution, search, file-analysis)
- [x] Google AI provider with ToolLoopAgent + structured output
- [x] Agent engine with fire-and-forget / blocking modes
- [x] Main index with console.agent Proxy attachment + persona shortcuts
- [x] Build passes: ESM (24KB) + CJS (25KB) + DTS (5KB)
- [x] All 44 unit/integration tests passing (6 test suites)
- [x] All 14 E2E tests passing (2 test suites) — real Gemini API calls
- [x] README with full documentation
- [x] Package tarball created (consoleag-console-agent-1.0.0.tgz)
- [x] External test project validated (test-console-agent/code.js + code2.js)
- [x] Error object serialization fix (JSON.stringify(Error) → extract name/message/stack)
- [x] Shell config fix (bun PATH added to ~/.zshrc)
- [x] v1.1.0 — Verbose/quiet console output modes
- [x] v1.2.0 — Native Gemini tools (google_search, code_execution, url_context)
- [x] v1.2.1 — Caller source file auto-detection (reads source file from stack trace)
- [x] v1.2.1 — File attachments support (PDF, images via Agno File)
- [x] v1.2.1 — CI/CD pipeline (GitHub Actions → npm publish with provenance)
- [x] v1.2.1 — Comprehensive docs.md for reference page
- [x] v1.2.2 — Version bump (current)
- [x] Landing page (console-agent.github.io) with JS/PY toggle
- [x] Reference page (reference.html) fetching docs.md from GitHub with marked.js
- [x] Dynamic GitHub nav link (switches JS↔Python repo based on toggle)

## Architecture Notes
- Using `ToolLoopAgent` from Vercel AI SDK for multi-step reasoning + structured output
- `Output.object({ schema: jsonSchema({...}) })` for Gemini-compatible structured output
- Gemini built-in tools (code_execution, google_search) are INCOMPATIBLE with structured JSON output mode — tools are logged but not sent to API
- Thinking config uses `providerOptions: { google: { thinkingConfig: { ... } } }`
- Token count from `result.usage.totalTokens`
- Error objects need special serialization (non-enumerable properties)
- Models: gemini-2.5-flash-lite (default), gemini-3-flash-preview (high thinking)
- bun as package manager (not npm); PATH must be in ~/.zshrc for macOS

## Known Issues
- Gemini built-in tools (code_execution, google_search) cannot be used alongside structured JSON output (`response_mime_type: application/json`). This is a Gemini API limitation, not a code bug.
- Model sometimes returns `success: false` for security audits and debug analysis (when it finds a vulnerability/bug), which is semantically correct but test assertions needed adjustment.

## Next Steps
- Add caching layer for repeated prompts
- Consider adding tool support when Gemini lifts the JSON+tools restriction
- Add streaming support (v2.0)
- Explore more personas (performance, testing, etc.)
