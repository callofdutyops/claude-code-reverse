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
    const toolUses = new Map<string, string>();

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

      for (const message of pair.request.messages) {
        if (message.role === 'user' && Array.isArray(message.content)) {
          for (const block of message.content) {
            if (block.type === 'tool_result') {
              const toolResult = block as ToolResultContent;
              const toolName = toolUses.get(toolResult.tool_use_id);
              if (toolName && toolResult.is_error) {
                const existing = stats.get(toolName);
                if (existing) existing.errors++;
              }
            }
          }
        }
      }
    }

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
    return <div className="text-center py-8 text-muted-foreground text-sm">No tool calls recorded</div>;
  }

  const chartData = toolStats.slice(0, 10).map((stat) => ({
    name: stat.name.length > 20 ? stat.name.slice(0, 17) + '...' : stat.name,
    fullName: stat.name,
    success: stat.count - stat.errors,
    errors: stat.errors,
  }));

  const tooltipStyle = {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    fontSize: '0.75rem',
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis type="number" stroke="#71717a" fontSize={11} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#71717a"
            fontSize={10}
            width={120}
            tickFormatter={(v) => v}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              value,
              name === 'success' ? 'Success' : 'Errors',
            ]}
            labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Bar dataKey="success" fill="#10b981" stackId="a" />
          <Bar dataKey="errors" fill="#ef4444" stackId="a" />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-1 mt-4">
        {toolStats.map((stat) => (
          <div
            key={stat.name}
            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <span className="text-sm font-mono">{stat.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-secondary text-foreground">
                {stat.count}
              </span>
              {stat.errors > 0 && (
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">
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
