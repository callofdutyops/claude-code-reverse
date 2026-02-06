import { useState } from 'react';
import Markdown from 'react-markdown';
import type { RequestResponsePair, TextContent, ToolUseContent, ToolResultContent, ContentBlock, SystemPrompt } from '../types';
import { JsonViewer } from './JsonViewer';

// Cyberpunk Markdown styles for system prompt
const markdownStyles = `
  .markdown-preview {
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.6;
    color: #888;
  }
  .markdown-preview h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: bold;
    margin: 1.5rem 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #2a2a35;
    color: #00fff5;
    text-shadow: 0 0 10px rgba(0, 255, 245, 0.3);
  }
  .markdown-preview h2 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: bold;
    margin: 1.25rem 0 0.5rem 0;
    color: #ff00ff;
    text-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
  }
  .markdown-preview h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: bold;
    margin: 1rem 0 0.5rem 0;
    color: #39ff14;
    text-shadow: 0 0 10px rgba(57, 255, 20, 0.3);
  }
  .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: bold;
    margin: 0.75rem 0 0.5rem 0;
    color: #ffff00;
  }
  .markdown-preview p {
    margin: 0.5rem 0;
  }
  .markdown-preview ul, .markdown-preview ol {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  .markdown-preview li {
    margin: 0.25rem 0;
  }
  .markdown-preview code {
    background: rgba(0, 255, 245, 0.1);
    border: 1px solid rgba(0, 255, 245, 0.2);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: var(--font-display);
    font-size: 0.8rem;
    color: #39ff14;
  }
  .markdown-preview pre {
    background: rgba(10, 10, 15, 0.8);
    border: 1px solid #2a2a35;
    padding: 0.75rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  .markdown-preview pre code {
    background: none;
    border: none;
    padding: 0;
  }
  .markdown-preview blockquote {
    border-left: 3px solid #ff00ff;
    padding-left: 1rem;
    margin: 0.5rem 0;
    color: #666;
  }
  .markdown-preview strong {
    color: #e8e8e8;
  }
  .markdown-preview a {
    color: #00d4ff;
  }
  .markdown-preview hr {
    border: none;
    border-top: 1px solid #2a2a35;
    margin: 1rem 0;
  }
  .markdown-preview table {
    border-collapse: collapse;
    margin: 0.5rem 0;
    width: 100%;
  }
  .markdown-preview th, .markdown-preview td {
    border: 1px solid #2a2a35;
    padding: 0.5rem;
    text-align: left;
  }
  .markdown-preview th {
    background: rgba(0, 255, 245, 0.1);
    color: #00fff5;
    font-family: var(--font-display);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

interface DetailPanelProps {
  pair: RequestResponsePair | null;
  onClose: () => void;
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

  if (text.includes('isNewTopic') || text.includes('new conversation topic')) {
    return { label: 'Title Generator', color: '#bf00ff', glow: '0 0 10px rgba(191, 0, 255, 0.5)' };
  }
  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) {
    return { label: 'Explore Agent', color: '#00d4ff', glow: '0 0 10px rgba(0, 212, 255, 0.5)' };
  }
  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) {
    return { label: 'Plan Agent', color: '#ffff00', glow: '0 0 10px rgba(255, 255, 0, 0.5)' };
  }
  if (text.includes('code review') || text.includes('Code review')) {
    return { label: 'Code Review Agent', color: '#39ff14', glow: '0 0 10px rgba(57, 255, 20, 0.5)' };
  }
  if (text.includes('Bash agent') || text.includes('bash commands')) {
    return { label: 'Bash Agent', color: '#ff6b35', glow: '0 0 10px rgba(255, 107, 53, 0.5)' };
  }
  if (length < 15000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) {
    return { label: 'Sub-agent', color: '#ff00ff', glow: '0 0 10px rgba(255, 0, 255, 0.5)' };
  }
  if (text.includes('Claude Code, Anthropic\'s official CLI') && length > 20000) {
    return { label: 'Main Agent', color: '#00fff5', glow: '0 0 10px rgba(0, 255, 245, 0.5)' };
  }
  if (length < 2000) {
    return { label: 'Short Prompt', color: '#666', glow: 'none' };
  }
  return { label: 'Agent', color: '#00d4ff', glow: '0 0 10px rgba(0, 212, 255, 0.5)' };
}

function formatContent(content: string | ContentBlock[], useMarkdown: boolean = true): React.ReactNode {
  if (typeof content === 'string') {
    return useMarkdown ? (
      <div className="message-content markdown-preview">
        <Markdown>{content}</Markdown>
      </div>
    ) : (
      <div className="message-content" style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'var(--font-display)',
        fontSize: '0.75rem',
        color: '#888',
      }}>
        {content}
      </div>
    );
  }

  return content.map((block, i) => {
    if (block.type === 'text') {
      const textBlock = block as TextContent;
      return useMarkdown ? (
        <div key={i} className="message-content markdown-preview">
          <Markdown>{textBlock.text}</Markdown>
        </div>
      ) : (
        <div key={i} className="message-content" style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-display)',
          fontSize: '0.75rem',
          color: '#888',
        }}>
          {textBlock.text}
        </div>
      );
    }
    if (block.type === 'tool_use') {
      const toolBlock = block as ToolUseContent;
      return (
        <div key={i} className="tool-call">
          <div className="tool-call-name">Tool: {toolBlock.name}</div>
          <div className="tool-call-input">
            {JSON.stringify(toolBlock.input, null, 2).slice(0, 500)}
          </div>
        </div>
      );
    }
    if (block.type === 'tool_result') {
      const resultBlock = block as ToolResultContent;
      const resultText = typeof resultBlock.content === 'string'
        ? resultBlock.content
        : resultBlock.content.map((c) => c.text || '').join('\n');
      return (
        <div key={i} className="tool-call" style={{
          borderColor: resultBlock.is_error ? '#ff6b35' : '#39ff14',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            color: resultBlock.is_error ? '#ff6b35' : '#39ff14',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Tool Result {resultBlock.is_error && '(Error)'}
          </div>
          <div className="tool-call-input">
            {resultText.slice(0, 500)}
            {resultText.length > 500 && '...'}
          </div>
        </div>
      );
    }
    return null;
  });
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ pair, onClose }) => {
  const [tab, setTab] = useState<'conversation' | 'system' | 'tools' | 'raw'>('conversation');
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [systemViewMode, setSystemViewMode] = useState<'preview' | 'raw'>('preview');
  const [conversationSystemViewMode, setConversationSystemViewMode] = useState<'preview' | 'raw'>('preview');
  const [messagesViewMode, setMessagesViewMode] = useState<'preview' | 'raw'>('preview');

  if (!pair) return null;

  const { request, response } = pair;
  const systemPromptText = extractSystemPromptText(request.system);
  const agent = getAgentType(request.system);
  const toolUses = response?.content.filter((b): b is ToolUseContent => b.type === 'tool_use') || [];

  return (
    <div className="detail-panel">
      <style>{markdownStyles}</style>
      <div className="detail-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'bold',
              color: '#00fff5',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              API Call Details
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
            }}>
              {agent.label}
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.7rem',
            color: '#555',
            marginTop: '0.25rem',
          }}>
            {new Date(request.timestamp).toLocaleString()} | {request.model}
          </div>
        </div>
        <button className="detail-close" onClick={onClose}>×</button>
      </div>

      <div style={{
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #2a2a35',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <div className="tabs">
          <button
            className={`tab ${tab === 'conversation' ? 'active' : ''}`}
            onClick={() => setTab('conversation')}
          >
            Conversation
          </button>
          <button
            className={`tab ${tab === 'system' ? 'active' : ''}`}
            onClick={() => setTab('system')}
          >
            System ({(systemPromptText.length / 1000).toFixed(1)}K)
          </button>
          <button
            className={`tab ${tab === 'tools' ? 'active' : ''}`}
            onClick={() => setTab('tools')}
          >
            Tools ({toolUses.length})
          </button>
          <button
            className={`tab ${tab === 'raw' ? 'active' : ''}`}
            onClick={() => setTab('raw')}
          >
            Raw
          </button>
        </div>
      </div>

      <div className="detail-content">
        {tab === 'conversation' && (
          <>
            {/* System Prompt Summary */}
            {systemPromptText && (
              <div className="detail-section">
                <div
                  onClick={() => setSystemExpanded(!systemExpanded)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    border: '1px solid #2a2a35',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: `${agent.color}20`,
                      border: `1px solid ${agent.color}50`,
                      color: agent.color,
                    }}>
                      {agent.label}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      color: '#888',
                      fontSize: '0.75rem',
                    }}>
                      System Prompt ({(systemPromptText.length / 1000).toFixed(1)}K chars)
                    </span>
                  </div>
                  <span style={{
                    color: '#555',
                    transition: 'transform 0.2s ease',
                    transform: systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    ▼
                  </span>
                </div>
                {systemExpanded && (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: '0.5rem',
                    }}>
                      <div className="tabs" style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                        <button
                          className={`tab ${conversationSystemViewMode === 'preview' ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setConversationSystemViewMode('preview'); }}
                        >
                          Preview
                        </button>
                        <button
                          className={`tab ${conversationSystemViewMode === 'raw' ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setConversationSystemViewMode('raw'); }}
                        >
                          Raw
                        </button>
                      </div>
                    </div>
                    {conversationSystemViewMode === 'preview' ? (
                      <div
                        className="markdown-preview"
                        style={{
                          background: 'rgba(10, 10, 15, 0.8)',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          marginBottom: '0.5rem',
                          border: '1px solid #2a2a35',
                        }}
                      >
                        <Markdown>{systemPromptText}</Markdown>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: 'rgba(10, 10, 15, 0.8)',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          marginBottom: '0.5rem',
                          border: '1px solid #2a2a35',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.7rem',
                          color: '#888',
                        }}
                      >
                        {systemPromptText}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="detail-section">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}>
                <h3 style={{ margin: 0 }}>Messages ({request.messages.length})</h3>
                <div className="tabs" style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                  <button
                    className={`tab ${messagesViewMode === 'preview' ? 'active' : ''}`}
                    onClick={() => setMessagesViewMode('preview')}
                  >
                    Preview
                  </button>
                  <button
                    className={`tab ${messagesViewMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setMessagesViewMode('raw')}
                  >
                    Raw
                  </button>
                </div>
              </div>
              {request.messages.map((msg, i) => (
                <div key={i} className="message">
                  <div className="message-role" style={{
                    color: msg.role === 'user' ? '#39ff14' : '#ff00ff',
                  }}>
                    {msg.role}
                  </div>
                  {formatContent(msg.content, messagesViewMode === 'preview')}
                </div>
              ))}
            </div>

            {/* Response */}
            {response && (
              <div className="detail-section">
                <h3>Response</h3>
                <div className="message">
                  <div className="message-role" style={{ color: '#ff00ff' }}>assistant</div>
                  {formatContent(response.content, messagesViewMode === 'preview')}
                </div>
                <div style={{
                  marginTop: '0.5rem',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  color: '#555',
                }}>
                  Stop reason: <span style={{ color: '#00fff5' }}>{response.stop_reason}</span>
                  {' | '}
                  Duration: <span style={{ color: '#ffff00' }}>{response.duration_ms}ms</span>
                </div>
              </div>
            )}

            {/* Token Usage */}
            {response && (
              <div className="detail-section">
                <h3>Token Usage</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div style={{
                    padding: '0.75rem',
                    background: 'rgba(0, 255, 245, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 255, 245, 0.2)',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#00fff5',
                      textShadow: '0 0 10px rgba(0, 255, 245, 0.5)',
                    }}>
                      {response.usage.input_tokens.toLocaleString()}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.65rem',
                      color: '#555',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Input Tokens
                    </div>
                  </div>
                  <div style={{
                    padding: '0.75rem',
                    background: 'rgba(255, 0, 255, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 0, 255, 0.2)',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#ff00ff',
                      textShadow: '0 0 10px rgba(255, 0, 255, 0.5)',
                    }}>
                      {response.usage.output_tokens.toLocaleString()}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.65rem',
                      color: '#555',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Output Tokens
                    </div>
                  </div>
                  {response.usage.cache_read_input_tokens !== undefined && response.usage.cache_read_input_tokens > 0 && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 0, 0.05)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 0, 0.2)',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#ffff00',
                        textShadow: '0 0 10px rgba(255, 255, 0, 0.5)',
                      }}>
                        {response.usage.cache_read_input_tokens.toLocaleString()}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.65rem',
                        color: '#555',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Cache Read
                      </div>
                    </div>
                  )}
                  {response.usage.cache_creation_input_tokens !== undefined && response.usage.cache_creation_input_tokens > 0 && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(57, 255, 20, 0.05)',
                      borderRadius: '6px',
                      border: '1px solid rgba(57, 255, 20, 0.2)',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#39ff14',
                        textShadow: '0 0 10px rgba(57, 255, 20, 0.5)',
                      }}>
                        {response.usage.cache_creation_input_tokens.toLocaleString()}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.65rem',
                        color: '#555',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Cache Creation
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'system' && (
          <div className="detail-section">
            <div style={{
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  background: `${agent.color}20`,
                  border: `1px solid ${agent.color}50`,
                  color: agent.color,
                  fontWeight: 'bold',
                  boxShadow: agent.glow,
                }}>
                  {agent.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  color: '#555',
                  fontSize: '0.8rem',
                }}>
                  {systemPromptText.split(/\s+/).filter(Boolean).length.toLocaleString()} words / {systemPromptText.length.toLocaleString()} chars
                </span>
              </div>
              <div className="tabs">
                <button
                  className={`tab ${systemViewMode === 'preview' ? 'active' : ''}`}
                  onClick={() => setSystemViewMode('preview')}
                >
                  Preview
                </button>
                <button
                  className={`tab ${systemViewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setSystemViewMode('raw')}
                >
                  Raw
                </button>
              </div>
            </div>
            {systemPromptText ? (
              systemViewMode === 'preview' ? (
                <div
                  className="markdown-preview"
                  style={{
                    background: 'rgba(10, 10, 15, 0.8)',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    maxHeight: 'calc(100vh - 300px)',
                    overflowY: 'auto',
                    border: '1px solid #2a2a35',
                  }}
                >
                  <Markdown>{systemPromptText}</Markdown>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(10, 10, 15, 0.8)',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 'calc(100vh - 300px)',
                  overflowY: 'auto',
                  border: '1px solid #2a2a35',
                  color: '#888',
                }}>
                  {systemPromptText}
                </div>
              )
            ) : (
              <div className="empty">No system prompt in this request</div>
            )}
          </div>
        )}

        {tab === 'tools' && (
          <div className="detail-section">
            <h3>Tool Calls ({toolUses.length})</h3>
            {toolUses.length === 0 ? (
              <div className="empty">No tool calls in this request</div>
            ) : (
              toolUses.map((tool, i) => (
                <div key={i} className="tool-call" style={{ marginBottom: '1rem' }}>
                  <div className="tool-call-name">{tool.name}</div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.65rem',
                      color: '#555',
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Input:
                    </div>
                    <pre style={{
                      background: 'rgba(10, 10, 15, 0.8)',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.7rem',
                      overflow: 'auto',
                      maxHeight: '200px',
                      border: '1px solid #2a2a35',
                      color: '#888',
                    }}>
                      {JSON.stringify(tool.input, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            )}

            {request.tools && request.tools.length > 0 && (
              <>
                <h3 style={{ marginTop: '1rem' }}>Available Tools ({request.tools.length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {request.tools.map((tool, i) => (
                    <span
                      key={i}
                      style={{
                        fontFamily: 'var(--font-display)',
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(0, 255, 245, 0.1)',
                        border: '1px solid rgba(0, 255, 245, 0.2)',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: '#00fff5',
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      title={tool.description}
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'raw' && (
          <div className="detail-section">
            <h3>Raw Request</h3>
            <JsonViewer data={request} defaultExpandLevel={1} />

            {response && (
              <>
                <h3 style={{ marginTop: '1rem' }}>Raw Response</h3>
                <JsonViewer data={response} defaultExpandLevel={1} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
