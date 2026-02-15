# Active Context

## Current Focus
v1.2.2 is published on npm. Landing page and API reference page are live at console-agent.github.io.

## Recent Changes (2026-02-15)
- **Version bump to 1.2.2**: Both TS and Python packages bumped
- **Landing page updates**: Added "Reference" nav link, updated Full Config section with `includeCallerSource` and File Attachments examples
- **API Reference page**: Created `reference.html` + `reference.css` — fetches docs.md from both JS and Python repos, renders with marked.js + Prism.js syntax highlighting, sticky sidebar TOC with scroll-spy
- **Dynamic GitHub link**: Nav GitHub icon switches between JS repo and Python repo based on JS/PY toggle
- **Fixed marked.js v12 compatibility**: Custom renderer functions updated to handle token-based API (heading, code, table)

## Current Phase
Post-v1.2.2 — Both JS and Python packages published. Website with full API reference live.

## What's Working
- All unit/integration/E2E tests pass (both JS and Python)
- npm package: `@console-agent/agent@1.2.2`
- PyPI package: `console-agent==1.2.2`
- Landing page: console-agent.github.io with JS/PY toggle
- Reference page: console-agent.github.io/reference.html with live docs
- GitHub Actions CI/CD for both npm and PyPI
- All features: personas, tools, budget, rate limiting, anonymization, caller source detection, file attachments, thinking mode, structured output

## What's Next
1. Add caching layer for repeated prompts
2. Add streaming support (v2.0)
3. Explore more personas (performance, testing, etc.)
4. Consider adding tool support when Gemini lifts JSON+tools restriction

## Key Repos
- **JS/TS**: github.com/console-agent/console_agent (npm: @console-agent/agent)
- **Python**: github.com/console-agent/console_agent_python (PyPI: console-agent)
- **Website**: github.com/console-agent/console-agent.github.io
