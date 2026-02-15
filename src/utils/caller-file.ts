/**
 * Caller file detection — reads source files from stack traces
 * to provide rich context to the AI agent automatically.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourceFileInfo {
  /** Absolute path to the file */
  filePath: string;
  /** File name (e.g., "billing.ts") */
  fileName: string;
  /** Line number where the call/error originated */
  line: number;
  /** Column number */
  column: number;
  /** Full file content as string */
  content: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max file size to read (100KB) — prevents blowing token budgets */
const MAX_FILE_SIZE = 100 * 1024;

/** File extensions we consider source code (safe to read as text) */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
  '.vue', '.svelte', '.astro',
  '.json', '.yaml', '.yml', '.toml', '.env',
  '.sql', '.graphql', '.gql',
  '.md', '.txt', '.html', '.css', '.scss',
]);

/** Patterns to identify internal frames (our own package) */
const INTERNAL_PATTERNS = [
  '/console-agent/',
  '/console_agent/',
  '@console-agent/',
  '/node_modules/',
  'node:internal/',
  'node:async_hooks',
  '<anonymous>',
];

// ─── Stack Trace Parsing ─────────────────────────────────────────────────────

/**
 * Parse a V8 stack trace string into structured frames.
 * Handles formats like:
 *   at functionName (/path/to/file.ts:42:15)
 *   at /path/to/file.ts:42:15
 *   at Object.<anonymous> (/path/to/file.ts:42:15)
 */
function parseStackFrames(stack: string): Array<{ file: string; line: number; column: number }> {
  const frames: Array<{ file: string; line: number; column: number }> = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    // Match: "at ... (file:line:col)" or "at file:line:col"
    const match = line.match(/at\s+(?:.*?\s+)?\(?([^()]+):(\d+):(\d+)\)?/);
    if (match) {
      frames.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      });
    }
  }

  return frames;
}

/**
 * Check if a stack frame is internal (our package or node_modules).
 */
function isInternalFrame(filePath: string): boolean {
  return INTERNAL_PATTERNS.some((pattern) => filePath.includes(pattern));
}

/**
 * Check if a file is a source file we should read.
 */
function isSourceFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the source file of the caller that invoked console.agent().
 * Walks up the stack trace, skipping internal frames, and reads the first
 * external source file.
 *
 * @param skipFrames - Additional frames to skip (default: 0).
 *   The function automatically skips its own frame + executeAgent + proxy frames.
 */
export function getCallerFile(skipFrames = 0): SourceFileInfo | null {
  const err = new Error();
  if (!err.stack) return null;

  const frames = parseStackFrames(err.stack);

  // Skip internal frames to find the user's code
  for (const frame of frames) {
    if (isInternalFrame(frame.file)) continue;
    if (!isSourceFile(frame.file)) continue;

    return readSourceFile(frame.file, frame.line, frame.column);
  }

  return null;
}

/**
 * Extract the source file from an Error object's stack trace.
 * Reads the file where the error originated (first frame in the error's stack).
 *
 * @param error - The Error object with a stack trace.
 */
export function getErrorSourceFile(error: Error): SourceFileInfo | null {
  if (!error.stack) return null;

  const frames = parseStackFrames(error.stack);

  // The first non-internal frame in the error's stack is where the error originated
  for (const frame of frames) {
    // For error stacks, we DO want to include the user's code even if it
    // happens to be in a path that contains node_modules (rare but possible)
    if (frame.file.includes('node:internal/') || frame.file.includes('<anonymous>')) continue;
    if (!isSourceFile(frame.file)) continue;

    return readSourceFile(frame.file, frame.line, frame.column);
  }

  return null;
}

/**
 * Read a source file and return its info.
 * Returns null if the file doesn't exist, is too large, or can't be read.
 */
function readSourceFile(filePath: string, line: number, column: number): SourceFileInfo | null {
  try {
    const resolvedPath = resolve(filePath);

    if (!existsSync(resolvedPath)) return null;

    // Check file size before reading
    const { statSync } = require('node:fs');
    const stats = statSync(resolvedPath);
    if (stats.size > MAX_FILE_SIZE) {
      // File too large — return truncated with a note
      const content = readFileSync(resolvedPath, 'utf-8').substring(0, MAX_FILE_SIZE);
      return {
        filePath: resolvedPath,
        fileName: basename(resolvedPath),
        line,
        column,
        content: content + '\n\n// [TRUNCATED — file exceeds 100KB limit]',
      };
    }

    const content = readFileSync(resolvedPath, 'utf-8');

    return {
      filePath: resolvedPath,
      fileName: basename(resolvedPath),
      line,
      column,
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Format a source file for inclusion in the AI context.
 * Adds line numbers and highlights the relevant line.
 */
export function formatSourceForContext(source: SourceFileInfo): string {
  const lines = source.content.split('\n');
  const numbered = lines.map((line, i) => {
    const lineNum = i + 1;
    const marker = lineNum === source.line ? ' → ' : '   ';
    return `${marker}${String(lineNum).padStart(4)} | ${line}`;
  });

  return `--- Source File: ${source.fileName} (line ${source.line}) ---\n${numbered.join('\n')}`;
}
