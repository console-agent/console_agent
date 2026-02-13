/**
 * Tools index — resolves tool configurations from tool names.
 */

import type { ToolConfig, ToolName } from '../types.js';
import { getCodeExecutionConfig } from './code-execution.js';
import { getSearchConfig } from './search.js';

export { prepareFileContent, detectMimeType } from './file-analysis.js';

/**
 * Resolve tool names/configs into the format expected by the Google provider.
 */
export function resolveTools(tools: (ToolName | ToolConfig)[]): unknown[] {
  const resolved: unknown[] = [];

  for (const tool of tools) {
    if (typeof tool === 'string') {
      switch (tool) {
        case 'code_execution':
          resolved.push(getCodeExecutionConfig());
          break;
        case 'google_search':
          resolved.push(getSearchConfig());
          break;
        case 'file_analysis':
          // File analysis is handled via multimodal content, not as a tool
          break;
      }
    } else {
      // ToolConfig with custom settings
      switch (tool.type) {
        case 'google_search':
          resolved.push(getSearchConfig(tool.config));
          break;
        case 'code_execution':
          resolved.push(getCodeExecutionConfig());
          break;
        case 'file_analysis':
          break;
      }
    }
  }

  return resolved;
}
