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

function getAgentType(system: SystemPrompt[] | undefined): { label: string; color: string; glow: string } {
  const text = extractSystemPromptText(system);
  const length = text.length;

  if (!text) {
    return { label: 'Unknown', color: '#555', glow: 'none' };
  }

  // Check for specific agent types
  if (text.includes('isNewTopic') || text.includes('new conversation topic') || text.includes('extract a 2-3 word title')) {
    return { label: 'Title', color: '#bf00ff', glow: '0 0 10px rgba(191, 0, 255, 0.5)' };
  }

  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) {
    return { label: 'Explore', color: '#00d4ff', glow: '0 0 10px rgba(0, 212, 255, 0.5)' };
  }

  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) {
    return { label: 'Plan', color: '#ffff00', glow: '0 0 10px rgba(255, 255, 0, 0.5)' };
  }

  if (text.includes('code review') || text.includes('Code review')) {
    return { label: 'Review', color: '#39ff14', glow: '0 0 10px rgba(57, 255, 20, 0.5)' };
  }

  if (text.includes('Bash agent') || text.includes('bash commands')) {
    return { label: 'Bash', color: '#ff6b35', glow: '0 0 10px rgba(255, 107, 53, 0.5)' };
  }

  // Check for sub-agent markers
  if (length < 15000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) {
    return { label: 'Sub-agent', color: '#ff00ff', glow: '0 0 10px rgba(255, 0, 255, 0.5)' };
  }

  // Main agent - full CLI description and long
  if (text.includes('Claude Code, Anthropic\'s official CLI') && length > 20000) {
    return { label: 'Main', color: '#00fff5', glow: '0 0 10px rgba(0, 255, 245, 0.5)' };
  }

  if (length < 2000) {
    return { label: 'Short', color: '#666', glow: 'none' };
  }

  return { label: 'Agent', color: '#00d4ff', glow: '0 0 10px rgba(0, 212, 255, 0.5)' };
}

function getSummary(pair: RequestResponsePair): string {
  const { request, response } = pair;

  // Get last user message
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
    // Check for tool results
    const toolResults = content.filter((b) => b.type === 'tool_result');
    if (toolResults.length > 0) {
      return `Tool results: ${toolResults.length}`;
    }
  }

  // Fallback to response info
  if (response) {
    const toolUses = response.content.filter((b): b is ToolUseContent => b.type === 'tool_use');
    if (toolUses.length > 0) {
      return `Tools: ${toolUses.map((t) => t.name).join(', ')}`;
    }
  }

  return 'API call';
}

function getToolCount(pair: RequestResponsePair): number {
  if (!pair.response) return 0;
  return pair.response.content.filter((b) => b.type === 'tool_use').length;
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
      <div className="empty">
        No API calls captured yet. Start Claude Code with the proxy to see data.
      </div>
    );
  }

  return (
    <div className="timeline">
      {pairs.map((pair, index) => {
        const toolCount = getToolCount(pair);
        const toolNames = getToolNames(pair);
        const agent = getAgentType(pair.request.system);

        return (
          <div
            key={pair.request.id}
            className={`timeline-item ${selectedId === pair.request.id ? 'selected' : ''}`}
            onClick={() => onSelect(pair.request.id)}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="timeline-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  color: '#555',
                  minWidth: '24px',
                }}>
                  #{index + 1}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: `${agent.color}20`,
                  border: `1px solid ${agent.color}50`,
                  color: agent.color,
                  fontWeight: 'bold',
                  boxShadow: agent.glow,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {agent.label}
                </span>
                <span className="timeline-time">{formatTime(pair.request.timestamp)}</span>
              </div>
              <span className="timeline-model">{pair.request.model}</span>
            </div>

            <div className="timeline-summary" style={{ marginTop: '0.25rem' }}>
              {getSummary(pair)}
            </div>

            {toolCount > 0 && (
              <div style={{
                fontSize: '0.65rem',
                marginTop: '0.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
              }}>
                {toolNames.slice(0, 5).map((name, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-display)',
                    background: 'rgba(57, 255, 20, 0.1)',
                    border: '1px solid rgba(57, 255, 20, 0.3)',
                    color: '#39ff14',
                    padding: '0.1rem 0.375rem',
                    borderRadius: '3px',
                    transition: 'all 0.2s ease',
                  }}>
                    {name}
                  </span>
                ))}
                {toolNames.length > 5 && (
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    color: '#555',
                    padding: '0.1rem 0.25rem',
                  }}>
                    +{toolNames.length - 5} more
                  </span>
                )}
              </div>
            )}

            {pair.response && (
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.65rem',
                marginTop: '0.5rem',
                color: '#555',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}>
                <span style={{ color: '#00fff5' }}>
                  {pair.response.usage.input_tokens.toLocaleString()} in
                </span>
                <span style={{ color: '#555' }}>/</span>
                <span style={{ color: '#ff00ff' }}>
                  {pair.response.usage.output_tokens.toLocaleString()} out
                </span>
                {pair.response.usage.cache_read_input_tokens ? (
                  <>
                    <span style={{ color: '#555' }}>/</span>
                    <span style={{ color: '#ffff00' }}>
                      {pair.response.usage.cache_read_input_tokens.toLocaleString()} cached
                    </span>
                  </>
                ) : null}
                <span style={{ color: '#555' }}>/</span>
                <span style={{ color: '#888' }}>
                  {pair.response.duration_ms}ms
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
