import { cn } from '@/lib/utils';
import type { RequestResponsePair, TextContent, ToolUseContent, SystemPrompt } from '../types';

interface TimelineProps {
  pairs: RequestResponsePair[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function extractSystemPromptText(system: SystemPrompt[] | undefined): string {
  if (!system) return '';
  return system
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

const AGENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Title: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  Explore: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  Plan: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  Review: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  Bash: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'Sub-agent': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  Main: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  Short: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', border: 'border-zinc-500/20' },
  Agent: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  Unknown: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', border: 'border-zinc-500/20' },
};

function getAgentType(system: SystemPrompt[] | undefined): string {
  const text = extractSystemPromptText(system);
  const length = text.length;

  if (!text) return 'Unknown';
  if (text.includes('isNewTopic') || text.includes('new conversation topic') || text.includes('extract a 2-3 word title')) return 'Title';
  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) return 'Explore';
  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) return 'Plan';
  if (text.includes('code review') || text.includes('Code review')) return 'Review';
  if (text.includes('Bash agent') || text.includes('bash commands')) return 'Bash';
  if (length < 15000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) return 'Sub-agent';
  if (text.includes('Claude Code, Anthropic\'s official CLI') && length > 20000) return 'Main';
  if (length < 2000) return 'Short';
  return 'Agent';
}

function getSummary(pair: RequestResponsePair): string {
  const { request, response } = pair;

  const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg) {
    const content = lastUserMsg.content;
    if (typeof content === 'string') {
      return content.slice(0, 100) + (content.length > 100 ? '...' : '');
    }
    const textBlocks = content.filter((b): b is TextContent => b.type === 'text');
    if (textBlocks.length > 0) {
      const text = textBlocks[0].text;
      return text.slice(0, 100) + (text.length > 100 ? '...' : '');
    }
    const toolResults = content.filter((b) => b.type === 'tool_result');
    if (toolResults.length > 0) {
      return `Tool results: ${toolResults.length}`;
    }
  }

  if (response) {
    const toolUses = response.content.filter((b): b is ToolUseContent => b.type === 'tool_use');
    if (toolUses.length > 0) {
      return `Tools: ${toolUses.map((t) => t.name).join(', ')}`;
    }
  }

  return 'API call';
}

function getToolNames(pair: RequestResponsePair): string[] {
  if (!pair.response) return [];
  return pair.response.content
    .filter((b): b is ToolUseContent => b.type === 'tool_use')
    .map((t) => t.name);
}

export const Timeline: React.FC<TimelineProps> = ({ pairs, selectedId, onSelect }) => {
  if (pairs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No API calls captured yet. Start Claude Code with the proxy to see data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {pairs.map((pair, index) => {
        const toolNames = getToolNames(pair);
        const agentLabel = getAgentType(pair.request.system);
        const style = AGENT_STYLES[agentLabel] || AGENT_STYLES.Unknown;

        return (
          <div
            key={pair.request.id}
            className={cn(
              'px-4 py-3 rounded-lg cursor-pointer transition-colors border',
              selectedId === pair.request.id
                ? 'bg-accent border-border'
                : 'border-transparent hover:bg-accent/50'
            )}
            onClick={() => onSelect(pair.request.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono w-6">
                  #{index + 1}
                </span>
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded border',
                  style.bg, style.text, style.border
                )}>
                  {agentLabel}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatTime(pair.request.timestamp)}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {pair.request.model}
              </span>
            </div>

            <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {getSummary(pair)}
            </div>

            {toolNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {toolNames.slice(0, 5).map((name, i) => (
                  <span
                    key={i}
                    className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
                {toolNames.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{toolNames.length - 5} more
                  </span>
                )}
              </div>
            )}

            {pair.response && (
              <div className="flex items-center gap-2 mt-2 text-xs font-mono text-muted-foreground">
                <span className="text-blue-400">
                  {pair.response.usage.input_tokens.toLocaleString()} in
                </span>
                <span>/</span>
                <span className="text-emerald-400">
                  {pair.response.usage.output_tokens.toLocaleString()} out
                </span>
                {pair.response.usage.cache_read_input_tokens ? (
                  <>
                    <span>/</span>
                    <span className="text-amber-400">
                      {pair.response.usage.cache_read_input_tokens.toLocaleString()} cached
                    </span>
                  </>
                ) : null}
                <span>/</span>
                <span>{pair.response.duration_ms}ms</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
