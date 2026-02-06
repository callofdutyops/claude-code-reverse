import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RequestResponsePair, ToolUseContent, ToolResultContent } from '../types';

interface ToolAnalysisProps {
  pairs: RequestResponsePair[];
}

interface ToolStat {
  name: string;
  count: number;
  errors: number;
  successRate: number;
}

export const ToolAnalysis: React.FC<ToolAnalysisProps> = ({ pairs }) => {
  const toolStats = useMemo(() => {
    const stats = new Map<string, { count: number; errors: number }>();

    // Collect tool uses from responses
    const toolUses = new Map<string, string>(); // tool_use_id -> name

    for (const pair of pairs) {
      if (!pair.response) continue;

      for (const block of pair.response.content) {
        if (block.type === 'tool_use') {
          const toolUse = block as ToolUseContent;
          toolUses.set(toolUse.id, toolUse.name);

          const existing = stats.get(toolUse.name) || { count: 0, errors: 0 };
          existing.count++;
          stats.set(toolUse.name, existing);
        }
      }

      // Check for tool results in messages to count errors
      for (const message of pair.request.messages) {
        if (message.role === 'user' && Array.isArray(message.content)) {
          for (const block of message.content) {
            if (block.type === 'tool_result') {
              const toolResult = block as ToolResultContent;
              const toolName = toolUses.get(toolResult.tool_use_id);
              if (toolName && toolResult.is_error) {
                const existing = stats.get(toolName);
                if (existing) {
                  existing.errors++;
                }
              }
            }
          }
        }
      }
    }

    // Convert to array and sort by count
    const result: ToolStat[] = [];
    for (const [name, data] of stats) {
      result.push({
        name,
        count: data.count,
        errors: data.errors,
        successRate: data.count > 0 ? ((data.count - data.errors) / data.count) * 100 : 100,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }, [pairs]);

  if (toolStats.length === 0) {
    return <div className="empty">No tool calls recorded</div>;
  }

  const chartData = toolStats.slice(0, 10).map((stat) => ({
    name: stat.name.length > 20 ? stat.name.slice(0, 17) + '...' : stat.name,
    fullName: stat.name,
    success: stat.count - stat.errors,
    errors: stat.errors,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <defs>
            <linearGradient id="successGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#39ff14" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#39ff14" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#ff6b35" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
          <XAxis
            type="number"
            stroke="#555"
            fontSize={11}
            fontFamily="var(--font-display)"
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#555"
            fontSize={10}
            width={120}
            fontFamily="var(--font-display)"
            tickFormatter={(v) => v}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(10, 10, 15, 0.95)',
              border: '1px solid #00fff5',
              borderRadius: '6px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              boxShadow: '0 0 15px rgba(0, 255, 245, 0.3)',
            }}
            formatter={(value: number, name: string) => [
              value,
              name === 'success' ? 'Success' : 'Errors',
            ]}
            labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
            labelStyle={{ color: '#00fff5' }}
          />
          <Bar
            dataKey="success"
            fill="url(#successGradient)"
            stackId="a"
            style={{ filter: 'drop-shadow(0 0 4px rgba(57, 255, 20, 0.5))' }}
          />
          <Bar
            dataKey="errors"
            fill="url(#errorGradient)"
            stackId="a"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255, 107, 53, 0.5))' }}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="tool-list" style={{ marginTop: '1rem' }}>
        {toolStats.map((stat) => (
          <div key={stat.name} className="tool-item">
            <span className="tool-name">{stat.name}</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: 'rgba(0, 255, 245, 0.1)',
                border: '1px solid rgba(0, 255, 245, 0.3)',
                color: '#00fff5',
                fontWeight: 'bold',
              }}>
                {stat.count}
              </span>
              {stat.errors > 0 && (
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 107, 53, 0.1)',
                  border: '1px solid rgba(255, 107, 53, 0.3)',
                  color: '#ff6b35',
                  fontWeight: 'bold',
                }}>
                  {stat.errors} err
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
