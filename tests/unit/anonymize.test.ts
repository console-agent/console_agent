import { describe, it, expect } from 'vitest';
import { anonymize, anonymizeValue } from '../../src/utils/anonymize.js';

describe('Anonymization', () => {
  describe('anonymize (string)', () => {
    it('redacts email addresses', () => {
      expect(anonymize('contact user@example.com for info')).toBe('contact [EMAIL] for info');
    });

    it('redacts IPv4 addresses', () => {
      expect(anonymize('server at 192.168.1.100')).toBe('server at [IP]');
    });

    it('redacts Bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123';
      expect(anonymize(input)).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('redacts AWS access keys', () => {
      expect(anonymize('key: AKIAIOSFODNN7EXAMPLE')).toContain('[REDACTED_AWS_KEY]');
    });

    it('redacts private keys', () => {
      const input = '-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBg...\n-----END PRIVATE KEY-----';
      expect(anonymize(input)).toBe('[REDACTED_PRIVATE_KEY]');
    });

    it('redacts connection strings', () => {
      expect(anonymize('url: mongodb://user:pass@host:27017/db')).toContain('[REDACTED_CONNECTION_STRING]');
      expect(anonymize('url: postgres://user:pass@host:5432/db')).toContain('[REDACTED_CONNECTION_STRING]');
    });

    it('redacts env-style secrets', () => {
      expect(anonymize('DATABASE_URL=postgres://localhost/db')).toBe('DATABASE_URL=[REDACTED]');
    });

    it('preserves normal text', () => {
      const normal = 'This is a normal log message with no secrets';
      expect(anonymize(normal)).toBe(normal);
    });
  });

  describe('anonymizeValue (deep)', () => {
    it('anonymizes strings', () => {
      expect(anonymizeValue('email: user@test.com')).toBe('email: [EMAIL]');
    });

    it('anonymizes objects recursively', () => {
      const input = {
        name: 'John',
        email: 'john@example.com',
        nested: { ip: '10.0.0.1' },
      };
      const result = anonymizeValue(input) as Record<string, unknown>;
      expect(result.name).toBe('John');
      expect(result.email).toBe('[EMAIL]');
      expect((result.nested as Record<string, unknown>).ip).toBe('[IP]');
    });

    it('anonymizes arrays', () => {
      const input = ['user@test.com', '192.168.0.1', 'hello'];
      const result = anonymizeValue(input) as string[];
      expect(result[0]).toBe('[EMAIL]');
      expect(result[1]).toBe('[IP]');
      expect(result[2]).toBe('hello');
    });

    it('passes through primitives', () => {
      expect(anonymizeValue(42)).toBe(42);
      expect(anonymizeValue(true)).toBe(true);
      expect(anonymizeValue(null)).toBe(null);
      expect(anonymizeValue(undefined)).toBe(undefined);
    });
  });
});
