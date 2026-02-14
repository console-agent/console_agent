/**
 * Google AI provider — integrates with Gemini via @ai-sdk/google + Vercel AI SDK.
 *
 * Two execution paths:
 * 1. WITHOUT tools → ToolLoopAgent with structured output (JSON schema)
 * 2. WITH tools → generateText with provider tools (google_search, code_execution, etc.)
 *    Tools are incompatible with structured JSON output at the Gemini API level,
 *    so we instruct the model via prompt and parse the text response.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ToolLoopAgent, Output, jsonSchema, generateText, stepCountIs, type ToolSet } from 'ai';
import type { AgentConfig, AgentCallOptions, AgentResult, PersonaDefinition, ToolCall } from '../types.js';
import { resolveTools, hasExplicitTools, TOOLS_MIN_TIMEOUT } from '../tools/index.js';
import { logDebug } from '../utils/format.js';
import { z } from 'zod';

// ─── Structured Output Schema (JSON Schema compatible with Gemini) ───────────

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

// ─── JSON prompt suffix for tool-mode (no structured output available) ───────

const JSON_RESPONSE_INSTRUCTION = `

IMPORTANT: You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text).
Use this exact format:
{"success": true, "summary": "one-line conclusion", "reasoning": "your thought process", "data": {"result": "primary finding"}, "actions": ["tools/steps used"], "confidence": 0.95}`;

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

  // ─── Resolve tools (opt-in only) ──────────────────────────────────────────
  const useTools = hasExplicitTools(options) && !config.localOnly;

  if (useTools) {
    logDebug('Tools requested — using generateText path (no structured output)');
    return callWithTools(prompt, context, persona, config, options!, google, modelName, startTime, providerOptions);
  }

  logDebug('No tools — using ToolLoopAgent with structured output');
  return callWithStructuredOutput(prompt, context, persona, config, options, google, modelName, startTime, providerOptions);
}

// ─── Path 1: WITH TOOLS (generateText, no structured output) ────────────────

async function callWithTools(
  prompt: string,
  context: string,
  persona: PersonaDefinition,
  config: AgentConfig,
  options: AgentCallOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any,
  modelName: string,
  startTime: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerOptions: Record<string, any>,
): Promise<AgentResult> {
  const resolvedTools = resolveTools(options.tools!, google);
  const toolNames = Object.keys(resolvedTools);
  logDebug(`Tools enabled: ${toolNames.join(', ')}`);

  const effectiveTimeout = Math.max(config.timeout, TOOLS_MIN_TIMEOUT);

  // Build user message
  const userMessage = context
    ? `${prompt}\n\n--- Context ---\n${context}`
    : prompt;

  // Use generateText with provider tools
  // Provider tools (google_search, code_execution, url_context) run server-side
  // and are incompatible with structured JSON output (response_mime_type).
  const result = await generateText({
    model: google(modelName),
    system: persona.systemPrompt + JSON_RESPONSE_INSTRUCTION,
    prompt: userMessage,
    tools: resolvedTools as ToolSet,
    stopWhen: stepCountIs(5), // Allow multi-step: tool invocation → response
    maxOutputTokens: config.budget.maxTokensPerCall,
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    abortSignal: AbortSignal.timeout(effectiveTimeout),
  });

  const latencyMs = Date.now() - startTime;
  const tokensUsed = result.usage?.totalTokens ?? 0;

  logDebug(`Response received (tools path): ${latencyMs}ms, ${tokensUsed} tokens`);

  // Collect tool calls from steps
  const collectedToolCalls: ToolCall[] = [];
  if (result.steps) {
    for (const step of result.steps) {
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
    }
  }

  logDebug(`Tool calls collected: ${collectedToolCalls.length}`);

  // Parse text response (no structured output in tools mode)
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

// ─── Path 2: WITHOUT TOOLS (ToolLoopAgent, structured output) ────────────────

async function callWithStructuredOutput(
  prompt: string,
  context: string,
  persona: PersonaDefinition,
  config: AgentConfig,
  options: AgentCallOptions | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google: any,
  modelName: string,
  startTime: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerOptions: Record<string, any>,
): Promise<AgentResult> {
  const userMessage = context
    ? `${prompt}\n\n--- Context ---\n${context}`
    : prompt;

  const collectedToolCalls: ToolCall[] = [];

  // Determine output schema
  const useCustomSchema = !!(options?.schema || options?.responseFormat);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let outputConfig: any;

  if (options?.schema) {
    if (options.responseFormat) {
      logDebug('Both schema (Zod) and responseFormat provided — using schema (Zod)');
    }
    logDebug('Using custom Zod schema for structured output');
    outputConfig = Output.object({ schema: options.schema });
  } else if (options?.responseFormat) {
    logDebug('Using custom JSON Schema (responseFormat) for structured output');
    outputConfig = Output.object({ schema: jsonSchema(options.responseFormat.schema) });
  } else {
    outputConfig = Output.object({ schema: agentOutputSchema });
  }

  const agent = new ToolLoopAgent({
    model: google(modelName),
    instructions: useCustomSchema
      ? `${persona.systemPrompt}\n\nIMPORTANT: You must respond with structured data matching the requested output schema. Do not include AgentResult wrapper fields — just return the data matching the schema.`
      : persona.systemPrompt,
    maxOutputTokens: config.budget.maxTokensPerCall,
    output: outputConfig,
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    onStepFinish: (step) => {
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

  const result = await agent.generate({
    prompt: userMessage,
    timeout: config.timeout,
  });

  const latencyMs = Date.now() - startTime;
  const tokensUsed = result.usage?.totalTokens ?? 0;

  logDebug(`Response received: ${latencyMs}ms, ${tokensUsed} tokens`);

  // Custom schema: wrap AI output in AgentResult
  if (useCustomSchema && result.output) {
    const customData = result.output as Record<string, unknown>;
    logDebug('Custom schema output received, wrapping in AgentResult');
    return {
      success: true,
      summary: `Structured output returned (${Object.keys(customData).length} fields)`,
      data: customData,
      actions: collectedToolCalls.map((tc) => tc.name),
      confidence: 1,
      metadata: {
        model: modelName,
        tokensUsed,
        latencyMs,
        toolCalls: collectedToolCalls,
        cached: false,
      },
    };
  }

  // Default schema: use AgentResult fields directly
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
