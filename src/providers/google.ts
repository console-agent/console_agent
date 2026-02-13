/**
 * Google AI provider — integrates with Gemini via @ai-sdk/google + Vercel AI SDK.
 * Uses ToolLoopAgent for multi-step reasoning and tool calling.
 * This is the only provider in v1.0.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ToolLoopAgent } from 'ai';
import * as z from 'zod';
import type { AgentConfig, AgentCallOptions, AgentResult, PersonaDefinition, ToolCall } from '../types.js';
import { logDebug } from '../utils/format.js';

// ─── Structured Output Schema ────────────────────────────────────────────────

const agentOutputSchema = z.object({
  success: z.boolean().describe('Whether the task was completed successfully'),
  summary: z.string().describe('One-line human-readable conclusion'),
  reasoning: z.string().optional().describe('Your thought process'),
  data: z.record(z.unknown()).describe('Structured findings as key-value pairs'),
  actions: z.array(z.string()).describe('List of tools/steps you used'),
  confidence: z.number().min(0).max(1).describe('0-1 confidence score'),
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

  // Build provider options (Google built-in tools + thinking)
  const providerOptions: Record<string, unknown> = {};
  const googleOpts: Record<string, unknown> = {};

  // Add built-in tools if not in localOnly mode
  if (!config.localOnly) {
    const toolNames = options?.tools ?? persona.defaultTools;
    logDebug(`Tools enabled: ${toolNames.join(', ')}`);

    for (const tool of toolNames) {
      const name = typeof tool === 'string' ? tool : tool.type;
      if (name === 'code_execution') {
        googleOpts['codeExecution'] = true;
      }
      if (name === 'google_search') {
        googleOpts['googleSearch'] = true;
      }
    }
  }

  // Add thinking config if specified
  if (options?.thinking) {
    const thinking = options.thinking;
    if (thinking.budget !== undefined) {
      // Gemini 2.5 models use thinkingBudget
      googleOpts['thinkingConfig'] = { thinkingBudget: thinking.budget };
    } else if (thinking.level) {
      // Gemini 3 models use thinkingLevel
      googleOpts['thinkingConfig'] = { thinkingLevel: thinking.level.toUpperCase() };
    }
  }

  if (Object.keys(googleOpts).length > 0) {
    providerOptions['google'] = googleOpts;
  }

  // Build the user message with context
  const userMessage = context
    ? `${prompt}\n\n--- Context ---\n${context}`
    : prompt;

  // Collect tool calls across steps
  const collectedToolCalls: ToolCall[] = [];

  // Create the ToolLoopAgent
  const agent = new ToolLoopAgent({
    model: google(modelName),
    instructions: persona.systemPrompt,
    maxOutputTokens: config.budget.maxTokensPerCall,
    output: {
      schema: agentOutputSchema,
    },
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    onStepFinish: (step) => {
      // Collect tool calls from each step
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          collectedToolCalls.push({
            name: tc.toolName,
            args: tc.args as Record<string, unknown>,
            result: tc.toolName, // store tool name as action
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
    return {
      ...result.output,
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
