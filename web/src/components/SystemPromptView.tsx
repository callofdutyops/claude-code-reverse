import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import type { RequestResponsePair, SystemPrompt } from '../types';

interface SystemPromptViewProps {
  pairs: RequestResponsePair[];
}

interface ParsedPrompt {
  id: string;
  model: string;
  timestamp: string;
  fullText: string;
  wordCount: number;
  charCount: number;
  hasCacheControl: boolean;
}

function extractSystemPromptText(system: SystemPrompt[] | undefined): string {
  if (!system) return '';
  return system
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

function getPromptLabel(prompt: ParsedPrompt): { label: string; color: string } {
  const text = prompt.fullText;

  if (text.includes('isNewTopic') || text.includes('new conversation topic') || text.includes('extract a 2-3 word title')) {
    return { label: 'Title Generator', color: '#bf00ff' };
  }
  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) {
    return { label: 'Explore Agent', color: '#00d4ff' };
  }
  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) {
    return { label: 'Plan Agent', color: '#ffff00' };
  }
  if (text.includes('code review') || text.includes('Code review')) {
    return { label: 'Code Review Agent', color: '#39ff14' };
  }
  if (text.includes('Bash agent') || text.includes('bash commands')) {
    return { label: 'Bash Agent', color: '#ff6b35' };
  }
  if (prompt.charCount < 10000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) {
    if (text.includes('agent') || text.includes('task')) {
      return { label: 'Sub-agent', color: '#ff00ff' };
    }
  }
  if (text.includes('Claude Code, Anthropic\'s official CLI') && prompt.charCount > 20000) {
    return { label: 'Main Agent', color: '#00fff5' };
  }
  if (prompt.charCount < 1000) {
    return { label: 'Short Prompt', color: '#666' };
  }
  return { label: 'Agent', color: '#00d4ff' };
}

function getPromptPreview(prompt: ParsedPrompt): string {
  const lines = prompt.fullText.split('\n').filter(l => l.trim().length > 10);
  if (lines.length > 0) {
    const first = lines[0].trim();
    return first.length > 60 ? first.slice(0, 57) + '...' : first;
  }
  return '';
}

// Cyberpunk Markdown styles
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

export const SystemPromptView: React.FC<SystemPromptViewProps> = ({ pairs }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

  // Extract all unique system prompts
  const uniquePrompts = useMemo(() => {
    const seen = new Map<string, ParsedPrompt>();

    for (const pair of pairs) {
      if (!pair.request.system || pair.request.system.length === 0) continue;

      const fullText = extractSystemPromptText(pair.request.system);
      if (!fullText) continue;

      const key = `${fullText.length}:${fullText.slice(0, 200)}:${fullText.slice(-200)}`;
      if (seen.has(key)) continue;

      const hasCacheControl = pair.request.system.some((block) => block.cache_control?.type === 'ephemeral');

      seen.set(key, {
        id: pair.request.id,
        model: pair.request.model,
        timestamp: pair.request.timestamp,
        fullText,
        wordCount: fullText.split(/\s+/).filter(Boolean).length,
        charCount: fullText.length,
        hasCacheControl,
      });
    }

    return Array.from(seen.values()).sort((a, b) => b.charCount - a.charCount);
  }, [pairs]);

  const selectedPrompt = uniquePrompts[selectedIndex] || null;

  if (uniquePrompts.length === 0) {
    return (
      <div className="empty">
        No system prompts captured yet. Start Claude Code with the proxy to see data.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      <style>{markdownStyles}</style>

      {/* Sidebar - List of prompts */}
      <div style={{
        width: '250px',
        flexShrink: 0,
        background: 'rgba(10, 10, 15, 0.8)',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #2a2a35',
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(0, 0, 0, 0.3)',
          fontFamily: 'var(--font-display)',
          fontWeight: 'bold',
          borderBottom: '1px solid #2a2a35',
          color: '#00fff5',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          System Prompts ({uniquePrompts.length})
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {uniquePrompts.map((prompt, index) => {
            const { label, color } = getPromptLabel(prompt);
            return (
              <div
                key={prompt.id}
                onClick={() => {
                  setSelectedIndex(index);
                }}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  background: selectedIndex === index ? 'rgba(0, 255, 245, 0.1)' : 'transparent',
                  borderLeft: selectedIndex === index ? '3px solid #00fff5' : '3px solid transparent',
                  borderBottom: '1px solid #2a2a35',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Right glow indicator for selected */}
                {selectedIndex === index && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'linear-gradient(180deg, #00fff5, #ff00ff)',
                    boxShadow: '0 0 10px rgba(0, 255, 245, 0.5)',
                  }} />
                )}
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'bold',
                  marginBottom: '0.25rem',
                  fontSize: '0.75rem',
                  color: color,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.65rem',
                  color: '#555',
                  marginBottom: '0.25rem',
                }}>
                  {prompt.model}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.6rem',
                  color: '#444',
                  marginBottom: '0.25rem',
                }}>
                  {(prompt.charCount / 1000).toFixed(1)}K chars
                </div>
                <div style={{
                  fontSize: '0.6rem',
                  color: '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {getPromptPreview(prompt)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content - Selected prompt */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedPrompt && (
          <>
            <div style={{
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.8rem',
                color: '#555',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  background: `${getPromptLabel(selectedPrompt).color}20`,
                  border: `1px solid ${getPromptLabel(selectedPrompt).color}50`,
                  color: getPromptLabel(selectedPrompt).color,
                  fontWeight: 'bold',
                }}>
                  {getPromptLabel(selectedPrompt).label}
                </span>
                <span>
                  {selectedPrompt.wordCount.toLocaleString()} words / {selectedPrompt.charCount.toLocaleString()} chars
                </span>
                {selectedPrompt.hasCacheControl && (
                  <span style={{
                    color: '#39ff14',
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: 'rgba(57, 255, 20, 0.1)',
                    border: '1px solid rgba(57, 255, 20, 0.3)',
                    borderRadius: '4px',
                  }}>
                    Cached
                  </span>
                )}
              </div>
              <div className="tabs">
                <button
                  className={`tab ${viewMode === 'preview' ? 'active' : ''}`}
                  onClick={() => setViewMode('preview')}
                >
                  Preview
                </button>
                <button
                  className={`tab ${viewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setViewMode('raw')}
                >
                  Raw
                </button>
              </div>
            </div>

            {viewMode === 'preview' ? (
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
                <Markdown>{selectedPrompt.fullText}</Markdown>
              </div>
            ) : (
              <div
                className="system-prompt"
                style={{
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
                }}
              >
                {selectedPrompt.fullText}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
