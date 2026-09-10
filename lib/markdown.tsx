import type { ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>,
      );
    } else if (token.startsWith("*")) {
      parts.push(<em key={`${keyPrefix}-i-${i}`}>{token.slice(1, -1)}</em>);
    } else {
      parts.push(
        <code key={`${keyPrefix}-c-${i}`} className="rounded bg-black/5 px-1">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownLite({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-[var(--muted)]">Empty note.</p>;
  }
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5">
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList(`list-${index}`);
    if (!line.trim()) {
      blocks.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : heading[1].length === 2 ? "h4" : "h5";
      blocks.push(
        <Tag key={`h-${index}`} className="mt-3 font-serif font-semibold">
          {inline(heading[2], `h-${index}`)}
        </Tag>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${index}`} className="my-1 leading-relaxed">
        {inline(line, `p-${index}`)}
      </p>,
    );
  });
  flushList("list-end");
  return <div className="text-[15px] text-[var(--ink)]">{blocks}</div>;
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
