'use client';
// Analytics charts (Recharts) in the Milk & Honey palette. Client-side only.
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from 'recharts';

const HONEY = '#C9A15C';
const INK = '#2B2622';
const BEIGE = '#E9DFCE';

const fmtMoney = (v: number) => `A$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`;
const fmtDay = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

export interface ChartDay { date: string; revenue: number; comparison?: number | null }

// Revenue over time: solid honey line + soft fill for the current period, dotted
// ink line for the comparison period (Fresha-style).
export function RevenueOverTime({ data }: { data: ChartDay[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="honeyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={HONEY} stopOpacity={0.28} />
              <stop offset="100%" stopColor={HONEY} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={BEIGE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={{ stroke: BEIGE }} minTickGap={28} />
          <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            formatter={((v: unknown, name: unknown) => [`A$${Number(v ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, name === 'comparison' ? 'Comparison period' : 'Revenue']) as any}
            labelFormatter={((d: unknown) => new Date(String(d) + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })) as any}
            contentStyle={{ borderRadius: 12, border: `1px solid ${BEIGE}`, background: '#fff', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="none" fill="url(#honeyFill)" />
          <Line type="monotone" dataKey="revenue" name="revenue" stroke={HONEY} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: HONEY }} />
          <Line type="monotone" dataKey="comparison" name="comparison" stroke={INK} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ChannelDatum { name: string; value: number }

// Sales by channel bar chart.
export function SalesByChannel({ data }: { data: ChannelDatum[] }) {
  const palette = [HONEY, INK, '#B4A284', '#DCC9A6'];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={BEIGE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8a8378' }} tickLine={false} axisLine={{ stroke: BEIGE }} />
          <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: '#8a8378' }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            formatter={((v: unknown) => [`A$${Number(v ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, 'Sales']) as any}
            contentStyle={{ borderRadius: 12, border: `1px solid ${BEIGE}`, background: '#fff', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Compact sparkline for dashboard cards.
export function Sparkline({ data }: { data: ChartDay[] }) {
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={HONEY} stopOpacity={0.3} />
              <stop offset="100%" stopColor={HONEY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="revenue" stroke="none" fill="url(#sparkFill)" />
          <Line type="monotone" dataKey="revenue" stroke={HONEY} strokeWidth={1.8} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
