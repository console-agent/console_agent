/**
 * Google AI provider — integrates with Gemini via @ai-sdk/google + Vercel AI SDK.
 * Uses ToolLoopAgent for multi-step reasoning with structured output.
 * This is the only provider in v1.0.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ToolLoopAgent, Output, jsonSchema } from 'ai';
import type { AgentConfig, AgentCallOptions, AgentResult, PersonaDefinition, ToolCall } from '../types.js';
import { logDebug } from '../utils/format.js';

// ─── Structured Output Schema (JSON Schema compatible with Gemini) ───────────
// Gemini requires OBJECT types to have non-empty `properties`.
// We define a `result` property inside `data` to satisfy this constraint.

const agentOutputSchema = jsonSchema({
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, description: 'Whether the task was completed successfully' },
    summary: { type: 'string' as const, description: 'One-line human-readable conclusion' },
    reasoning: { type: 'string' as const, description: 'Your thought process' },
    data: {
      type: 'object' as const,
      description: 'Structured findings as key-value pairs',
      properties: {
        result: { type: 'string' as const, description: 'Primary result or finding' },
      },
      additionalProperties: true,
    },
    actions: { type: 'array' as const, items: { type: 'string' as const }, description: 'List of tools/steps you used' },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1, description: '0-1 confidence score' },
  },
  required: ['success', 'summary', 'data', 'actions', 'confidence'] as const,
  additionalProperties: false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export async function callGoogle(
  prompt: string,
  context: string,
  persona: PersonaDefinition,
  config: AgentConfig,
  options?: AgentCallOptions,
): Promise<AgentResult> {
  const startTime = Date.now();
  const modelName = options?.model ?? config.model;

  logDebug(`Using model: ${modelName}`);
  logDebug(`Persona: ${persona.name}`);

  // Create Google AI provider instance
  const google = createGoogleGenerativeAI({
    apiKey: config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  // Build provider options for thinking config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerOptions: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleOpts: Record<string, any> = {};

  // Add thinking config if specified
  if (options?.thinking) {
    const thinking = options.thinking;
    if (thinking.budget !== undefined) {
      googleOpts['thinkingConfig'] = { thinkingBudget: thinking.budget };
    } else if (thinking.level) {
      googleOpts['thinkingConfig'] = { thinkingLevel: thinking.level };
    }
  }

  if (Object.keys(googleOpts).length > 0) {
    providerOptions['google'] = googleOpts;
  }

  // Note: Gemini's built-in tools (code_execution, google_search) are
  // incompatible with structured JSON output (response_mime_type: application/json).
  // Since structured output is essential for AgentResult, we skip built-in tools
  // and rely on the model's knowledge + structured output instead.
  if (!config.localOnly) {
    const toolNames = options?.tools ?? persona.defaultTools;
    logDebug(`Persona tools (informational): ${toolNames.join(', ')}`);
  }

  // Build the user message with context
  const userMessage = context
    ? `${prompt}\n\n--- Context ---\n${context}`
    : prompt;

  // Collect tool calls across steps
  const collectedToolCalls: ToolCall[] = [];

  // Create the ToolLoopAgent for multi-step reasoning
  const agent = new ToolLoopAgent({
    model: google(modelName),
    instructions: persona.systemPrompt,
    maxOutputTokens: config.budget.maxTokensPerCall,
    output: Output.object({ schema: agentOutputSchema }),
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    onStepFinish: (step) => {
      // Collect tool calls from each step
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          collectedToolCalls.push({
            name: tc.toolName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: (tc as any).args ?? {},
            result: tc.toolName,
          });
        }
      }
      logDebug(`Step finished: ${step.finishReason}`);
    },
  });

  // Execute the agent
  const result = await agent.generate({
    prompt: userMessage,
    timeout: config.timeout,
  });

  const latencyMs = Date.now() - startTime;
  const tokensUsed = result.usage?.totalTokens ?? 0;

  logDebug(`Response received: ${latencyMs}ms, ${tokensUsed} tokens`);

  // If we got structured output, use it directly
  if (result.output) {
    const output = result.output as {
      success: boolean;
      summary: string;
      reasoning?: string;
      data: Record<string, unknown>;
      actions: string[];
      confidence: number;
    };
    return {
      success: output.success,
      summary: output.summary,
      reasoning: output.reasoning,
      data: output.data,
      actions: output.actions,
      confidence: output.confidence,
      metadata: {
        model: modelName,
        tokensUsed,
        latencyMs,
        toolCalls: collectedToolCalls,
        cached: false,
      },
    };
  }

  // Fallback: parse text response
  const parsed = parseResponse(result.text);

  return {
    success: parsed?.success ?? true,
    summary: parsed?.summary ?? result.text.substring(0, 200),
    reasoning: parsed?.reasoning,
    data: parsed?.data ?? { raw: result.text },
    actions: parsed?.actions ?? collectedToolCalls.map((tc) => tc.name),
    confidence: parsed?.confidence ?? 0.5,
    metadata: {
      model: modelName,
      tokensUsed,
      latencyMs,
      toolCalls: collectedToolCalls,
      cached: false,
    },
  };
}

// ─── Response Parser (fallback for unstructured output) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(text: string): any {
  // Try direct JSON parse
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting JSON from markdown code fences
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Fall through
      }
    }

    // Try finding JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    // Return as raw fallback
    return {
      success: true,
      summary: text.substring(0, 200),
      data: { raw: text },
      actions: [],
      confidence: 0.5,
    };
  }
}
