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

// Neon cyberpunk colors
const COLORS = ['#00fff5', '#ff00ff', '#39ff14', '#ffff00'];

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export const TokenChart: React.FC<TokenChartProps> = ({ pairs }) => {
  // Calculate totals
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

  // Per-request data for bar chart (last 10)
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
    return <div className="empty">No token data available</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{
          fontFamily: 'var(--font-display)',
          marginBottom: '0.75rem',
          color: '#ff00ff',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Token Distribution
        </h4>
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
              stroke="#0a0a0f"
              strokeWidth={2}
            >
              {pieData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  style={{
                    filter: `drop-shadow(0 0 8px ${COLORS[index % COLORS.length]}80)`,
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatTokens(value)}
              contentStyle={{
                background: 'rgba(10, 10, 15, 0.95)',
                border: '1px solid #00fff5',
                borderRadius: '6px',
                fontFamily: 'var(--font-display)',
                fontSize: '0.75rem',
                boxShadow: '0 0 15px rgba(0, 255, 245, 0.3)',
              }}
              labelStyle={{ color: '#00fff5' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {barData.length > 0 && (
        <div>
          <h4 style={{
            fontFamily: 'var(--font-display)',
            marginBottom: '0.75rem',
            color: '#00fff5',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Recent Requests
          </h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData}>
              <defs>
                <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00fff5" stopOpacity={1} />
                  <stop offset="100%" stopColor="#00fff5" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="cacheGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff00ff" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ff00ff" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#39ff14" stopOpacity={1} />
                  <stop offset="100%" stopColor="#39ff14" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis
                dataKey="name"
                stroke="#555"
                fontSize={11}
                fontFamily="var(--font-display)"
              />
              <YAxis
                stroke="#555"
                fontSize={11}
                tickFormatter={formatTokens}
                fontFamily="var(--font-display)"
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
                formatter={(value: number) => formatTokens(value)}
                labelStyle={{ color: '#00fff5' }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                }}
              />
              <Bar dataKey="input" fill="url(#inputGradient)" name="Input" stackId="a" />
              <Bar dataKey="cacheRead" fill="url(#cacheGradient)" name="Cache Read" stackId="a" />
              <Bar dataKey="output" fill="url(#outputGradient)" name="Output" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{
        marginTop: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.75rem',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(0, 255, 245, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(0, 255, 245, 0.2)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#00fff5',
            textShadow: '0 0 10px rgba(0, 255, 245, 0.5)',
          }}>
            {formatTokens(totals.input)}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.6rem',
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '0.25rem',
          }}>
            Total Input
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(57, 255, 20, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(57, 255, 20, 0.2)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#39ff14',
            textShadow: '0 0 10px rgba(57, 255, 20, 0.5)',
          }}>
            {formatTokens(totals.output)}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.6rem',
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '0.25rem',
          }}>
            Total Output
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(255, 0, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 0, 255, 0.2)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#ff00ff',
            textShadow: '0 0 10px rgba(255, 0, 255, 0.5)',
          }}>
            {formatTokens(totals.cacheRead)}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.6rem',
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '0.25rem',
          }}>
            Cache Read
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(255, 255, 0, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 0, 0.2)',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#ffff00',
            textShadow: '0 0 10px rgba(255, 255, 0, 0.5)',
          }}>
            {formatTokens(totals.cacheCreation)}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.6rem',
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '0.25rem',
          }}>
            Cache Write
          </div>
        </div>
      </div>
    </div>
  );
};
