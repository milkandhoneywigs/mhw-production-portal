'use client';
// WAAVA prospecting charts (Recharts) in the Milk & Honey palette.
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
} from 'recharts';

const HONEY = '#C9A15C';
const INK = '#2B2622';
const BEIGE = '#E9DFCE';
const PALETTE = [HONEY, INK, '#B4A284', '#DCC9A6', '#9C8B6E', '#EBD9B4', '#7A6E58'];

export interface Datum { name: string; value: number }

const tip = {
  contentStyle: { borderRadius: 12, border: `1px solid ${BEIGE}`, background: '#fff', fontSize: 12 },
  cursor: { fill: 'rgba(201,161,92,0.08)' },
};

// Venues per state (vertical bars).
export function ByState({ data }: { data: Datum[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={BEIGE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8a8378' }} tickLine={false} axisLine={{ stroke: BEIGE }} />
          <YAxis tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={false} width={44} />
          <Tooltip {...tip} formatter={((v: unknown) => [Number(v ?? 0).toLocaleString(), 'Venues']) as any} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={54}>
            {data.map((_, i) => <Cell key={i} fill={HONEY} />)}
            <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#8a8378' }} formatter={((v: number) => v.toLocaleString()) as any} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Venues per category (horizontal bars — long labels).
export function ByCategory({ data }: { data: Datum[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(180, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={BEIGE} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: INK }} tickLine={false} axisLine={{ stroke: BEIGE }} width={96} />
          <Tooltip {...tip} formatter={((v: unknown) => [Number(v ?? 0).toLocaleString(), 'Venues']) as any} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#8a8378' }} formatter={((v: number) => v.toLocaleString()) as any} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Outreach funnel: prospect → contacted → registered → signed.
export function Funnel({ data }: { data: Datum[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={BEIGE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8a8378' }} tickLine={false} axisLine={{ stroke: BEIGE }} />
          <YAxis tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={false} width={44} />
          <Tooltip {...tip} formatter={((v: unknown) => [Number(v ?? 0).toLocaleString(), 'Venues']) as any} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#8a8378' }} formatter={((v: number) => v.toLocaleString()) as any} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
