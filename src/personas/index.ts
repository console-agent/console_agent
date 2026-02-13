import type { PersonaDefinition, PersonaName } from '../types.js';
import { debuggerPersona } from './debugger.js';
import { securityPersona } from './security.js';
import { architectPersona } from './architect.js';
import { generalPersona } from './general.js';

export const personas: Record<PersonaName, PersonaDefinition> = {
  debugger: debuggerPersona,
  security: securityPersona,
  architect: architectPersona,
  general: generalPersona,
};

/**
 * Auto-detect the best persona based on keywords in the prompt.
 * Returns the explicitly set persona if provided, otherwise scans for keywords.
 */
export function detectPersona(prompt: string, defaultPersona: PersonaName): PersonaDefinition {
  const lower = prompt.toLowerCase();

  // Check specific personas in priority order (security > debugger > architect)
  for (const name of ['security', 'debugger', 'architect'] as PersonaName[]) {
    const persona = personas[name];
    if (persona.keywords.some((kw) => lower.includes(kw))) {
      return persona;
    }
  }

  return personas[defaultPersona];
}

export function getPersona(name: PersonaName): PersonaDefinition {
  return personas[name];
}
