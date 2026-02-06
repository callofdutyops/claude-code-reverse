// SSE Stream handling for Claude API responses

import type {
  SSEEvent,
  StreamEvent,
  ContentBlock,
  TokenUsage,
  TextContent,
  ToolUseContent,
} from '../types.js';

export interface StreamAccumulator {
  messageId: string;
  model: string;
  content: ContentBlock[];
  currentBlockIndex: number;
  currentBlock: Partial<ContentBlock> | null;
  currentText: string;
  currentJson: string;
  stopReason: string | null;
  usage: TokenUsage;
}

export function createStreamAccumulator(): StreamAccumulator {
  return {
    messageId: '',
    model: '',
    content: [],
    currentBlockIndex: -1,
    currentBlock: null,
    currentText: '',
    currentJson: '',
    stopReason: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

export function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6); // Remove 'data: ' prefix

  if (data === '[DONE]') {
    return { event: 'done', data: '' };
  }

  try {
    return { event: 'message', data };
  } catch {
    return null;
  }
}

export function processStreamEvent(
  accumulator: StreamAccumulator,
  event: StreamEvent
): void {
  switch (event.type) {
    case 'message_start':
      accumulator.messageId = event.message.id;
      accumulator.model = event.message.model;
      accumulator.usage = { ...event.message.usage };
      break;

    case 'content_block_start':
      accumulator.currentBlockIndex = event.index;
      accumulator.currentBlock = { ...event.content_block };
      accumulator.currentText = '';
      accumulator.currentJson = '';

      if (event.content_block.type === 'text') {
        accumulator.currentText = (event.content_block as TextContent).text || '';
      }
      // For tool_use, input starts empty and is built via input_json_delta events
      break;

    case 'content_block_delta':
      if (event.delta.type === 'text_delta' && event.delta.text) {
        accumulator.currentText += event.delta.text;
      } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
        accumulator.currentJson += event.delta.partial_json;
      }
      break;

    case 'content_block_stop':
      if (accumulator.currentBlock) {
        if (accumulator.currentBlock.type === 'text') {
          accumulator.content.push({
            type: 'text',
            text: accumulator.currentText,
          } as TextContent);
        } else if (accumulator.currentBlock.type === 'tool_use') {
          const toolBlock = accumulator.currentBlock as Partial<ToolUseContent>;
          let parsedInput = {};
          try {
            if (accumulator.currentJson) {
              parsedInput = JSON.parse(accumulator.currentJson);
            }
          } catch {
            // Keep empty object if JSON parsing fails
          }
          accumulator.content.push({
            type: 'tool_use',
            id: toolBlock.id || '',
            name: toolBlock.name || '',
            input: parsedInput,
          } as ToolUseContent);
        }
      }
      accumulator.currentBlock = null;
      break;

    case 'message_delta':
      accumulator.stopReason = event.delta.stop_reason;
      if (event.usage) {
        accumulator.usage.output_tokens = event.usage.output_tokens;
      }
      break;

    case 'message_stop':
      // Message complete
      break;
  }
}

export class SSEParser {
  private buffer: string = '';
  private accumulator: StreamAccumulator;

  constructor() {
    this.accumulator = createStreamAccumulator();
  }

  processChunk(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) {
        continue; // Skip empty lines and comments
      }

      const sseEvent = parseSSELine(trimmed);
      if (sseEvent && sseEvent.event === 'message' && sseEvent.data) {
        try {
          const parsed = JSON.parse(sseEvent.data) as StreamEvent;
          processStreamEvent(this.accumulator, parsed);
          events.push(parsed);
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return events;
  }

  getAccumulator(): StreamAccumulator {
    return this.accumulator;
  }

  reset(): void {
    this.buffer = '';
    this.accumulator = createStreamAccumulator();
  }
}
