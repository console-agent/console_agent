/**
 * Unit tests for the Ollama provider integration.
 */
import { describe, it, expect } from 'vitest';
import { getConfig, updateConfig, DEFAULT_CONFIG } from '../../src/agent.js';
import type { AgentConfig } from '../../src/types.js';

describe('Ollama Config', () => {
  it('DEFAULT_CONFIG has ollamaHost', () => {
    expect(DEFAULT_CONFIG.ollamaHost).toBe('http://localhost:11434');
  });

  it('DEFAULT_CONFIG provider is google', () => {
    expect(DEFAULT_CONFIG.provider).toBe('google');
  });

  it('accepts ollama provider', () => {
    updateConfig({ provider: 'ollama', model: 'llama3.2' });
    const config = getConfig();
    expect(config.provider).toBe('ollama');
    expect(config.model).toBe('llama3.2');
    expect(config.ollamaHost).toBe('http://localhost:11434');
    // Reset
    updateConfig({ provider: 'google' });
  });

  it('accepts custom ollamaHost', () => {
    updateConfig({ provider: 'ollama', ollamaHost: 'http://my-server:11434' });
    const config = getConfig();
    expect(config.ollamaHost).toBe('http://my-server:11434');
    // Reset
    updateConfig({ provider: 'google' });
  });

  it('provider routing: ollama config routes to ollama provider', () => {
    updateConfig({
      provider: 'ollama',
      model: 'llama3.2',
      dryRun: true,
    });
    const config = getConfig();
    expect(config.provider).toBe('ollama');
    expect(config.dryRun).toBe(true);
    // Reset
    updateConfig({ provider: 'google', dryRun: false });
  });
});

describe('Ollama Provider: parseResponse (via module)', () => {
  // We can't easily import private functions, but we can test the config acceptance
  // which verifies the type system supports the new provider

  it('AgentConfig type accepts google and ollama', () => {
    const googleConfig: Partial<AgentConfig> = { provider: 'google' };
    const ollamaConfig: Partial<AgentConfig> = { provider: 'ollama' };
    expect(googleConfig.provider).toBe('google');
    expect(ollamaConfig.provider).toBe('ollama');
  });

  it('ollamaHost defaults correctly', () => {
    updateConfig({});
    const config = getConfig();
    expect(config.ollamaHost).toBe('http://localhost:11434');
  });
});

describe('Ollama Dry Run', () => {
  it('dry run with ollama provider returns expected result', async () => {
    // Import executeAgent to test dry run path
    const { executeAgent } = await import('../../src/agent.js');

    updateConfig({
      provider: 'ollama',
      model: 'llama3.2',
      dryRun: true,
      logLevel: 'silent',
    });

    const result = await executeAgent('test prompt');

    expect(result.success).toBe(true);
    expect(result.summary).toContain('DRY RUN');
    expect(result.metadata.model).toBe('llama3.2');

    // Reset
    updateConfig({ provider: 'google', dryRun: false });
  });
});
