/**
 * Tools index — resolves tool configurations using the native @ai-sdk/google tools API.
 *
 * Tools are opt-in only: they are passed to the AI model ONLY when the user
 * explicitly specifies `tools: [...]` in their console.agent() call options.
 */

import type { ToolConfig, ToolName } from '../types.js';

export { prepareFileContent, detectMimeType } from './file-analysis.js';

/**
 * Minimum timeout (ms) when tools are active.
 * Tools like google_search and code_execution add latency.
 */
export const TOOLS_MIN_TIMEOUT = 30_000;

/**
 * Resolve tool names/configs into SDK tool objects using the google provider instance.
 *
 * @param tools  - Array of tool names or tool configs from user's options
 * @param google - The Google Generative AI provider instance (from createGoogleGenerativeAI)
 * @returns Record of tool name → SDK tool object, ready for ToolLoopAgent
 */
export function resolveTools(
  tools: (ToolName | ToolConfig)[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const tool of tools) {
    const name: ToolName = typeof tool === 'string' ? tool : tool.type;
    const config = typeof tool === 'object' ? tool.config : undefined;

    switch (name) {
      case 'google_search':
        resolved['google_search'] = google.tools.googleSearch(config ?? {});
        break;
      case 'code_execution':
        resolved['code_execution'] = google.tools.codeExecution(config ?? {});
        break;
      case 'url_context':
        resolved['url_context'] = google.tools.urlContext({});
        break;
      case 'file_analysis':
        // File analysis is handled via multimodal content, not as an SDK tool
        break;
    }
  }

  return resolved;
}

/**
 * Check if any tools were explicitly requested.
 */
export function hasExplicitTools(options?: { tools?: (ToolName | ToolConfig)[] }): boolean {
  return !!(options?.tools && options.tools.length > 0);
}
