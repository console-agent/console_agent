// ─── Core Result Type ────────────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface AgentResult {
  /** Overall task success */
  success: boolean;
  /** Human-readable conclusion */
  summary: string;
  /** Agent's thought process (if thinking enabled) */
  reasoning?: string;
  /** Structured findings */
  data: Record<string, unknown>;
  /** Tools used / steps taken */
  actions: string[];
  /** 0-1 confidence score */
  confidence: number;
  /** Execution metadata */
  metadata: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
    toolCalls: ToolCall[];
    cached: boolean;
  };
}

// ─── Persona Types ───────────────────────────────────────────────────────────

export type PersonaName = 'debugger' | 'security' | 'architect' | 'general';

export interface PersonaDefinition {
  name: PersonaName;
  systemPrompt: string;
  icon: string;
  label: string;
  defaultTools: ToolName[];
  keywords: string[];
}

// ─── Tool Types ──────────────────────────────────────────────────────────────

export type ToolName = 'code_execution' | 'google_search' | 'url_context' | 'file_analysis';

export interface GoogleSearchConfig {
  mode?: 'MODE_DYNAMIC' | 'MODE_UNSPECIFIED';
  dynamicThreshold?: number;
}

export interface ToolConfig {
  type: ToolName;
  config?: GoogleSearchConfig;
}

// ─── Thinking Config ─────────────────────────────────────────────────────────

export interface ThinkingConfig {
  /** For gemini-3 models */
  level?: 'minimal' | 'low' | 'medium' | 'high';
  /** For gemini-2.5 models */
  budget?: number;
  /** Return reasoning summary in result */
  includeThoughts?: boolean;
}

// ─── Safety Settings ─────────────────────────────────────────────────────────

export type HarmCategory =
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT'
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT';

export type HarmBlockThreshold =
  | 'BLOCK_NONE'
  | 'BLOCK_ONLY_HIGH'
  | 'BLOCK_MEDIUM_AND_ABOVE'
  | 'BLOCK_LOW_AND_ABOVE';

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

// ─── Budget Config ───────────────────────────────────────────────────────────

export interface BudgetConfig {
  /** Max API calls per day (default: 100) */
  maxCallsPerDay: number;
  /** Max tokens per single call (default: 8000) */
  maxTokensPerCall: number;
  /** Hard daily cost cap in USD (default: 1.00) */
  costCapDaily: number;
}

// ─── File Attachment ─────────────────────────────────────────────────────────

export interface FileAttachment {
  /** File content as Buffer or Uint8Array */
  data: Buffer | Uint8Array;
  /** MIME type (e.g., 'application/pdf', 'image/png', 'text/plain') */
  mediaType: string;
  /** Optional filename for display in context */
  fileName?: string;
}

// ─── Response Format (plain JSON Schema) ─────────────────────────────────────

export interface ResponseFormat {
  /** Must be 'json_object' */
  type: 'json_object';
  /** JSON Schema object describing the desired output shape */
  schema: Record<string, unknown>;
}

// ─── Call Options (per-call overrides) ───────────────────────────────────────

export interface AgentCallOptions {
  /** Override model for this call */
  model?: string;
  /** Tools to enable */
  tools?: (ToolName | ToolConfig)[];
  /** Thinking/reasoning config */
  thinking?: ThinkingConfig;
  /** Force persona for this call */
  persona?: PersonaName;
  /** Override execution mode */
  mode?: 'fire-and-forget' | 'blocking';
  /**
   * Show full execution trace ([AGENT] prefix, tools, reasoning, metadata).
   * When false (default), only the clean answer/summary is printed.
   */
  verbose?: boolean;
  /**
   * Zod schema for typed structured output.
   * When provided, the AI returns data matching this schema.
   * The result is placed in `AgentResult.data`.
   * Takes priority over `responseFormat` if both are specified.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;
  /**
   * Plain JSON Schema for structured output (no Zod dependency needed).
   * Use `{ type: 'json_object', schema: { ... } }` with a standard JSON Schema.
   * The result is placed in `AgentResult.data`.
   */
  responseFormat?: ResponseFormat;
  /**
   * Auto-include the caller's source file as context for the AI.
   * When true, reads the file where console.agent() was called (or where
   * the Error originated) and sends it as part of the message.
   * Per-call override of global config. Default: true.
   */
  includeCallerSource?: boolean;
  /**
   * Explicit file attachments to send to the AI (PDFs, images, etc.).
   * These are sent as multipart message content alongside the prompt.
   */
  files?: FileAttachment[];
}

// ─── Global Config ───────────────────────────────────────────────────────────

export type LogLevel = 'silent' | 'errors' | 'info' | 'debug';

export interface AgentConfig {
  /** AI provider */
  provider: 'google' | 'ollama';
  /** Gemini API key (for google provider) */
  apiKey?: string;
  /** Model to use */
  model: string;
  /** Ollama server URL (default: http://localhost:11434) */
  ollamaHost: string;
  /** Default persona */
  persona: PersonaName;
  /** Budget controls */
  budget: BudgetConfig;
  /** Execution mode */
  mode: 'fire-and-forget' | 'blocking';
  /** Timeout in ms before fallback */
  timeout: number;
  /** Auto-strip secrets/PII before sending */
  anonymize: boolean;
  /** Disable cloud tools (enterprise mode) */
  localOnly: boolean;
  /** Log prompts without sending */
  dryRun: boolean;
  /** Console log level */
  logLevel: LogLevel;
  /**
   * Show full execution trace ([AGENT] prefix, tools, reasoning, metadata).
   * When false (default), only the clean answer/summary is printed.
   */
  verbose: boolean;
  /** Safety settings */
  safetySettings: SafetySetting[];
  /**
   * Auto-include the caller's source file as context for the AI.
   * When true (default), reads the file where console.agent() was called
   * (or where an Error originated) and sends it alongside the prompt.
   * Set to false via init() to disable globally.
   */
  includeCallerSource: boolean;
}

// ─── console.agent callable interface ────────────────────────────────────────

export interface AgentFunction {
  (prompt: string, context?: unknown, options?: AgentCallOptions): Promise<AgentResult>;
  security: (prompt: string, context?: unknown, options?: AgentCallOptions) => Promise<AgentResult>;
  debug: (prompt: string, context?: unknown, options?: AgentCallOptions) => Promise<AgentResult>;
  architect: (prompt: string, context?: unknown, options?: AgentCallOptions) => Promise<AgentResult>;
}
