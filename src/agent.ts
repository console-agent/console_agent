/**
 * Core agent engine — orchestrates persona selection, budget checks,
 * anonymization, provider calls, and console output.
 */

import type { AgentConfig, AgentCallOptions, AgentResult, PersonaName } from './types.js';
import { detectPersona, getPersona } from './personas/index.js';
import { callGoogle } from './providers/google.js';
import { anonymizeValue } from './utils/anonymize.js';
import { RateLimiter } from './utils/rate-limit.js';
import { BudgetTracker } from './utils/budget.js';
import {
  startSpinner,
  stopSpinner,
  formatResult,
  formatError,
  formatBudgetWarning,
  formatRateLimitWarning,
  formatDryRun,
  logDebug,
} from './utils/format.js';

// ─── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: AgentConfig = {
  provider: 'google',
  model: 'gemini-2.5-flash-lite',
  persona: 'general',
  budget: {
    maxCallsPerDay: 100,
    maxTokensPerCall: 8000,
    costCapDaily: 1.0,
  },
  mode: 'fire-and-forget',
  timeout: 10000,
  anonymize: true,
  localOnly: false,
  dryRun: false,
  logLevel: 'info',
  safetySettings: [],
};

// ─── Singleton State ─────────────────────────────────────────────────────────

let config: AgentConfig = { ...DEFAULT_CONFIG };
let rateLimiter = new RateLimiter(config.budget.maxCallsPerDay);
let budgetTracker = new BudgetTracker(config.budget);

/**
 * Update the global configuration. Reinitializes rate limiter and budget tracker.
 */
export function updateConfig(newConfig: Partial<AgentConfig>): void {
  config = { ...DEFAULT_CONFIG, ...newConfig };

  // Merge budget with defaults
  if (newConfig.budget) {
    config.budget = { ...DEFAULT_CONFIG.budget, ...newConfig.budget };
  }

  // Reinitialize limiters with new config
  rateLimiter = new RateLimiter(config.budget.maxCallsPerDay);
  budgetTracker = new BudgetTracker(config.budget);
}

/**
 * Get the current config (for testing/inspection).
 */
export function getConfig(): AgentConfig {
  return { ...config };
}

// ─── Core Execution ──────────────────────────────────────────────────────────

/**
 * Execute an agent call. This is the core function behind console.agent().
 */
export async function executeAgent(
  prompt: string,
  context?: unknown,
  options?: AgentCallOptions,
): Promise<AgentResult> {
  // Determine persona
  const personaName: PersonaName = options?.persona ?? config.persona;
  const persona = options?.persona
    ? getPersona(options.persona)
    : detectPersona(prompt, personaName);

  logDebug(`Selected persona: ${persona.name} (${persona.icon})`);

  // Dry run — log without calling API
  if (config.dryRun) {
    formatDryRun(prompt, persona, context);
    return createDryRunResult(persona.name);
  }

  // Check rate limits
  if (!rateLimiter.tryConsume()) {
    formatRateLimitWarning();
    return createErrorResult('Rate limited — too many calls. Try again later.');
  }

  // Check budget
  const budgetCheck = budgetTracker.canMakeCall();
  if (!budgetCheck.allowed) {
    formatBudgetWarning(budgetCheck.reason!);
    return createErrorResult(budgetCheck.reason!);
  }

  // Anonymize context if enabled
  let contextStr = '';
  if (context !== undefined) {
    const processed = config.anonymize ? anonymizeValue(context) : context;
    contextStr = typeof processed === 'string' ? processed : JSON.stringify(processed, null, 2);
  }

  // Anonymize prompt if enabled
  const processedPrompt = config.anonymize
    ? (anonymizeValue(prompt) as string)
    : prompt;

  // Start spinner
  const spinner = startSpinner(persona, processedPrompt);

  try {
    // Execute with timeout
    const result = await Promise.race([
      callGoogle(processedPrompt, contextStr, persona, config, options),
      createTimeout(config.timeout),
    ]);

    // Record usage
    budgetTracker.recordUsage(
      result.metadata.tokensUsed,
      estimateCost(result.metadata.tokensUsed, result.metadata.model),
    );

    // Stop spinner and format output
    stopSpinner(spinner, result.success);
    formatResult(result, persona);

    return result;
  } catch (error) {
    stopSpinner(spinner, false);
    const err = error instanceof Error ? error : new Error(String(error));
    formatError(err, persona);
    return createErrorResult(err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms);
  });
}

function createErrorResult(message: string): AgentResult {
  return {
    success: false,
    summary: message,
    data: {},
    actions: [],
    confidence: 0,
    metadata: {
      model: config.model,
      tokensUsed: 0,
      latencyMs: 0,
      toolCalls: [],
      cached: false,
    },
  };
}

function createDryRunResult(personaName: string): AgentResult {
  return {
    success: true,
    summary: `[DRY RUN] Would have executed with ${personaName} persona`,
    data: { dryRun: true },
    actions: [],
    confidence: 1,
    metadata: {
      model: config.model,
      tokensUsed: 0,
      latencyMs: 0,
      toolCalls: [],
      cached: false,
    },
  };
}

/**
 * Rough cost estimation based on model and token count.
 */
function estimateCost(tokens: number, model: string): number {
  // Approximate cost per 1M tokens
  const costPer1M: Record<string, number> = {
    'gemini-2.5-flash-lite': 0.01,
    'gemini-3-flash-preview': 0.03,
  };
  const rate = costPer1M[model] ?? 0.01;
  return (tokens / 1_000_000) * rate;
}
