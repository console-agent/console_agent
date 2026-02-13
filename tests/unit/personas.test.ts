import { describe, it, expect } from 'vitest';
import { detectPersona, getPersona, personas } from '../../src/personas/index.js';

describe('Personas', () => {
  describe('getPersona', () => {
    it('returns debugger persona', () => {
      const p = getPersona('debugger');
      expect(p.name).toBe('debugger');
      expect(p.icon).toBe('🐛');
      expect(p.systemPrompt).toContain('debugging');
    });

    it('returns security persona', () => {
      const p = getPersona('security');
      expect(p.name).toBe('security');
      expect(p.icon).toBe('🛡️');
      expect(p.systemPrompt).toContain('OWASP');
    });

    it('returns architect persona', () => {
      const p = getPersona('architect');
      expect(p.name).toBe('architect');
      expect(p.icon).toBe('🏗️');
      expect(p.systemPrompt).toContain('architect');
    });

    it('returns general persona', () => {
      const p = getPersona('general');
      expect(p.name).toBe('general');
      expect(p.icon).toBe('🔍');
    });
  });

  describe('detectPersona', () => {
    it('detects security keywords', () => {
      expect(detectPersona('check for SQL injection', 'general').name).toBe('security');
      expect(detectPersona('audit vulnerability', 'general').name).toBe('security');
      expect(detectPersona('check XSS risk', 'general').name).toBe('security');
      expect(detectPersona('CSRF protection', 'general').name).toBe('security');
    });

    it('detects debugger keywords', () => {
      expect(detectPersona('why is this slow', 'general').name).toBe('debugger');
      expect(detectPersona('debug this error', 'general').name).toBe('debugger');
      expect(detectPersona('optimize performance', 'general').name).toBe('debugger');
      expect(detectPersona('fix the memory leak', 'general').name).toBe('debugger');
    });

    it('detects architect keywords', () => {
      expect(detectPersona('review system design', 'general').name).toBe('architect');
      expect(detectPersona('architecture review', 'general').name).toBe('architect');
      expect(detectPersona('database schema design', 'general').name).toBe('architect');
    });

    it('falls back to default persona when no keywords match', () => {
      expect(detectPersona('hello world', 'general').name).toBe('general');
      expect(detectPersona('what is 2+2', 'debugger').name).toBe('debugger');
    });

    it('security takes priority over debugger', () => {
      // "security" keyword should win over "error"
      expect(detectPersona('security error found', 'general').name).toBe('security');
    });
  });

  describe('personas registry', () => {
    it('has all four personas', () => {
      expect(Object.keys(personas)).toEqual(['debugger', 'security', 'architect', 'general']);
    });

    it('each persona has required fields', () => {
      for (const p of Object.values(personas)) {
        expect(p.name).toBeDefined();
        expect(p.icon).toBeDefined();
        expect(p.label).toBeDefined();
        expect(p.systemPrompt).toBeDefined();
        expect(p.defaultTools).toBeDefined();
        expect(Array.isArray(p.keywords)).toBe(true);
      }
    });
  });
});
