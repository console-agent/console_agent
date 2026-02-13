import { describe, it, expect, beforeEach } from 'vitest';
import { updateConfig, executeAgent } from '../../src/agent.js';

describe('Agent Integration (Dry Run)', () => {
  beforeEach(() => {
    updateConfig({ dryRun: true, logLevel: 'silent' });
  });

  it('returns dry run result without calling API', async () => {
    const result = await executeAgent('test prompt');
    expect(result.success).toBe(true);
    expect(result.summary).toContain('DRY RUN');
    expect(result.data.dryRun).toBe(true);
    expect(result.metadata.tokensUsed).toBe(0);
    expect(result.metadata.latencyMs).toBe(0);
  });

  it('respects persona override', async () => {
    const result = await executeAgent('test', undefined, { persona: 'security' });
    expect(result.summary).toContain('security');
  });

  it('auto-detects persona from keywords', async () => {
    const result = await executeAgent('check for SQL injection vulnerability');
    expect(result.summary).toContain('security');
  });

  it('returns error on rate limit', async () => {
    updateConfig({
      dryRun: false,
      logLevel: 'silent',
      budget: { maxCallsPerDay: 0, maxTokensPerCall: 8000, costCapDaily: 1.0 },
    });

    // With 0 calls allowed, should get rate limit error immediately
    // The rate limiter starts with maxCallsPerDay tokens
    // Since 0 = no tokens, first call should fail
    const result = await executeAgent('test');
    expect(result.success).toBe(false);
  });
});

describe('Console Agent Attachment', () => {
  it('attaches agent to console on import', async () => {
    // Importing the module should auto-attach console.agent
    await import('../../src/index.js');
    expect(typeof console.agent).toBe('function');
    expect(typeof console.agent.security).toBe('function');
    expect(typeof console.agent.debug).toBe('function');
    expect(typeof console.agent.architect).toBe('function');
  });
});
