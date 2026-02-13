/**
 * Budget tracker — monitors daily token usage and cost.
 * Enforces hard caps to prevent cost explosion.
 */

import type { BudgetConfig } from '../types.js';

export class BudgetTracker {
  private callsToday = 0;
  private tokensToday = 0;
  private costToday = 0;
  private dayStart: number;
  private readonly config: BudgetConfig;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.dayStart = this.getStartOfDay();
  }

  /**
   * Check if a call is within budget. Resets counters at midnight UTC.
   */
  canMakeCall(): { allowed: boolean; reason?: string } {
    this.maybeResetDay();

    if (this.callsToday >= this.config.maxCallsPerDay) {
      return {
        allowed: false,
        reason: `Daily call limit reached (${this.config.maxCallsPerDay} calls/day)`,
      };
    }

    if (this.costToday >= this.config.costCapDaily) {
      return {
        allowed: false,
        reason: `Daily cost cap reached ($${this.config.costCapDaily.toFixed(2)})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a completed call's usage.
   */
  recordUsage(tokensUsed: number, costUsd: number): void {
    this.maybeResetDay();
    this.callsToday += 1;
    this.tokensToday += tokensUsed;
    this.costToday += costUsd;
  }

  /**
   * Get current usage stats.
   */
  getStats() {
    this.maybeResetDay();
    return {
      callsToday: this.callsToday,
      callsRemaining: Math.max(0, this.config.maxCallsPerDay - this.callsToday),
      tokensToday: this.tokensToday,
      costToday: this.costToday,
      costRemaining: Math.max(0, this.config.costCapDaily - this.costToday),
    };
  }

  /**
   * Reset all counters (for testing).
   */
  reset(): void {
    this.callsToday = 0;
    this.tokensToday = 0;
    this.costToday = 0;
    this.dayStart = this.getStartOfDay();
  }

  /**
   * Get the max tokens allowed per call.
   */
  get maxTokensPerCall(): number {
    return this.config.maxTokensPerCall;
  }

  private maybeResetDay(): void {
    const currentDayStart = this.getStartOfDay();
    if (currentDayStart > this.dayStart) {
      this.callsToday = 0;
      this.tokensToday = 0;
      this.costToday = 0;
      this.dayStart = currentDayStart;
    }
  }

  private getStartOfDay(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
}
