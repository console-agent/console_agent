/**
 * Console formatting — rich output with colors, icons, and tree structure.
 * Uses chalk for colors and ora for spinners.
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

export function startSpinner(persona: PersonaDefinition, prompt: string): Ora | null {
  if (!shouldLog('info')) return null;

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

export function formatResult(result: AgentResult, persona: PersonaDefinition): void {
  if (!shouldLog('info')) return;

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
  const cached = result.metadata.cached ? chalk.green(' (cached)') : '';

  console.log(`${prefix} └─ ${confidence} | ${latency} | ${tokens}${cached}`);
  console.log('');
}

// ─── Error Formatting ────────────────────────────────────────────────────────

export function formatError(error: Error, persona: PersonaDefinition): void {
  if (!shouldLog('errors')) return;

  const prefix = chalk.gray('[AGENT]');
  console.log('');
  console.log(`${prefix} ${persona.icon} ${chalk.red('Error:')} ${error.message}`);
  if (shouldLog('debug') && error.stack) {
    console.log(`${prefix} ${chalk.dim(error.stack)}`);
  }
  console.log('');
}

// ─── Budget Warning ──────────────────────────────────────────────────────────

export function formatBudgetWarning(reason: string): void {
  if (!shouldLog('errors')) return;

  const prefix = chalk.gray('[AGENT]');
  console.log(`${prefix} ${chalk.yellow('⚠ Budget limit:')} ${reason}`);
}

// ─── Rate Limit Warning ─────────────────────────────────────────────────────

export function formatRateLimitWarning(): void {
  if (!shouldLog('errors')) return;

  const prefix = chalk.gray('[AGENT]');
  console.log(`${prefix} ${chalk.yellow('⚠ Rate limited:')} Too many calls. Try again later.`);
}

// ─── Dry Run ─────────────────────────────────────────────────────────────────

export function formatDryRun(prompt: string, persona: PersonaDefinition, context?: unknown): void {
  if (!shouldLog('info')) return;

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
