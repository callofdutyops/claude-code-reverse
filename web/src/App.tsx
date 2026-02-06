import { useEffect, useState, useCallback, useMemo } from 'react';
import { Activity, Zap, MessageSquare, Wrench, Trash2 } from 'lucide-react';
import { Timeline } from './components/Timeline';
import { TokenChart } from './components/TokenChart';
import { ToolAnalysis } from './components/ToolAnalysis';
import { SystemPromptView } from './components/SystemPromptView';
import { DetailPanel } from './components/DetailPanel';
import type { RequestResponsePair } from './types';

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-secondary/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-lg font-semibold font-mono">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function App() {
  const [pairs, setPairs] = useState<RequestResponsePair[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'system' | 'tokens' | 'tools'>('timeline');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/captures');
      const data = await res.json();
      setPairs(data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const ws = new WebSocket(`ws://${window.location.hostname}:3456`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'request') {
        setPairs((prev) => [
          ...prev,
          { request: message.data, response: null },
        ]);
      } else if (message.type === 'response') {
        setPairs((prev) =>
          prev.map((pair) =>
            pair.request.id === message.data.request_id
              ? { ...pair, response: message.data }
              : pair
          )
        );
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [fetchData]);

  const selectedPair = useMemo(() => {
    return pairs.find((p) => p.request.id === selectedId) || null;
  }, [pairs, selectedId]);

  const stats = useMemo(() => {
    let totalInput = 0;
    let totalOutput = 0;
    let totalTools = 0;

    for (const pair of pairs) {
      if (pair.response) {
        totalInput += pair.response.usage.input_tokens;
        totalOutput += pair.response.usage.output_tokens;
        totalTools += pair.response.content.filter((b) => b.type === 'tool_use').length;
      }
    }

    return { requests: pairs.length, totalInput, totalOutput, totalTools };
  }, [pairs]);

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all captured data?')) {
      await fetch('/api/captures', { method: 'DELETE' });
      setPairs([]);
      setSelectedId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-sm">Loading captured data...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'system' as const, label: 'System Prompt' },
    { id: 'tokens' as const, label: 'Token Usage' },
    { id: 'tools' as const, label: 'Tool Analysis' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Claude Code Reverse</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-500">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatItem
            icon={<Activity size={16} />}
            value={String(stats.requests)}
            label="Requests"
          />
          <StatItem
            icon={<Zap size={16} />}
            value={`${(stats.totalInput / 1000).toFixed(1)}K`}
            label="Input Tokens"
          />
          <StatItem
            icon={<MessageSquare size={16} />}
            value={`${(stats.totalOutput / 1000).toFixed(1)}K`}
            label="Output Tokens"
          />
          <StatItem
            icon={<Wrench size={16} />}
            value={String(stats.totalTools)}
            label="Tool Calls"
          />
        </div>

        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="p-6">
        {activeTab === 'timeline' && (
          <div className="rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">API Call Timeline</span>
              <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded">
                {pairs.length} calls
              </span>
            </div>
            <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
              <Timeline pairs={pairs} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">System Prompt Analysis</span>
            </div>
            <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
              <SystemPromptView pairs={pairs} />
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Token Usage Statistics</span>
            </div>
            <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
              <TokenChart pairs={pairs} />
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="rounded-lg border border-border">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Tool Usage Analysis</span>
            </div>
            <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
              <ToolAnalysis pairs={pairs} />
            </div>
          </div>
        )}
      </main>

      {selectedId && (
        <DetailPanel pair={selectedPair} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

export default App;
