/**
 * @console-agent/agent
 *
 * Drop console.agent(...) anywhere in your code to execute agentic workflows
 * — as easy as console.log()
 *
 * @example
 * ```ts
 * import { init } from '@console-agent/agent';
 *
 * // Optional configuration (works with sensible defaults)
 * init({ apiKey: process.env.GEMINI_API_KEY });
 *
 * // Fire-and-forget (default)
 * console.agent("analyze this error", error);
 *
 * // Blocking mode
 * const result = await console.agent("validate email format", email);
 *
 * // Persona shortcuts
 * console.agent.security("audit SQL query", query);
 * console.agent.debug("investigate slow query", { duration, sql });
 * console.agent.architect("review API design", endpoint);
 * ```
 */

import type { AgentConfig, AgentCallOptions, AgentResult, AgentFunction } from './types.js';
import { executeAgent, updateConfig, getConfig } from './agent.js';
import { setLogLevel } from './utils/format.js';

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type {
  AgentConfig,
  AgentCallOptions,
  AgentResult,
  AgentFunction,
  ResponseFormat,
  ToolCall,
  PersonaName,
  PersonaDefinition,
  ToolName,
  ToolConfig,
  ThinkingConfig,
  BudgetConfig,
  SafetySetting,
  HarmCategory,
  HarmBlockThreshold,
  LogLevel,
  GoogleSearchConfig,
} from './types.js';

export { DEFAULT_CONFIG } from './agent.js';

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Initialize console.agent with custom configuration.
 * Call this once at app startup. Works with sensible defaults if not called.
 *
 * @example
 * ```ts
 * init({
 *   apiKey: process.env.GEMINI_API_KEY,
 *   model: 'gemini-2.5-flash-lite',
 *   persona: 'debugger',
 *   budget: { maxCallsPerDay: 200 },
 * });
 * ```
 */
export function init(config: Partial<AgentConfig> = {}): void {
  updateConfig(config);

  const fullConfig = getConfig();
  setLogLevel(fullConfig.logLevel);

  // Attach console.agent
  attachConsoleAgent();
}

// ─── Console Agent Proxy ─────────────────────────────────────────────────────

/**
 * Create the console.agent callable with persona methods.
 * Uses a Proxy to make it both callable and have methods.
 */
function createAgentProxy(): AgentFunction {
  // The base function that handles direct calls
  const agentFn = (
    prompt: string,
    context?: unknown,
    options?: AgentCallOptions,
  ): Promise<AgentResult> => {
    const config = getConfig();

    if (config.mode === 'fire-and-forget' && !options?.mode) {
      // Fire-and-forget: start async execution but don't return the promise
      // We still return a Promise for type compatibility, but the caller doesn't await it
      const promise = executeAgent(prompt, context, options);
      // Catch unhandled rejections silently
      promise.catch(() => { /* fire-and-forget errors are logged to console */ });
      return promise;
    }

    // Blocking mode: return the promise for awaiting
    return executeAgent(prompt, context, options);
  };

  // Add persona shortcuts
  agentFn.security = (
    prompt: string,
    context?: unknown,
    options?: AgentCallOptions,
  ): Promise<AgentResult> => {
    return executeAgent(prompt, context, { ...options, persona: 'security' });
  };

  agentFn.debug = (
    prompt: string,
    context?: unknown,
    options?: AgentCallOptions,
  ): Promise<AgentResult> => {
    return executeAgent(prompt, context, { ...options, persona: 'debugger' });
  };

  agentFn.architect = (
    prompt: string,
    context?: unknown,
    options?: AgentCallOptions,
  ): Promise<AgentResult> => {
    return executeAgent(prompt, context, { ...options, persona: 'architect' });
  };

  return agentFn as AgentFunction;
}

// ─── Attach to console ───────────────────────────────────────────────────────

// Extend console type
declare global {
  interface Console {
    agent: AgentFunction;
  }
}

let attached = false;

function attachConsoleAgent(): void {
  if (attached) return;

  const agentProxy = createAgentProxy();
  // Attach to global console object
  (console as unknown as Record<string, unknown>).agent = agentProxy;
  attached = true;
}

// ─── Auto-attach with defaults on import ─────────────────────────────────────

// Auto-attach console.agent on first import with default config
attachConsoleAgent();
