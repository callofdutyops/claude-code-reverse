import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';
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

const LABEL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Title Generator': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  'Explore Agent': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  'Plan Agent': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  'Code Review Agent': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Bash Agent': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'Sub-agent': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  'Main Agent': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'Short Prompt': { bg: 'bg-zinc-500/10', text: 'text-zinc-500', border: 'border-zinc-500/20' },
  Agent: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
};

function getPromptLabel(prompt: ParsedPrompt): string {
  const text = prompt.fullText;

  if (text.includes('isNewTopic') || text.includes('new conversation topic') || text.includes('extract a 2-3 word title')) return 'Title Generator';
  if (text.includes('You are an exploration agent') || text.includes('exploring codebases')) return 'Explore Agent';
  if (text.includes('You are a planning agent') || text.includes('planning the implementation')) return 'Plan Agent';
  if (text.includes('code review') || text.includes('Code review')) return 'Code Review Agent';
  if (text.includes('Bash agent') || text.includes('bash commands')) return 'Bash Agent';
  if (prompt.charCount < 10000 && !text.includes('You are Claude Code, Anthropic\'s official CLI')) {
    if (text.includes('agent') || text.includes('task')) return 'Sub-agent';
  }
  if (text.includes('Claude Code, Anthropic\'s official CLI') && prompt.charCount > 20000) return 'Main Agent';
  if (prompt.charCount < 1000) return 'Short Prompt';
  return 'Agent';
}

function getPromptPreview(prompt: ParsedPrompt): string {
  const lines = prompt.fullText.split('\n').filter((l) => l.trim().length > 10);
  if (lines.length > 0) {
    const first = lines[0].trim();
    return first.length > 60 ? first.slice(0, 57) + '...' : first;
  }
  return '';
}

function ViewToggle({ mode, onChange }: { mode: 'preview' | 'raw'; onChange: (m: 'preview' | 'raw') => void }) {
  return (
    <div className="flex rounded-md bg-secondary p-0.5">
      <button
        onClick={() => onChange('preview')}
        className={cn(
          'px-3 py-1 text-xs rounded cursor-pointer transition-colors',
          mode === 'preview' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Preview
      </button>
      <button
        onClick={() => onChange('raw')}
        className={cn(
          'px-3 py-1 text-xs rounded cursor-pointer transition-colors',
          mode === 'raw' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Raw
      </button>
    </div>
  );
}

export const SystemPromptView: React.FC<SystemPromptViewProps> = ({ pairs }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

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
      <div className="text-center py-8 text-muted-foreground text-sm">
        No system prompts captured yet. Start Claude Code with the proxy to see data.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-border bg-secondary/50 text-xs font-medium text-muted-foreground">
          System Prompts ({uniquePrompts.length})
        </div>
        <div className="overflow-auto flex-1">
          {uniquePrompts.map((prompt, index) => {
            const label = getPromptLabel(prompt);
            const style = LABEL_STYLES[label] || LABEL_STYLES.Agent;
            return (
              <div
                key={prompt.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'px-3 py-2.5 cursor-pointer border-l-2 border-b border-b-border transition-colors',
                  selectedIndex === index
                    ? 'bg-accent border-l-foreground'
                    : 'border-l-transparent hover:bg-accent/50'
                )}
              >
                <div className={cn('text-xs font-medium mb-0.5', style.text)}>
                  {label}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{prompt.model}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(prompt.charCount / 1000).toFixed(1)}K chars
                </div>
                <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                  {getPromptPreview(prompt)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {selectedPrompt && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {(() => {
                  const label = getPromptLabel(selectedPrompt);
                  const style = LABEL_STYLES[label] || LABEL_STYLES.Agent;
                  return (
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', style.bg, style.text, style.border)}>
                      {label}
                    </span>
                  );
                })()}
                <span className="font-mono text-xs">
                  {selectedPrompt.wordCount.toLocaleString()} words / {selectedPrompt.charCount.toLocaleString()} chars
                </span>
                {selectedPrompt.hasCacheControl && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Cached
                  </span>
                )}
              </div>
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            </div>

            {viewMode === 'preview' ? (
              <div className="markdown-preview bg-card p-6 rounded-lg border border-border max-h-[calc(100vh-300px)] overflow-y-auto">
                <Markdown>{selectedPrompt.fullText}</Markdown>
              </div>
            ) : (
              <div className="bg-card p-4 rounded-lg border border-border font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-[calc(100vh-300px)] overflow-y-auto">
                {selectedPrompt.fullText}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
