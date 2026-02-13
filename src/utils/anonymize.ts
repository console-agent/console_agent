/**
 * Content anonymization — strips secrets, PII, and sensitive data
 * before sending to the AI provider.
 */

// Patterns for sensitive content
const patterns = {
  // API keys and tokens (long alphanumeric strings near sensitive keywords)
  apiKey: /(?:api[_-]?key|token|secret|password|credential|auth)['":\s=]+['"]?([A-Za-z0-9_\-/.]{20,})['"]?/gi,
  // Bearer tokens
  bearer: /Bearer\s+[A-Za-z0-9_\-/.+]{20,}/gi,
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // IPv4 addresses
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // IPv6 addresses (simplified)
  ipv6: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
  // AWS keys
  awsKey: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  // Private keys
  privateKey: /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/g,
  // Connection strings
  connectionString: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+/gi,
  // .env style secrets
  envSecret: /^(?:DATABASE_URL|DB_PASSWORD|SECRET_KEY|PRIVATE_KEY|AWS_SECRET|STRIPE_KEY|SENDGRID_KEY)[=:].+$/gm,
};

/**
 * Anonymize sensitive content in a string.
 * Replaces detected secrets/PII with safe placeholders.
 */
export function anonymize(content: string): string {
  let result = content;

  result = result.replace(patterns.privateKey, '[REDACTED_PRIVATE_KEY]');
  result = result.replace(patterns.connectionString, '[REDACTED_CONNECTION_STRING]');
  result = result.replace(patterns.awsKey, '[REDACTED_AWS_KEY]');
  result = result.replace(patterns.bearer, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(patterns.apiKey, (match, _key) => {
    // Keep the key name but redact the value
    const colonIdx = match.search(/['":\s=]/);
    const prefix = match.substring(0, colonIdx);
    return `${prefix}: [REDACTED]`;
  });
  result = result.replace(patterns.envSecret, (match) => {
    const eqIdx = match.search(/[=:]/);
    const key = match.substring(0, eqIdx);
    return `${key}=[REDACTED]`;
  });
  result = result.replace(patterns.email, '[EMAIL]');
  result = result.replace(patterns.ipv4, '[IP]');
  result = result.replace(patterns.ipv6, '[IP]');

  return result;
}

/**
 * Anonymize any value — handles strings, objects, arrays, and primitives.
 */
export function anonymizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return anonymize(value);
  }
  if (Array.isArray(value)) {
    return value.map(anonymizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = anonymizeValue(v);
    }
    return result;
  }
  return value;
}
