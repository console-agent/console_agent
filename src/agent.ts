/**
 * Core agent engine — orchestrates persona selection, budget checks,
 * anonymization, provider calls, and console output.
 */

import type { AgentConfig, AgentCallOptions, AgentResult, PersonaName } from './types.js';
import { detectPersona, getPersona } from './personas/index.js';
import { callGoogle } from './providers/google.js';
import { callOllama } from './providers/ollama.js';
import { anonymizeValue } from './utils/anonymize.js';
import { RateLimiter } from './utils/rate-limit.js';
import { BudgetTracker } from './utils/budget.js';
import {
  getCallerFile,
  getErrorSourceFile,
  type SourceFileInfo,
} from './utils/caller-file.js';
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
  ollamaHost: 'http://localhost:11434',
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
  verbose: false,
  safetySettings: [],
  includeCallerSource: true,
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

  // Resolve verbose flag: per-call override > global config
  const verbose = options?.verbose ?? config.verbose;

  logDebug(`Selected persona: ${persona.name} (${persona.icon})`);

  // Dry run — log without calling API
  if (config.dryRun) {
    formatDryRun(prompt, persona, context, verbose);
    return createDryRunResult(persona.name);
  }

  // Check rate limits
  if (!rateLimiter.tryConsume()) {
    formatRateLimitWarning(verbose);
    return createErrorResult('Rate limited — too many calls. Try again later.');
  }

  // Check budget
  const budgetCheck = budgetTracker.canMakeCall();
  if (!budgetCheck.allowed) {
    formatBudgetWarning(budgetCheck.reason!, verbose);
    return createErrorResult(budgetCheck.reason!);
  }

  // Anonymize context if enabled
  let contextStr = '';
  if (context !== undefined) {
    const processed = config.anonymize ? anonymizeValue(context) : context;
    contextStr = typeof processed === 'string'
      ? processed
      : JSON.stringify(processed, null, 2);

    // Handle Error objects: JSON.stringify(Error) returns "{}" because
    // message/stack/name are non-enumerable. Extract them explicitly.
    if (context instanceof Error) {
      const errObj = {
        name: context.name,
        message: context.message,
        stack: context.stack,
        ...(typeof context === 'object' ? Object.getOwnPropertyNames(context).reduce((acc, key) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc as any)[key] = (context as any)[key];
          return acc;
        }, {} as Record<string, unknown>) : {}),
      };
      const processed2 = config.anonymize ? anonymizeValue(errObj) : errObj;
      contextStr = typeof processed2 === 'string' ? processed2 : JSON.stringify(processed2, null, 2);
    }
  }

  // Anonymize prompt if enabled
  const processedPrompt = config.anonymize
    ? (anonymizeValue(prompt) as string)
    : prompt;

  // ─── Auto-detect caller source file ──────────────────────────────────────
  const shouldIncludeSource = options?.includeCallerSource ?? config.includeCallerSource;
  let sourceFile: SourceFileInfo | null = null;

  if (shouldIncludeSource) {
    // Priority 1: If context is an Error, get the file where the error originated
    if (context instanceof Error) {
      sourceFile = getErrorSourceFile(context);
      if (sourceFile) {
        logDebug(`Auto-detected error source file: ${sourceFile.fileName} (line ${sourceFile.line})`);
      }
    }

    // Priority 2: If no error source, get the caller file (where console.agent was called)
    if (!sourceFile) {
      sourceFile = getCallerFile();
      if (sourceFile) {
        logDebug(`Auto-detected caller file: ${sourceFile.fileName} (line ${sourceFile.line})`);
      }
    }
  }

  // Collect explicit file attachments
  const files = options?.files;

  // Start spinner (only in verbose mode)
  const spinner = startSpinner(persona, processedPrompt, verbose);

  try {
    // Execute with timeout
    // Route to the correct provider
    const providerCall = config.provider === 'ollama'
      ? callOllama(processedPrompt, contextStr, persona, config, options, sourceFile, files)
      : callGoogle(processedPrompt, contextStr, persona, config, options, sourceFile, files);

    const result = await Promise.race([
      providerCall,
      createTimeout(config.timeout),
    ]);

    // Record usage
    budgetTracker.recordUsage(
      result.metadata.tokensUsed,
      estimateCost(result.metadata.tokensUsed, result.metadata.model),
    );

    // Stop spinner and format output
    stopSpinner(spinner, result.success);
    formatResult(result, persona, verbose);

    return result;
  } catch (error) {
    stopSpinner(spinner, false);
    const err = error instanceof Error ? error : new Error(String(error));
    formatError(err, persona, verbose);
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
