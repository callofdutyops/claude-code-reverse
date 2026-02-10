import { useState, useRef, useEffect, createElement } from 'react';
import { Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';
import { cn } from '@/lib/utils';

interface CopyRichTextButtonProps {
  markdownText: string;
  size?: number;
  className?: string;
}

export function CopyRichTextButton({ markdownText, size = 14, className }: CopyRichTextButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const html = renderToStaticMarkup(createElement(Markdown, null, markdownText));
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([markdownText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
      ]);
    } catch {
      await navigator.clipboard.writeText(markdownText);
    }
    setCopied(true);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1 rounded hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground',
        className,
      )}
      title="Copy as rich text"
    >
      {copied ? <Check size={size} className="text-emerald-500" /> : <Copy size={size} />}
    </button>
  );
}
