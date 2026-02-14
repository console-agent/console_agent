import { describe, it, expect } from 'vitest';
import { hasExplicitTools, TOOLS_MIN_TIMEOUT, resolveTools } from '../../src/tools/index.js';
import { prepareFileContent, detectMimeType } from '../../src/tools/file-analysis.js';

describe('hasExplicitTools', () => {
  it('returns false when no options', () => {
    expect(hasExplicitTools(undefined)).toBe(false);
    expect(hasExplicitTools({})).toBe(false);
  });

  it('returns false when tools is empty array', () => {
    expect(hasExplicitTools({ tools: [] })).toBe(false);
  });

  it('returns true when tools are specified', () => {
    expect(hasExplicitTools({ tools: ['google_search'] })).toBe(true);
    expect(hasExplicitTools({ tools: ['code_execution', 'google_search'] })).toBe(true);
    expect(hasExplicitTools({ tools: [{ type: 'google_search' }] })).toBe(true);
  });
});

describe('TOOLS_MIN_TIMEOUT', () => {
  it('is 30 seconds', () => {
    expect(TOOLS_MIN_TIMEOUT).toBe(30_000);
  });
});

describe('resolveTools', () => {
  // Mock the google provider instance with tools
  const mockGoogleSearch = {};
  const mockCodeExecution = {};
  const mockUrlContext = {};

  const mockGoogle = {
    tools: {
      googleSearch: () => mockGoogleSearch,
      codeExecution: () => mockCodeExecution,
      urlContext: () => mockUrlContext,
    },
  };

  it('resolves google_search tool by name', () => {
    const result = resolveTools(['google_search'], mockGoogle);
    expect(result).toHaveProperty('google_search');
    expect(result['google_search']).toBe(mockGoogleSearch);
  });

  it('resolves code_execution tool by name', () => {
    const result = resolveTools(['code_execution'], mockGoogle);
    expect(result).toHaveProperty('code_execution');
    expect(result['code_execution']).toBe(mockCodeExecution);
  });

  it('resolves url_context tool by name', () => {
    const result = resolveTools(['url_context'], mockGoogle);
    expect(result).toHaveProperty('url_context');
    expect(result['url_context']).toBe(mockUrlContext);
  });

  it('resolves multiple tools at once', () => {
    const result = resolveTools(['google_search', 'code_execution', 'url_context'], mockGoogle);
    expect(Object.keys(result)).toEqual(['google_search', 'code_execution', 'url_context']);
  });

  it('skips file_analysis (handled via multimodal content)', () => {
    const result = resolveTools(['file_analysis'], mockGoogle);
    expect(Object.keys(result)).toEqual([]);
  });

  it('resolves ToolConfig objects', () => {
    const result = resolveTools([{ type: 'google_search', config: { mode: 'MODE_DYNAMIC' } }], mockGoogle);
    expect(result).toHaveProperty('google_search');
  });

  it('returns empty object when no tools', () => {
    const result = resolveTools([], mockGoogle);
    expect(Object.keys(result)).toEqual([]);
  });
});

describe('detectMimeType', () => {
  it('detects PDF', () => {
    expect(detectMimeType('report.pdf')).toBe('application/pdf');
  });

  it('detects PNG', () => {
    expect(detectMimeType('image.png')).toBe('image/png');
  });

  it('detects JPEG variants', () => {
    expect(detectMimeType('photo.jpg')).toBe('image/jpeg');
    expect(detectMimeType('photo.jpeg')).toBe('image/jpeg');
  });

  it('detects video formats', () => {
    expect(detectMimeType('video.mp4')).toBe('video/mp4');
    expect(detectMimeType('video.webm')).toBe('video/webm');
  });

  it('returns octet-stream for unknown', () => {
    expect(detectMimeType('data.xyz')).toBe('application/octet-stream');
  });
});

describe('prepareFileContent', () => {
  it('returns base64 encoded content with mime type', () => {
    const data = Buffer.from('hello world');
    const result = prepareFileContent(data, 'text/plain');
    expect(result.type).toBe('file');
    expect(result.mimeType).toBe('text/plain');
    expect(typeof result.data).toBe('string');
    // Verify it's valid base64
    expect(Buffer.from(result.data, 'base64').toString()).toBe('hello world');
  });
});
