import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../src/utils/rate-limit.js';

describe('RateLimiter', () => {
  it('allows calls within limit', () => {
    const limiter = new RateLimiter(10);
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
  });

  it('rejects calls beyond limit', () => {
    const limiter = new RateLimiter(3);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it('reports remaining tokens', () => {
    const limiter = new RateLimiter(5);
    expect(limiter.remaining()).toBe(5);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.remaining()).toBe(3);
  });

  it('resets properly', () => {
    const limiter = new RateLimiter(2);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);
    limiter.reset();
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.remaining()).toBe(1);
  });
});
