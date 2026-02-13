import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../../src/utils/budget.js';

describe('BudgetTracker', () => {
  const defaultBudget = {
    maxCallsPerDay: 5,
    maxTokensPerCall: 8000,
    costCapDaily: 1.0,
  };

  it('allows calls within budget', () => {
    const tracker = new BudgetTracker(defaultBudget);
    expect(tracker.canMakeCall().allowed).toBe(true);
  });

  it('blocks after max calls reached', () => {
    const tracker = new BudgetTracker({ ...defaultBudget, maxCallsPerDay: 2 });
    tracker.recordUsage(100, 0.001);
    tracker.recordUsage(100, 0.001);
    const result = tracker.canMakeCall();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily call limit');
  });

  it('blocks after cost cap reached', () => {
    const tracker = new BudgetTracker({ ...defaultBudget, costCapDaily: 0.01 });
    tracker.recordUsage(1000, 0.005);
    tracker.recordUsage(1000, 0.006);
    const result = tracker.canMakeCall();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily cost cap');
  });

  it('tracks usage stats correctly', () => {
    const tracker = new BudgetTracker(defaultBudget);
    tracker.recordUsage(500, 0.05);
    tracker.recordUsage(300, 0.03);

    const stats = tracker.getStats();
    expect(stats.callsToday).toBe(2);
    expect(stats.callsRemaining).toBe(3);
    expect(stats.tokensToday).toBe(800);
    expect(stats.costToday).toBeCloseTo(0.08);
    expect(stats.costRemaining).toBeCloseTo(0.92);
  });

  it('resets counters', () => {
    const tracker = new BudgetTracker(defaultBudget);
    tracker.recordUsage(500, 0.05);
    tracker.reset();

    const stats = tracker.getStats();
    expect(stats.callsToday).toBe(0);
    expect(stats.tokensToday).toBe(0);
    expect(stats.costToday).toBe(0);
  });

  it('exposes maxTokensPerCall', () => {
    const tracker = new BudgetTracker(defaultBudget);
    expect(tracker.maxTokensPerCall).toBe(8000);
  });
});
