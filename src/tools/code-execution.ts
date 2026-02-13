/**
 * Code Execution tool wrapper.
 * Uses Google's built-in code execution capability to run Python code in a sandbox.
 */

import type { ToolName } from '../types.js';

export const CODE_EXECUTION_TOOL: ToolName = 'code_execution';

/**
 * Get the Vercel AI SDK tool configuration for Google code execution.
 * This is a built-in Google tool — no custom implementation needed.
 */
export function getCodeExecutionConfig() {
  return {
    type: 'code_execution' as const,
  };
}
