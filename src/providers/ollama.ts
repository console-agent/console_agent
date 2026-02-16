/**
 * Ollama AI provider — integrates with local/cloud Ollama models via ai-sdk-ollama.
 *
 * Uses the Vercel AI SDK's generateText with ollama provider (jagreehal/ai-sdk-ollama).
 * Tools are NOT supported in v1 — Gemini-specific tools (google_search,
 * url_context, code_execution) are incompatible with Ollama.
 *
 * Execution path:
 * - Structured JSON output via generateText with JSON mode prompt instructions.
 */

import type { AgentConfig, AgentCallOptions, AgentResult, PersonaDefinition, ToolCall, FileAttachment } from '../types.js';
import { formatSourceForContext, type SourceFileInfo } from '../utils/caller-file.js';
import { logDebug } from '../utils/format.js';

// ─── JSON prompt suffix ──────────────────────────────────────────────────────

const JSON_RESPONSE_INSTRUCTION = `

IMPORTANT: You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text).
Use this exact format:
{"success": true, "summary": "one-line conclusion", "reasoning": "your thought process", "data": {"result": "primary finding"}, "actions": ["tools/steps used"], "confidence": 0.95}`;

// ─── Message Builder ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMessages(
  prompt: string,
  context: string,
  sourceFile?: SourceFileInfo | null,
  _files?: FileAttachment[],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  parts.push({ type: 'text', text: prompt });

  if (context) {
    parts.push({ type: 'text', text: `\n--- Context ---\n${context}` });
  }

  if (sourceFile) {
    const formatted = formatSourceForContext(sourceFile);
    parts.push({ type: 'text', text: `\n${formatted}` });
  }

  // Note: File attachments have limited support with Ollama.
  // Only text-based files are included as context.
  if (_files && _files.length > 0) {
    logDebug('WARNING: File attachments have limited support with Ollama. Only text-based files included as context.');
  }

  return [{ role: 'user' as const, content: parts }];
}

// ─── Response Parser ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch { /* fall through */ }
    }
    return {
      success: true,
      summary: text.substring(0, 200),
      data: { raw: text },
      actions: [],
      confidence: 0.5,
    };
  }
}

// ─── Provider Entry Point ────────────────────────────────────────────────────

export async function callOllama(
  prompt: string,
  context: string,
  persona: PersonaDefinition,
  config: AgentConfig,
  options?: AgentCallOptions,
  sourceFile?: SourceFileInfo | null,
  files?: FileAttachment[],
): Promise<AgentResult> {
  const startTime = Date.now();
  let modelName = options?.model ?? config.model;

  // Default to llama3.2 if model is still the Google default
  if (modelName.startsWith('gemini')) {
    modelName = 'llama3.2';
    logDebug(`Ollama provider: defaulting model to ${modelName}`);
  }

  logDebug(`Using model: ${modelName}`);
  logDebug(`Persona: ${persona.name}`);

  const host = config.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434';

  // Warn if tools were requested (not supported for Ollama v1)
  if (options?.tools && options.tools.length > 0) {
    logDebug('WARNING: Tools are not supported with the Ollama provider. Tools will be ignored. Use provider="google" for tool support.');
  }

  // Warn if thinking config was requested
  if (options?.thinking) {
    logDebug('WARNING: Thinking config is not supported with the Ollama provider. It will be ignored.');
  }

  logDebug(`Ollama host: ${host}`);

  // Dynamic import — ai-sdk-ollama by jagreehal
  const { createOllama } = await import('ai-sdk-ollama');
  const { generateText } = await import('ai');

  const ollama = createOllama({ baseURL: host });

  // Determine if custom schema is in use
  const useCustomSchema = !!(options?.schema || options?.responseFormat);

  const systemPrompt = useCustomSchema
    ? `${persona.systemPrompt}\n\nIMPORTANT: You must respond with structured data matching the requested output schema. Do not include AgentResult wrapper fields — just return the data matching the schema.`
    : persona.systemPrompt + JSON_RESPONSE_INSTRUCTION;

  const messages = buildMessages(prompt, context, sourceFile, files);

  const result = await generateText({
    model: ollama(modelName),
    system: systemPrompt,
    messages,
    maxOutputTokens: config.budget.maxTokensPerCall,
    abortSignal: AbortSignal.timeout(config.timeout),
  });

  const latencyMs = Date.now() - startTime;
  const tokensUsed = result.usage?.totalTokens ?? 0;
  const collectedToolCalls: ToolCall[] = [];

  logDebug(`Response received: ${latencyMs}ms, ${tokensUsed} tokens`);

  // Custom schema: wrap in AgentResult
  if (useCustomSchema) {
    const parsed = parseResponse(result.text);
    const customData = parsed && !parsed.raw ? parsed : { result: result.text };
    logDebug('Custom schema output received, wrapping in AgentResult');
    return {
      success: true,
      summary: `Structured output returned (${Object.keys(customData).length} fields)`,
      data: customData,
      actions: [],
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

  // Default: parse JSON response
  const parsed = parseResponse(result.text);

  return {
    success: parsed?.success ?? true,
    summary: parsed?.summary ?? result.text.substring(0, 200),
    reasoning: parsed?.reasoning,
    data: parsed?.data ?? { raw: result.text },
    actions: parsed?.actions ?? [],
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
