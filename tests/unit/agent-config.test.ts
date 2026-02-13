import { describe, it, expect, beforeEach } from 'vitest';
import { updateConfig, getConfig, DEFAULT_CONFIG } from '../../src/agent.js';

describe('Agent Config', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    updateConfig({});
  });

  it('has sensible defaults', () => {
    const config = getConfig();
    expect(config.provider).toBe('google');
    expect(config.model).toBe('gemini-2.5-flash-lite');
    expect(config.persona).toBe('general');
    expect(config.mode).toBe('fire-and-forget');
    expect(config.timeout).toBe(10000);
    expect(config.anonymize).toBe(true);
    expect(config.localOnly).toBe(false);
    expect(config.dryRun).toBe(false);
    expect(config.logLevel).toBe('info');
  });

  it('has default budget', () => {
    const config = getConfig();
    expect(config.budget.maxCallsPerDay).toBe(100);
    expect(config.budget.maxTokensPerCall).toBe(8000);
    expect(config.budget.costCapDaily).toBe(1.0);
  });

  it('updates config with partial overrides', () => {
    updateConfig({ model: 'gemini-3-flash-preview', mode: 'blocking' });
    const config = getConfig();
    expect(config.model).toBe('gemini-3-flash-preview');
    expect(config.mode).toBe('blocking');
    // Other defaults preserved
    expect(config.provider).toBe('google');
    expect(config.anonymize).toBe(true);
  });

  it('merges budget config with defaults', () => {
    updateConfig({ budget: { maxCallsPerDay: 200, maxTokensPerCall: 8000, costCapDaily: 1.0 } });
    const config = getConfig();
    expect(config.budget.maxCallsPerDay).toBe(200);
    expect(config.budget.maxTokensPerCall).toBe(8000);
  });

  it('DEFAULT_CONFIG is immutable reference', () => {
    expect(DEFAULT_CONFIG.model).toBe('gemini-2.5-flash-lite');
    expect(DEFAULT_CONFIG.provider).toBe('google');
  });

  it('getConfig returns a copy (not reference)', () => {
    const config1 = getConfig();
    const config2 = getConfig();
    expect(config1).toEqual(config2);
    expect(config1).not.toBe(config2);
  });
});
