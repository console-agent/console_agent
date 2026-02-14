/**
 * Console formatting — rich output with colors, icons, and tree structure.
 * Uses chalk for colors and ora for spinners.
 *
 * Two output modes:
 *  - verbose=false (default): Clean, actionable output only — just the answer.
 *  - verbose=true: Full execution trace with [AGENT] prefix, tools, reasoning, metadata.
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { AgentResult, PersonaDefinition, LogLevel } from '../types.js';

let currentLogLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['silent', 'errors', 'info', 'debug'];
  return levels.indexOf(currentLogLevel) >= levels.indexOf(level);
}

// ─── Spinner Management ──────────────────────────────────────────────────────

export function startSpinner(persona: PersonaDefinition, prompt: string, verbose = false): Ora | null {
  if (!shouldLog('info')) return null;
  // Only show spinner in verbose mode
  if (!verbose) return null;

  const truncated = prompt.length > 60 ? prompt.substring(0, 57) + '...' : prompt;
  const spinner = ora({
    text: chalk.cyan(`${persona.icon} ${persona.label}... `) + chalk.dim(truncated),
    prefixText: chalk.gray('[AGENT]'),
  }).start();

  return spinner;
}

export function stopSpinner(spinner: Ora | null, success: boolean): void {
  if (!spinner) return;

  if (success) {
    spinner.succeed();
  } else {
    spinner.fail();
  }
}

// ─── Result Formatting ──────────────────────────────────────────────────────

export function formatResult(result: AgentResult, persona: PersonaDefinition, verbose = false): void {
  if (!shouldLog('info')) return;

  if (!verbose) {
    // ── Quiet mode: clean, actionable output only ──
    formatResultQuiet(result);
    return;
  }

  // ── Verbose mode: full execution trace ──
  formatResultVerbose(result, persona);
}

/**
 * Quiet mode — print only the answer/summary, no [AGENT] prefix or metadata.
 */
function formatResultQuiet(result: AgentResult): void {
  console.log('');
  console.log(result.summary);

  // Show structured data if it has meaningful content beyond 'raw'
  const dataEntries = Object.entries(result.data);
  const hasMeaningfulData = dataEntries.length > 0 &&
    !(dataEntries.length === 1 && dataEntries[0][0] === 'raw');

  if (hasMeaningfulData) {
    for (const [key, value] of dataEntries) {
      if (key === 'raw') continue;
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`${chalk.dim(key + ':')} ${displayValue}`);
    }
  }
  console.log('');
}

/**
 * Verbose mode — full [AGENT] tree with tools, reasoning, and metadata.
 */
function formatResultVerbose(result: AgentResult, persona: PersonaDefinition): void {
  const prefix = chalk.gray('[AGENT]');
  const confidenceColor = result.confidence >= 0.8 ? chalk.green : result.confidence >= 0.5 ? chalk.yellow : chalk.red;
  const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗');

  console.log('');
  console.log(`${prefix} ${persona.icon} ${chalk.bold(persona.label)} Complete`);
  console.log(`${prefix} ├─ ${statusIcon} ${chalk.white(result.summary)}`);

  // Show actions/tools used
  if (result.actions.length > 0) {
    for (let i = 0; i < result.actions.length; i++) {
      const connector = i < result.actions.length - 1 ? '├─' : '├─';
      console.log(`${prefix} ${connector} ${chalk.dim('Tool:')} ${chalk.cyan(result.actions[i])}`);
    }
  }

  // Show key data points
  const dataEntries = Object.entries(result.data);
  if (dataEntries.length > 0) {
    for (const [key, value] of dataEntries) {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`${prefix} ├─ ${chalk.dim(key + ':')} ${chalk.white(displayValue)}`);
    }
  }

  // Show reasoning if available
  if (result.reasoning) {
    const reasoningLines = result.reasoning.split('\n').slice(0, 3);
    console.log(`${prefix} ├─ ${chalk.dim('Reasoning:')}`);
    for (const line of reasoningLines) {
      console.log(`${prefix} │  ${chalk.dim(line.trim())}`);
    }
  }

  // Footer with metadata
  const confidence = confidenceColor(`confidence: ${result.confidence.toFixed(2)}`);
  const latency = chalk.dim(`${result.metadata.latencyMs}ms`);
  const tokens = chalk.dim(`${result.metadata.tokensUsed} tokens`);
  const model = chalk.dim(`model: ${result.metadata.model}`);
  const cached = result.metadata.cached ? chalk.green(' (cached)') : '';
  const toolNames = result.metadata.toolCalls.length > 0
    ? chalk.dim(` | tools: ${result.metadata.toolCalls.map(t => t.name).join(', ')}`)
    : '';

  console.log(`${prefix} └─ ${confidence} | ${latency} | ${tokens} | ${model}${cached}${toolNames}`);
  console.log('');
}

// ─── Error Formatting ────────────────────────────────────────────────────────

export function formatError(error: Error, persona: PersonaDefinition, verbose = false): void {
  if (!shouldLog('errors')) return;

  if (!verbose) {
    // Quiet mode: just the error message
    console.log('');
    console.log(chalk.red(`Error: ${error.message}`));
    console.log('');
    return;
  }

  // Verbose mode: full [AGENT] prefixed error
  const prefix = chalk.gray('[AGENT]');
  console.log('');
  console.log(`${prefix} ${persona.icon} ${chalk.red('Error:')} ${error.message}`);
  if (shouldLog('debug') && error.stack) {
    console.log(`${prefix} ${chalk.dim(error.stack)}`);
  }
  console.log('');
}

// ─── Budget Warning ──────────────────────────────────────────────────────────

export function formatBudgetWarning(reason: string, verbose = false): void {
  if (!shouldLog('errors')) return;

  if (!verbose) {
    console.log(chalk.yellow(`Budget limit: ${reason}`));
    return;
  }

  const prefix = chalk.gray('[AGENT]');
  console.log(`${prefix} ${chalk.yellow('⚠ Budget limit:')} ${reason}`);
}

// ─── Rate Limit Warning ─────────────────────────────────────────────────────

export function formatRateLimitWarning(verbose = false): void {
  if (!shouldLog('errors')) return;

  if (!verbose) {
    console.log(chalk.yellow('Rate limited: Too many calls. Try again later.'));
    return;
  }

  const prefix = chalk.gray('[AGENT]');
  console.log(`${prefix} ${chalk.yellow('⚠ Rate limited:')} Too many calls. Try again later.`);
}

// ─── Dry Run ─────────────────────────────────────────────────────────────────

export function formatDryRun(prompt: string, persona: PersonaDefinition, context?: unknown, verbose = false): void {
  if (!shouldLog('info')) return;

  if (!verbose) {
    // Quiet mode: minimal dry run notice
    console.log('');
    console.log(chalk.magenta('[DRY RUN]') + ` Would execute with ${persona.name} persona`);
    console.log('');
    return;
  }

  // Verbose mode: full tree
  const prefix = chalk.gray('[AGENT]');
  console.log('');
  console.log(`${prefix} ${chalk.magenta('DRY RUN')} ${persona.icon} ${persona.label}`);
  console.log(`${prefix} ├─ ${chalk.dim('Persona:')} ${persona.name}`);
  console.log(`${prefix} ├─ ${chalk.dim('Prompt:')} ${prompt}`);
  if (context !== undefined) {
    const contextStr = typeof context === 'string' ? context : JSON.stringify(context, null, 2);
    const lines = contextStr.split('\n').slice(0, 5);
    console.log(`${prefix} ├─ ${chalk.dim('Context:')}`);
    for (const line of lines) {
      console.log(`${prefix} │  ${chalk.dim(line)}`);
    }
  }
  console.log(`${prefix} └─ ${chalk.dim('(No API call made)')}`);
  console.log('');
}

// ─── Debug logging ───────────────────────────────────────────────────────────

export function logDebug(message: string): void {
  if (!shouldLog('debug')) return;
  console.log(`${chalk.gray('[AGENT DEBUG]')} ${chalk.dim(message)}`);
}
