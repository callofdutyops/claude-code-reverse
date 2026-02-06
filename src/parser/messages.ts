// Message parsing utilities

import type {
  CapturedRequest,
  CapturedResponse,
  SystemPrompt,
  TextContent,
  ToolUseContent,
} from '../types.js';

export interface SystemPromptAnalysis {
  fullText: string;
  sections: Array<{
    title: string;
    content: string;
    startIndex: number;
    endIndex: number;
  }>;
  wordCount: number;
  characterCount: number;
  hasCacheControl: boolean;
}

/**
 * Extract full system prompt text from request
 */
export function extractSystemPrompt(request: CapturedRequest): string {
  if (!request.system) {
    return '';
  }

  if (typeof request.system === 'string') {
    return request.system;
  }

  return request.system
    .filter((block): block is SystemPrompt => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

/**
 * Analyze system prompt structure
 */
export function analyzeSystemPrompt(request: CapturedRequest): SystemPromptAnalysis {
  const fullText = extractSystemPrompt(request);
  const sections: SystemPromptAnalysis['sections'] = [];

  // Find markdown-style headers (# Header)
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  const headerPositions: Array<{ level: number; title: string; index: number }> = [];

  while ((match = headerRegex.exec(fullText)) !== null) {
    headerPositions.push({
      level: match[1].length,
      title: match[2].trim(),
      index: match.index,
    });
  }

  // Extract sections between headers
  for (let i = 0; i < headerPositions.length; i++) {
    const current = headerPositions[i];
    const next = headerPositions[i + 1];
    const endIndex = next ? next.index : fullText.length;

    // Get content after the header line
    const headerEndIndex = fullText.indexOf('\n', current.index);
    const content = fullText.slice(
      headerEndIndex + 1,
      endIndex
    ).trim();

    sections.push({
      title: current.title,
      content,
      startIndex: current.index,
      endIndex,
    });
  }

  // Check for cache control
  const hasCacheControl = Array.isArray(request.system) &&
    request.system.some((block) => block.cache_control?.type === 'ephemeral');

  return {
    fullText,
    sections,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    characterCount: fullText.length,
    hasCacheControl,
  };
}

/**
 * Extract tool uses from response
 */
export function extractToolUses(response: CapturedResponse): ToolUseContent[] {
  return response.content.filter(
    (block): block is ToolUseContent => block.type === 'tool_use'
  );
}

/**
 * Get conversation statistics
 */
export function getConversationStats(
  requests: CapturedRequest[],
  responses: CapturedResponse[]
): {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  averageResponseTime: number;
} {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;

  for (const request of requests) {
    for (const msg of request.messages) {
      if (msg.role === 'user') userMessages++;
      else assistantMessages++;
    }
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let totalResponseTime = 0;

  for (const response of responses) {
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    cacheReadTokens += response.usage.cache_read_input_tokens || 0;
    cacheCreationTokens += response.usage.cache_creation_input_tokens || 0;
    totalResponseTime += response.duration_ms;

    toolCalls += response.content.filter((b) => b.type === 'tool_use').length;
  }

  return {
    totalMessages: userMessages + assistantMessages,
    userMessages,
    assistantMessages,
    toolCalls,
    totalInputTokens,
    totalOutputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    averageResponseTime: responses.length > 0 ? totalResponseTime / responses.length : 0,
  };
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
