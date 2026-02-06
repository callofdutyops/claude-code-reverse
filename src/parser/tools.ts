// Tool parsing and analysis utilities

import type {
  CapturedRequest,
  CapturedResponse,
  ToolCall,
  ToolUseContent,
  ToolResultContent,
} from '../types.js';

export interface ToolStats {
  name: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
}

export interface ToolCallWithResult extends ToolCall {
  request_id: string;
  timestamp: string;
}

/**
 * Pair tool_use with tool_result across messages
 */
export function pairToolCallsWithResults(
  requests: CapturedRequest[],
  responses: CapturedResponse[]
): ToolCallWithResult[] {
  const toolCalls: ToolCallWithResult[] = [];
  const pendingToolUses = new Map<string, { toolUse: ToolUseContent; requestId: string; timestamp: string }>();

  // Build a map of request_id -> response for quick lookup
  const responseMap = new Map<string, CapturedResponse>();
  for (const response of responses) {
    responseMap.set(response.request_id, response);
  }

  for (const request of requests) {
    // Get tool uses from the response
    const response = responseMap.get(request.id);
    if (response) {
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const toolUse = block as ToolUseContent;
          pendingToolUses.set(toolUse.id, {
            toolUse,
            requestId: request.id,
            timestamp: response.timestamp,
          });
        }
      }
    }

    // Look for tool results in user messages
    for (const message of request.messages) {
      if (message.role === 'user' && Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'tool_result') {
            const toolResult = block as ToolResultContent;
            const pending = pendingToolUses.get(toolResult.tool_use_id);

            if (pending) {
              toolCalls.push({
                id: pending.toolUse.id,
                name: pending.toolUse.name,
                input: pending.toolUse.input,
                result: typeof toolResult.content === 'string'
                  ? toolResult.content
                  : toolResult.content,
                is_error: toolResult.is_error,
                request_id: pending.requestId,
                timestamp: pending.timestamp,
              });
              pendingToolUses.delete(toolResult.tool_use_id);
            }
          }
        }
      }
    }
  }

  // Add any remaining tool uses without results
  for (const [id, pending] of pendingToolUses) {
    toolCalls.push({
      id,
      name: pending.toolUse.name,
      input: pending.toolUse.input,
      request_id: pending.requestId,
      timestamp: pending.timestamp,
    });
  }

  return toolCalls;
}

/**
 * Calculate statistics for each tool
 */
export function calculateToolStats(toolCalls: ToolCallWithResult[]): Map<string, ToolStats> {
  const statsMap = new Map<string, ToolStats>();

  for (const call of toolCalls) {
    let stats = statsMap.get(call.name);
    if (!stats) {
      stats = {
        name: call.name,
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        successRate: 0,
      };
      statsMap.set(call.name, stats);
    }

    stats.callCount++;
    if (call.result !== undefined) {
      if (call.is_error) {
        stats.errorCount++;
      } else {
        stats.successCount++;
      }
    }
    if (call.duration_ms) {
      stats.totalDuration += call.duration_ms;
    }
  }

  // Calculate averages and rates
  for (const stats of statsMap.values()) {
    stats.averageDuration = stats.callCount > 0 ? stats.totalDuration / stats.callCount : 0;
    const completedCalls = stats.successCount + stats.errorCount;
    stats.successRate = completedCalls > 0 ? stats.successCount / completedCalls : 1;
  }

  return statsMap;
}

/**
 * Get tool call frequency by name
 */
export function getToolCallFrequency(toolCalls: ToolCallWithResult[]): Array<{ name: string; count: number }> {
  const frequency = new Map<string, number>();

  for (const call of toolCalls) {
    frequency.set(call.name, (frequency.get(call.name) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

