/**
 * Google Search tool wrapper.
 * Uses Google's built-in search grounding for real-time information retrieval.
 */

import type { GoogleSearchConfig, ToolName } from '../types.js';

export const GOOGLE_SEARCH_TOOL: ToolName = 'google_search';

/**
 * Get the Vercel AI SDK tool configuration for Google Search grounding.
 */
export function getSearchConfig(config?: GoogleSearchConfig) {
  return {
    type: 'google_search' as const,
    ...(config && {
      googleSearch: {
        dynamicRetrievalConfig: config.mode
          ? {
              mode: config.mode,
              ...(config.dynamicThreshold !== undefined && {
                dynamicThreshold: config.dynamicThreshold,
              }),
            }
          : undefined,
      },
    }),
  };
}
