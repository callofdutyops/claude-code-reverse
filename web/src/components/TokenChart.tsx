import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { RequestResponsePair } from '../types';

interface TokenChartProps {
  pairs: RequestResponsePair[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

export const TokenChart: React.FC<TokenChartProps> = ({ pairs }) => {
  const totals = pairs.reduce(
    (acc, pair) => {
      if (pair.response) {
        acc.input += pair.response.usage.input_tokens;
        acc.output += pair.response.usage.output_tokens;
        acc.cacheRead += pair.response.usage.cache_read_input_tokens || 0;
        acc.cacheCreation += pair.response.usage.cache_creation_input_tokens || 0;
      }
      return acc;
    },
    { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  );

  const pieData = [
    { name: 'Input', value: totals.input - totals.cacheRead },
    { name: 'Cache Read', value: totals.cacheRead },
    { name: 'Output', value: totals.output },
    { name: 'Cache Creation', value: totals.cacheCreation },
  ].filter((d) => d.value > 0);

  const barData = pairs
    .slice(-10)
    .filter((p) => p.response)
    .map((pair, index) => ({
      name: `#${index + 1}`,
      input: pair.response!.usage.input_tokens,
      output: pair.response!.usage.output_tokens,
      cacheRead: pair.response!.usage.cache_read_input_tokens || 0,
    }));

  if (pairs.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No token data available</div>;
  }

  const tooltipStyle = {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    fontSize: '0.75rem',
  };

  const statCards = [
    { label: 'Total Input', value: formatTokens(totals.input), color: 'text-blue-400' },
    { label: 'Total Output', value: formatTokens(totals.output), color: 'text-emerald-400' },
    { label: 'Cache Read', value: formatTokens(totals.cacheRead), color: 'text-amber-400' },
    { label: 'Cache Write', value: formatTokens(totals.cacheCreation), color: 'text-violet-400' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Token Distribution</h4>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${formatTokens(value)}`}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              stroke="#09090b"
              strokeWidth={2}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatTokens(value)}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#a1a1aa' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {barData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Recent Requests</h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} tickFormatter={formatTokens} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => formatTokens(value)}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
              <Bar dataKey="input" fill="#3b82f6" name="Input" stackId="a" />
              <Bar dataKey="cacheRead" fill="#f59e0b" name="Cache Read" stackId="a" />
              <Bar dataKey="output" fill="#10b981" name="Output" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mt-6">
        {statCards.map((card) => (
          <div key={card.label} className="text-center p-3 rounded-lg border border-border bg-card">
            <div className={`text-xl font-semibold font-mono ${card.color}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
