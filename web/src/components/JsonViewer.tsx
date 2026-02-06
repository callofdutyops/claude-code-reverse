import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

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

function getValuePreview(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
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
    if (isExpandable) setExpanded((e) => !e);
  }, [isExpandable]);

  const indent = depth * 16;
  const comma = isLast ? '' : ',';

  if (!isExpandable) {
    let valueElement: React.ReactNode;
    let colorClass: string;

    if (typeof value === 'string') {
      colorClass = 'text-emerald-400';
      const displayValue = value.length > 100 ? value.slice(0, 97) + '...' : value;
      valueElement = `"${displayValue}"`;
    } else if (typeof value === 'number') {
      colorClass = 'text-blue-400';
      valueElement = String(value);
    } else if (typeof value === 'boolean') {
      colorClass = 'text-amber-400';
      valueElement = String(value);
    } else if (value === null) {
      colorClass = 'text-zinc-500';
      valueElement = 'null';
    } else {
      colorClass = 'text-zinc-500';
      valueElement = String(value);
    }

    return (
      <div style={{ paddingLeft: indent }} className="font-mono text-xs leading-relaxed">
        {name !== null && (
          <>
            <span className="text-violet-400">"{name}"</span>
            <span className="text-zinc-600">: </span>
          </>
        )}
        <span className={colorClass}>{valueElement}</span>
        <span className="text-zinc-600">{comma}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as [number, unknown])
    : Object.entries(value as Record<string, unknown>);

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className="font-mono text-xs leading-relaxed">
      <div
        style={{ paddingLeft: indent }}
        className="cursor-pointer select-none hover:bg-accent/30 rounded"
        onClick={toggle}
      >
        <span className={cn(
          'inline-block w-3 mr-1 text-zinc-500 transition-transform',
          expanded && 'rotate-90'
        )}>
          ▶
        </span>
        {name !== null && (
          <>
            <span className="text-violet-400">"{name}"</span>
            <span className="text-zinc-600">: </span>
          </>
        )}
        <span className="text-zinc-500">{openBracket}</span>
        {!expanded && (
          <>
            <span className="text-zinc-600 italic"> {getValuePreview(value)} </span>
            <span className="text-zinc-500">{closeBracket}</span>
            <span className="text-zinc-600">{comma}</span>
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
            <span className="text-zinc-500">{closeBracket}</span>
            <span className="text-zinc-600">{comma}</span>
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
      <div className="flex gap-2 mb-2">
        <button
          onClick={handleExpandAll}
          className="px-2.5 py-1 text-xs rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Expand All
        </button>
        <button
          onClick={handleCollapseAll}
          className="px-2.5 py-1 text-xs rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Collapse All
        </button>
      </div>
      <div className="bg-card p-3 rounded-lg border border-border max-h-96 overflow-y-auto">
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
