import { useState } from 'react';
import Markdown from 'react-markdown';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestResponsePair, TextContent, ToolUseContent, ToolResultContent, ContentBlock, SystemPrompt } from '../types';
import { JsonViewer } from './JsonViewer';
import { CopyRichTextButton } from './CopyRichTextButton';

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

function extractMessageText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

function getAgentLabel(system: SystemPrompt[] | undefined): string {
  const text = extractSystemPromptText(system);
  const length = text.length;

  if (!text) return 'Unknown';
  if (text.includes('isNewTopic') || text.includes('new conversation topic')) return 'Title Generator';
  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) return 'Explore Agent';
  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) return 'Plan Agent';
  if (text.includes('code review') || text.includes('Code review')) return 'Code Review Agent';
  if (text.includes('Bash agent') || text.includes('bash commands')) return 'Bash Agent';
  if (length < 15000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) return 'Sub-agent';
  if (text.includes('Claude Code, Anthropic\'s official CLI') && length > 20000) return 'Main Agent';
  if (length < 2000) return 'Short Prompt';
  return 'Agent';
}

function ViewToggle({ mode, onChange }: { mode: 'preview' | 'raw'; onChange: (m: 'preview' | 'raw') => void }) {
  return (
    <div className="flex rounded-md bg-secondary p-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); onChange('preview'); }}
        className={cn(
          'px-2.5 py-0.5 text-xs rounded cursor-pointer transition-colors',
          mode === 'preview' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Preview
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onChange('raw'); }}
        className={cn(
          'px-2.5 py-0.5 text-xs rounded cursor-pointer transition-colors',
          mode === 'raw' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Raw
      </button>
    </div>
  );
}

function TokenCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className={cn('text-xl font-semibold font-mono', color)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function formatContent(content: string | ContentBlock[], useMarkdown: boolean = true): React.ReactNode {
  if (typeof content === 'string') {
    return useMarkdown ? (
      <div className="markdown-preview text-sm">
        <Markdown>{content}</Markdown>
      </div>
    ) : (
      <div className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
        {content}
      </div>
    );
  }

  return content.map((block, i) => {
    if (block.type === 'text') {
      const textBlock = block as TextContent;
      return useMarkdown ? (
        <div key={i} className="markdown-preview text-sm">
          <Markdown>{textBlock.text}</Markdown>
        </div>
      ) : (
        <div key={i} className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
          {textBlock.text}
        </div>
      );
    }
    if (block.type === 'tool_use') {
      const toolBlock = block as ToolUseContent;
      return (
        <div key={i} className="my-2 p-3 rounded-md bg-secondary border-l-2 border-blue-500">
          <div className="text-sm font-mono text-foreground">Tool: {toolBlock.name}</div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
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
        <div
          key={i}
          className={cn(
            'my-2 p-3 rounded-md bg-secondary border-l-2',
            resultBlock.is_error ? 'border-destructive' : 'border-emerald-500'
          )}
        >
          <div className={cn(
            'text-xs font-medium uppercase tracking-wide',
            resultBlock.is_error ? 'text-destructive' : 'text-emerald-400'
          )}>
            Tool Result {resultBlock.is_error && '(Error)'}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
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
  const agentLabel = getAgentLabel(request.system);
  const toolUses = response?.content.filter((b): b is ToolUseContent => b.type === 'tool_use') || [];

  const detailTabs = [
    { id: 'conversation' as const, label: 'Conversation' },
    { id: 'system' as const, label: `System (${(systemPromptText.length / 1000).toFixed(1)}K)` },
    { id: 'tools' as const, label: `Tools (${toolUses.length})` },
    { id: 'raw' as const, label: 'Raw' },
  ];

  return (
    <div className="fixed right-0 top-0 w-1/2 h-screen bg-background border-l border-border z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">API Call Details</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground">
              {agentLabel}
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {new Date(request.timestamp).toLocaleString()} | {request.model}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-4">
        <nav className="flex gap-0">
          {detailTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                tab === t.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'conversation' && (
          <>
            {/* System prompt collapsible */}
            {systemPromptText && (
              <div className="mb-4">
                <button
                  onClick={() => setSystemExpanded(!systemExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-secondary/50 border border-border cursor-pointer hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{agentLabel}</span>
                    <span className="font-mono">System Prompt ({(systemPromptText.length / 1000).toFixed(1)}K chars)</span>
                  </div>
                  <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', systemExpanded && 'rotate-180')} />
                </button>
                {systemExpanded && (
                  <div className="mt-2">
                    <div className="flex justify-end items-center gap-1 mb-2">
                      <CopyRichTextButton markdownText={systemPromptText} />
                      <ViewToggle mode={conversationSystemViewMode} onChange={setConversationSystemViewMode} />
                    </div>
                    {conversationSystemViewMode === 'preview' ? (
                      <div className="markdown-preview bg-card p-3 rounded-md border border-border max-h-72 overflow-y-auto">
                        <Markdown>{systemPromptText}</Markdown>
                      </div>
                    ) : (
                      <div className="bg-card p-3 rounded-md border border-border max-h-72 overflow-y-auto font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {systemPromptText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Messages ({request.messages.length})</h3>
                <ViewToggle mode={messagesViewMode} onChange={setMessagesViewMode} />
              </div>
              {request.messages.map((msg, i) => (
                <div key={i} className="mb-2 p-3 rounded-md border border-border bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <div className={cn(
                      'text-xs font-medium uppercase tracking-wide',
                      msg.role === 'user' ? 'text-blue-400' : 'text-violet-400'
                    )}>
                      {msg.role}
                    </div>
                    {msg.role === 'user' && (
                      <CopyRichTextButton markdownText={extractMessageText(msg.content)} size={12} />
                    )}
                  </div>
                  {formatContent(msg.content, messagesViewMode === 'preview')}
                </div>
              ))}
            </div>

            {/* Response */}
            {response && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Response</h3>
                <div className="p-3 rounded-md border border-border bg-card">
                  <div className="text-xs font-medium uppercase tracking-wide mb-1 text-violet-400">assistant</div>
                  {formatContent(response.content, messagesViewMode === 'preview')}
                </div>
                <div className="mt-2 text-xs text-muted-foreground font-mono">
                  Stop reason: <span className="text-foreground">{response.stop_reason}</span>
                  {' | '}
                  Duration: <span className="text-foreground">{response.duration_ms}ms</span>
                </div>
              </div>
            )}

            {/* Token Usage */}
            {response && (
              <div>
                <h3 className="text-sm font-medium mb-2">Token Usage</h3>
                <div className="grid grid-cols-2 gap-2">
                  <TokenCard label="Input Tokens" value={response.usage.input_tokens.toLocaleString()} color="text-blue-400" />
                  <TokenCard label="Output Tokens" value={response.usage.output_tokens.toLocaleString()} color="text-violet-400" />
                  {response.usage.cache_read_input_tokens !== undefined && response.usage.cache_read_input_tokens > 0 && (
                    <TokenCard label="Cache Read" value={response.usage.cache_read_input_tokens.toLocaleString()} color="text-amber-400" />
                  )}
                  {response.usage.cache_creation_input_tokens !== undefined && response.usage.cache_creation_input_tokens > 0 && (
                    <TokenCard label="Cache Creation" value={response.usage.cache_creation_input_tokens.toLocaleString()} color="text-emerald-400" />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'system' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary">{agentLabel}</span>
                <span className="font-mono text-xs">
                  {systemPromptText.split(/\s+/).filter(Boolean).length.toLocaleString()} words / {systemPromptText.length.toLocaleString()} chars
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CopyRichTextButton markdownText={systemPromptText} />
                <ViewToggle mode={systemViewMode} onChange={setSystemViewMode} />
              </div>
            </div>
            {systemPromptText ? (
              systemViewMode === 'preview' ? (
                <div className="markdown-preview bg-card p-6 rounded-lg border border-border max-h-[calc(100vh-300px)] overflow-y-auto">
                  <Markdown>{systemPromptText}</Markdown>
                </div>
              ) : (
                <div className="bg-card p-4 rounded-lg border border-border font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-[calc(100vh-300px)] overflow-y-auto">
                  {systemPromptText}
                </div>
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No system prompt in this request</div>
            )}
          </div>
        )}

        {tab === 'tools' && (
          <div>
            <h3 className="text-sm font-medium mb-3">Tool Calls ({toolUses.length})</h3>
            {toolUses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No tool calls in this request</div>
            ) : (
              toolUses.map((tool, i) => (
                <div key={i} className="mb-3 p-3 rounded-md border border-border bg-card border-l-2 border-l-blue-500">
                  <div className="text-sm font-mono font-medium">{tool.name}</div>
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Input:</div>
                    <pre className="bg-secondary p-2 rounded text-xs font-mono overflow-auto max-h-48 text-muted-foreground">
                      {JSON.stringify(tool.input, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            )}

            {request.tools && request.tools.length > 0 && (
              <>
                <h3 className="text-sm font-medium mt-4 mb-2">Available Tools ({request.tools.length})</h3>
                <div className="flex flex-wrap gap-1">
                  {request.tools.map((tool, i) => (
                    <span
                      key={i}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground"
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
          <div>
            <h3 className="text-sm font-medium mb-3">Raw Request</h3>
            <JsonViewer data={request} defaultExpandLevel={1} />

            {response && (
              <>
                <h3 className="text-sm font-medium mt-4 mb-3">Raw Response</h3>
                <JsonViewer data={response} defaultExpandLevel={1} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
