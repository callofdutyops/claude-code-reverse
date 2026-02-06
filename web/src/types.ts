// Shared types for the web dashboard

export interface SystemPrompt {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CapturedRequest {
  id: string;
  timestamp: string;
  model: string;
  max_tokens: number;
  system?: SystemPrompt[];
  messages: Message[];
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CapturedResponse {
  request_id: string;
  timestamp: string;
  content: ContentBlock[];
  stop_reason: string | null;
  usage: TokenUsage;
  model: string;
  duration_ms: number;
}

export interface RequestResponsePair {
  request: CapturedRequest;
  response: CapturedResponse | null;
}

export interface ToolStats {
  name: string;
  count: number;
  errors: number;
}
