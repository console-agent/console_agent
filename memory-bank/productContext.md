# Product Context

## Why This Product Exists
Developers want agentic AI capabilities embedded directly in their runtime code — for debugging, security auditing, data validation, and decision-making — without the complexity of frameworks like Langchain or CrewAI.

## Problem It Solves
- **Agents are too complicated:** 100+ lines of boilerplate with existing frameworks
- **Wrong abstraction layer:** Existing tools are for chat apps, not runtime utilities
- **Context switching kills flow:** Switching to Cursor/Claude breaks development momentum
- **Trust issues:** Developers don't trust black-box agent execution

## How It Should Work
`console.agent(...)` should feel as natural as `console.log()`. Drop it anywhere in your code:
- **Fire-and-forget (default):** Returns immediately, logs results async
- **Blocking mode:** `await console.agent(...)` returns structured `AgentResult`
- **Persona shortcuts:** `console.agent.security()`, `.debug()`, `.architect()`
- **Zero config required:** Works out of the box with sensible defaults

## Target Users
- Full-stack developers (React/Next.js, Node/Express, TypeScript)
- Solo founders / indie hackers
- Platform engineers debugging production
- Security-conscious teams needing runtime validation

## Success Metrics
- 1,000+ weekly npm downloads within 3 months
- >40% of users execute ≥10 agent calls per session
- Zero blocking/latency complaints
- Featured on HN/Reddit with positive sentiment
