import { useState, useCallback } from 'react';

interface JsonViewerProps {
  data: unknown;
  defaultExpandLevel?: number;
  rootName?: string;
}

interface JsonNodeProps {
  name: string | number | null;
  value: unknown;
  depth: number;
  defaultExpandLevel: number;
  isLast: boolean;
}

// Cyberpunk neon syntax highlighting colors
const colors = {
  key: '#ff00ff',        // Magenta for keys
  string: '#39ff14',     // Matrix green for strings
  number: '#00fff5',     // Cyan for numbers
  boolean: '#ffff00',    // Yellow for booleans
  null: '#555',          // Muted for null
  bracket: '#888',       // Gray for brackets
  comma: '#444',         // Darker gray for commas
};

function getValuePreview(value: unknown): string {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
  }
  return String(value);
}

const JsonNode: React.FC<JsonNodeProps> = ({ name, value, depth, defaultExpandLevel, isLast }) => {
  const [expanded, setExpanded] = useState(depth < defaultExpandLevel);

  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const toggle = useCallback(() => {
    if (isExpandable) {
      setExpanded((e) => !e);
    }
  }, [isExpandable]);

  const indent = depth * 16;
  const comma = isLast ? '' : ',';

  // Render primitive values
  if (!isExpandable) {
    let valueElement: React.ReactNode;
    let color: string;

    if (typeof value === 'string') {
      color = colors.string;
      // Truncate long strings
      const displayValue = value.length > 100 ? value.slice(0, 97) + '...' : value;
      valueElement = `"${displayValue}"`;
    } else if (typeof value === 'number') {
      color = colors.number;
      valueElement = String(value);
    } else if (typeof value === 'boolean') {
      color = colors.boolean;
      valueElement = String(value);
    } else if (value === null) {
      color = colors.null;
      valueElement = 'null';
    } else {
      color = colors.null;
      valueElement = String(value);
    }

    return (
      <div style={{
        paddingLeft: indent,
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        lineHeight: 1.6,
      }}>
        {name !== null && (
          <>
            <span style={{ color: colors.key }}>"{name}"</span>
            <span style={{ color: colors.comma }}>: </span>
          </>
        )}
        <span style={{ color, textShadow: `0 0 5px ${color}40` }}>{valueElement}</span>
        <span style={{ color: colors.comma }}>{comma}</span>
      </div>
    );
  }

  // Render object or array
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as [number, unknown])
    : Object.entries(value as Record<string, unknown>);

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', lineHeight: 1.6 }}>
      <div
        style={{
          paddingLeft: indent,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.2s ease',
        }}
        onClick={toggle}
      >
        <span style={{
          color: '#555',
          marginRight: '4px',
          display: 'inline-block',
          width: '12px',
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▶
        </span>
        {name !== null && (
          <>
            <span style={{ color: colors.key }}>"{name}"</span>
            <span style={{ color: colors.comma }}>: </span>
          </>
        )}
        <span style={{ color: colors.bracket }}>{openBracket}</span>
        {!expanded && (
          <>
            <span style={{ color: '#444', fontStyle: 'italic' }}> {getValuePreview(value)} </span>
            <span style={{ color: colors.bracket }}>{closeBracket}</span>
            <span style={{ color: colors.comma }}>{comma}</span>
          </>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, val], index) => (
            <JsonNode
              key={key}
              name={isArray ? null : key}
              value={val}
              depth={depth + 1}
              defaultExpandLevel={defaultExpandLevel}
              isLast={index === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: indent }}>
            <span style={{ color: colors.bracket }}>{closeBracket}</span>
            <span style={{ color: colors.comma }}>{comma}</span>
          </div>
        </>
      )}
    </div>
  );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, defaultExpandLevel = 1, rootName }) => {
  const [expandAll, setExpandAll] = useState(false);
  const [key, setKey] = useState(0);

  const handleExpandAll = () => {
    setExpandAll(true);
    setKey((k) => k + 1);
  };

  const handleCollapseAll = () => {
    setExpandAll(false);
    setKey((k) => k + 1);
  };

  return (
    <div>
      <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleExpandAll}
          style={{
            fontFamily: 'var(--font-display)',
            padding: '0.25rem 0.5rem',
            fontSize: '0.65rem',
            background: 'rgba(0, 255, 245, 0.1)',
            border: '1px solid rgba(0, 255, 245, 0.3)',
            borderRadius: '4px',
            color: '#00fff5',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 245, 0.2)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 255, 245, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 245, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Expand All
        </button>
        <button
          onClick={handleCollapseAll}
          style={{
            fontFamily: 'var(--font-display)',
            padding: '0.25rem 0.5rem',
            fontSize: '0.65rem',
            background: 'rgba(255, 0, 255, 0.1)',
            border: '1px solid rgba(255, 0, 255, 0.3)',
            borderRadius: '4px',
            color: '#ff00ff',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 255, 0.2)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 255, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Collapse All
        </button>
      </div>
      <div
        style={{
          background: 'rgba(10, 10, 15, 0.8)',
          padding: '0.75rem',
          borderRadius: '6px',
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #2a2a35',
        }}
      >
        <JsonNode
          key={key}
          name={rootName ?? null}
          value={data}
          depth={0}
          defaultExpandLevel={expandAll ? 100 : defaultExpandLevel}
          isLast={true}
        />
      </div>
    </div>
  );
};
