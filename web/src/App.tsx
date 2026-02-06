import { useEffect, useState, useCallback, useMemo } from 'react';
import { Timeline } from './components/Timeline';
import { TokenChart } from './components/TokenChart';
import { ToolAnalysis } from './components/ToolAnalysis';
import { SystemPromptView } from './components/SystemPromptView';
import { DetailPanel } from './components/DetailPanel';
import type { RequestResponsePair } from './types';

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

    // Set up WebSocket for real-time updates
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
      <div className="app">
        <div className="loading">Loading captured data...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>Claude Code Reverse</h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            background: 'rgba(57, 255, 20, 0.1)',
            border: '1px solid rgba(57, 255, 20, 0.3)',
            borderRadius: '20px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#39ff14',
              boxShadow: '0 0 10px #39ff14, 0 0 20px rgba(57, 255, 20, 0.5)',
              animation: 'livePulse 2s infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.7rem',
              color: '#39ff14',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Live
            </span>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat">
            <div className="stat-value">{stats.requests}</div>
            <div className="stat-label">Requests</div>
          </div>
          <div className="stat">
            <div className="stat-value">{(stats.totalInput / 1000).toFixed(1)}K</div>
            <div className="stat-label">Input Tokens</div>
          </div>
          <div className="stat">
            <div className="stat-value">{(stats.totalOutput / 1000).toFixed(1)}K</div>
            <div className="stat-label">Output Tokens</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.totalTools}</div>
            <div className="stat-label">Tool Calls</div>
          </div>
        </div>
        <button
          onClick={handleClear}
          style={{
            fontFamily: 'var(--font-display)',
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.5)',
            color: '#ff6b35',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.2)';
            e.currentTarget.style.borderColor = '#ff6b35';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 107, 53, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Clear Data
        </button>
      </header>

      <div style={{
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #2a2a35',
        background: 'linear-gradient(180deg, rgba(18, 18, 26, 0.9) 0%, rgba(13, 13, 20, 0.9) 100%)',
      }}>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
          <button
            className={`tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System Prompt
          </button>
          <button
            className={`tab ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => setActiveTab('tokens')}
          >
            Token Usage
          </button>
          <button
            className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Tool Analysis
          </button>
        </div>
      </div>

      <main style={{ padding: '1rem' }}>
        {activeTab === 'timeline' && (
          <div className="panel panel-full">
            <div className="panel-header">
              <span>API Call Timeline</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                color: '#00fff5',
                padding: '0.25rem 0.5rem',
                background: 'rgba(0, 255, 245, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(0, 255, 245, 0.2)',
              }}>
                {pairs.length} calls
              </span>
            </div>
            <div className="panel-content" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <Timeline
                pairs={pairs}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="panel panel-full">
            <div className="panel-header">
              <span>System Prompt Analysis</span>
            </div>
            <div className="panel-content" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <SystemPromptView pairs={pairs} />
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="panel panel-full">
            <div className="panel-header">
              <span>Token Usage Statistics</span>
            </div>
            <div className="panel-content" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <TokenChart pairs={pairs} />
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="panel panel-full">
            <div className="panel-header">
              <span>Tool Usage Analysis</span>
            </div>
            <div className="panel-content" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <ToolAnalysis pairs={pairs} />
            </div>
          </div>
        )}
      </main>

      {selectedId && (
        <DetailPanel
          pair={selectedPair}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

export default App;
