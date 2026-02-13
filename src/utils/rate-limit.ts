/**
 * Token bucket rate limiter.
 * Controls the rate of API calls to prevent abuse and stay within budget.
 */

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;

  /**
   * @param maxCallsPerDay Maximum calls allowed per day
   */
  constructor(maxCallsPerDay: number) {
    this.maxTokens = maxCallsPerDay;
    this.tokens = maxCallsPerDay;
    // Refill rate: spread calls evenly across 24 hours
    this.refillRate = maxCallsPerDay / (24 * 60 * 60 * 1000);
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume one token.
   * @returns true if allowed, false if rate limited
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens (calls available)
   */
  remaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Reset the limiter (e.g., for testing or manual override)
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
