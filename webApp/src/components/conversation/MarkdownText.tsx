/**
 * P2.5: Безопасный рендеринг Markdown-подобного форматирования.
 *
 * Поддерживает: **bold**, *italic*, `inline code`, ~~strikethrough~~, @mentions.
 * Парсинг через React-элементы (без innerHTML). XSS-безопасно.
 */

import { memo, type ReactNode } from 'react';

interface MarkdownTextProps {
  text: string;
  mentionNames?: string[];
}

const RULES: Array<{
  pattern: RegExp;
  render: (match: RegExpMatchArray, key: string) => ReactNode;
}> = [
  {
    pattern: /`([^`]+)`/,
    render: (m, key) => (
      <code
        key={key}
        className="px-1 py-0.5 rounded text-[13px]"
        style={{ background: 'rgba(255,255,255,0.1)', fontFamily: 'monospace' }}
      >
        {m[1]}
      </code>
    ),
  },
  {
    pattern: /\*\*(.+?)\*\*/,
    render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
  },
  {
    pattern: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/,
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
  {
    pattern: /~~(.+?)~~/,
    render: (m, key) => <s key={key}>{parseInline(m[1], key)}</s>,
  },
];

function findMatch(pattern: RegExp, text: string): RegExpExecArray | null {
  return pattern[Symbol.match](text) as RegExpExecArray | null;
}

function parseInline(text: string, parentKey: string): ReactNode[] {
  const result: ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    let earliest: { rule: (typeof RULES)[0]; match: RegExpExecArray; pos: number } | null = null;

    for (const rule of RULES) {
      const m = findMatch(rule.pattern, remaining);
      if (m && m.index !== undefined && (!earliest || m.index < earliest.pos)) {
        earliest = { rule, match: m, pos: m.index };
      }
    }

    if (!earliest) {
      result.push(remaining);
      break;
    }

    if (earliest.pos > 0) {
      result.push(remaining.slice(0, earliest.pos));
    }

    const key = `${parentKey}-${idx++}`;
    result.push(earliest.rule.render(earliest.match, key));
    remaining = remaining.slice(earliest.pos + earliest.match[0].length);
  }

  return result;
}

function highlightMentions(nodes: ReactNode[], names: string[]): ReactNode[] {
  if (names.length === 0) return nodes;

  return nodes.flatMap((node, i) => {
    if (typeof node !== 'string') return [node];
    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
    const parts = node.split(pattern);
    if (parts.length === 1) return [node];

    return parts.map((part, j) =>
      part.startsWith('@') && names.some(n => part === `@${n}`)
        ? <span key={`m-${i}-${j}`} className="font-semibold" style={{ color: '#007AFF' }}>{part}</span>
        : part
    );
  });
}

export const MarkdownText = memo(function MarkdownText({ text, mentionNames = [] }: MarkdownTextProps) {
  if (!text) return null;
  let nodes = parseInline(text, 'md');
  if (mentionNames.length > 0) {
    nodes = highlightMentions(nodes, mentionNames);
  }
  return <>{nodes}</>;
});
