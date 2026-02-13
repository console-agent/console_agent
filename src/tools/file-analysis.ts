/**
 * File Analysis tool wrapper.
 * Supports PDF, images, and video processing via Gemini's multimodal capabilities.
 */

import type { ToolName } from '../types.js';

export const FILE_ANALYSIS_TOOL: ToolName = 'file_analysis';

/**
 * Prepare file content for inclusion in the prompt.
 * Converts Buffer/file data into the format expected by the AI SDK.
 */
export function prepareFileContent(fileData: Buffer | Uint8Array, mimeType: string) {
  const base64 = Buffer.from(fileData).toString('base64');
  return {
    type: 'file' as const,
    data: base64,
    mimeType,
  };
}

/**
 * Detect MIME type from file extension or magic bytes.
 */
export function detectMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return mimeMap[ext || ''] || 'application/octet-stream';
}
