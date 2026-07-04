// Pretty renderer for agent reports. Parses the employee-report structure
// (RESULTS / DONE / NEXT / BLOCKED / NEEDS YOU / …) + markdown-ish content
// (tables, lists, bold, rules) into clean, scannable cards. Server component.

import React from 'react';

type Tone = { bar: string; text: string; chip: string };
const TONES: Record<string, Tone> = {
  good: { bar: 'bg-emerald-400', text: 'text-emerald-800', chip: 'bg-emerald-50' },
  warn: { bar: 'bg-amber-400', text: 'text-amber-800', chip: 'bg-amber-50' },
  danger: { bar: 'bg-red-400', text: 'text-red-700', chip: 'bg-red-50' },
  info: { bar: 'bg-blue-400', text: 'text-blue-800', chip: 'bg-blue-50' },
  honey: { bar: 'bg-honey', text: 'text-honey', chip: 'bg-honey/10' },
  neutral: { bar: 'bg-beige', text: 'text-ink/70', chip: 'bg-sand/60' },
};

function toneFor(title: string): keyof typeof TONES {
  const t = title.toUpperCase();
  if (/RESULT|DONE|EXECUTED|VERIF|COMPLETE|SUCCESS/.test(t)) return 'good';
  if (/BLOCK|FAIL|ERROR|RISK/.test(t)) return 'danger';
  if (/NEEDS YOU|OWNED|CORRECTION|APPROVAL|GAPS|TOKEN NOTE|WARNING/.test(t)) return 'warn';
  if (/NEXT|IN PROGRESS|PLAN/.test(t)) return 'honey';
  if (/NOTE|YOUR NOTES|WHY|CONTEXT/.test(t)) return 'info';
  return 'neutral';
}

// Inline: **bold**, `code`, strip stray markdown emphasis.
function inline(text: string, key: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = text; let i = 0;
  while (rest.length) {
    const m = rest.match(/\*\*(.+?)\*\*|`([^`]+)`/);
    if (!m || m.index === undefined) { parts.push(rest); break; }
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    if (m[1] !== undefined) parts.push(<b key={`${key}-${i++}`}>{m[1]}</b>);
    else parts.push(<code key={`${key}-${i++}`} className="bg-sand/70 rounded px-1 text-[0.92em]">{m[2]}</code>);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}

const isSectionHeader = (line: string): string | null => {
  const l = line.trim();
  let m = l.match(/^#{1,4}\s+(.+?)\s*$/);              // ## Heading
  if (m) return m[1].replace(/\*\*/g, '');
  m = l.match(/^\*\*([^*]{2,60})\*\*:?\s*$/);           // **HEADING**
  if (m) return m[1];
  m = l.match(/^([A-Z][A-Z0-9 &''’\/\-—:()]{2,48}):\s*$/); // RESULTS:
  if (m) return m[1];
  m = l.match(/^([A-Z][A-Z &''’\-—]{3,40})$/);          // BARE CAPS LINE
  if (m && l === l.toUpperCase() && l.split(' ').length <= 6) return m[1];
  return null;
};

// Header line with content after the colon, e.g. "RESULTS: everything shipped"
const splitInlineSection = (line: string): [string, string] | null => {
  const m = line.trim().match(/^([A-Z][A-Z &''’\/\-—]{2,24}):\s+(.+)$/);
  if (m && /^(RESULTS|DONE|NEXT|BLOCKED|NEEDS YOU|OWNED|WHY|IN PROGRESS|GAPS OWNED|VERIFICATION \d?|WHY IT MATTERS)/.test(m[1])) return [m[1], m[2]];
  return null;
};

export function AgentReport({ text }: { text: string }) {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let section: { title: string; children: React.ReactNode[] } | null = null;
  let list: React.ReactNode[] = [];
  let table: string[][] | null = null;
  let key = 0;

  const flushList = () => {
    if (list.length) {
      (section?.children ?? blocks).push(<ul key={`ul${key++}`} className="space-y-1 my-1.5">{list}</ul>);
      list = [];
    }
  };
  const flushTable = () => {
    if (table && table.length) {
      const [head, ...rows] = table;
      (section?.children ?? blocks).push(
        <div key={`tb${key++}`} className="overflow-x-auto my-2">
          <table className="w-full text-xs border border-beige rounded-lg overflow-hidden">
            <thead className="bg-sand/60"><tr>{head.map((h, i) => <th key={i} className="px-2.5 py-1.5 text-left font-semibold">{inline(h, key + i)}</th>)}</tr></thead>
            <tbody className="divide-y divide-beige/70">
              {rows.map((r, ri) => <tr key={ri} className="bg-white">{r.map((c, ci) => <td key={ci} className="px-2.5 py-1.5 align-top">{inline(c, key + ri * 10 + ci)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
    }
    table = null;
  };
  const flushSection = () => {
    flushList(); flushTable();
    if (section) {
      const tone = TONES[toneFor(section.title)];
      blocks.push(
        <div key={`s${key++}`} className="flex gap-3 my-2">
          <div className={`w-1 rounded-full shrink-0 ${tone.bar}`} />
          <div className="min-w-0 flex-1">
            <div className={`text-[11px] font-bold uppercase tracking-wider ${tone.text} ${tone.chip} inline-block rounded px-1.5 py-0.5 mb-1`}>{section.title}</div>
            <div className="text-sm text-ink/90 space-y-1">{section.children}</div>
          </div>
        </div>,
      );
      section = null;
    }
  };
  const push = (node: React.ReactNode) => (section ? section.children.push(node) : blocks.push(node));

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (t.startsWith('|')) {                                  // table rows
      flushList();
      const cells = t.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      (table ??= []).push(cells);
      continue;
    }
    flushTable();

    if (!t) { flushList(); continue; }
    if (/^-{3,}$/.test(t) || /^={3,}$/.test(t)) { flushList(); continue; }  // hr → spacing

    const header = isSectionHeader(line);
    if (header) { flushSection(); section = { title: header.replace(/:$/, ''), children: [] }; continue; }

    const inlineSec = splitInlineSection(line);
    if (inlineSec) { flushSection(); section = { title: inlineSec[0], children: [] }; section.children.push(<p key={`p${key++}`}>{inline(inlineSec[1], key)}</p>); continue; }

    const li = t.match(/^(?:[-•*]|\d+[.)]|\(\d+\))\s+(.+)$/);
    if (li) { list.push(<li key={`li${key++}`} className="flex gap-2"><span className="text-honey mt-0.5 shrink-0">•</span><span>{inline(li[1], key)}</span></li>); continue; }

    flushList();
    if (/^[—-]\s*[A-Z][\w &]+ Agent$/i.test(t) || /^— /.test(t)) {           // sign-off
      push(<p key={`sig${key++}`} className="text-xs text-muted italic text-right mt-2">{t}</p>);
      continue;
    }
    push(<p key={`p${key++}`} className="text-sm text-ink/90">{inline(t, key)}</p>);
  }
  flushSection(); flushList(); flushTable();

  return <div className="space-y-1">{blocks}</div>;
}
