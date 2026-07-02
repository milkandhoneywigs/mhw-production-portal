import type { SupabaseClient } from '@supabase/supabase-js';

// Revenue time-series + period-over-period comparisons for the analytics
// dashboards. Backed by business_metrics rows (daily_online_* series, sourced
// from GA4 by the daily revenue-sync routine). All real data — no invention.

export interface DayPoint {
  date: string;        // YYYY-MM-DD
  revenue: number;
  transactions: number;
  sessions: number;
}

export interface PeriodStats {
  revenue: number;
  transactions: number;
  sessions: number;
  aov: number | null;          // revenue / transactions
  conversion: number | null;   // transactions / sessions (%)
}

export interface RevenueAnalytics {
  days: number;
  current: DayPoint[];        // last N days (oldest -> newest)
  previous: DayPoint[];       // the N days before that
  currentStats: PeriodStats;
  previousStats: PeriodStats;
  // % change vs comparison period (null when the comparison base is 0/absent)
  change: { revenue: number | null; transactions: number | null; aov: number | null; conversion: number | null; sessions: number | null };
}

function stats(points: DayPoint[]): PeriodStats {
  const revenue = points.reduce((s, p) => s + p.revenue, 0);
  const transactions = points.reduce((s, p) => s + p.transactions, 0);
  const sessions = points.reduce((s, p) => s + p.sessions, 0);
  return {
    revenue, transactions, sessions,
    aov: transactions > 0 ? revenue / transactions : null,
    conversion: sessions > 0 ? (transactions / sessions) * 100 : null,
  };
}

const pct = (cur: number | null, prev: number | null): number | null =>
  cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;

export async function getRevenueAnalytics(sb: SupabaseClient, days = 30): Promise<RevenueAnalytics> {
  const since = new Date(Date.now() - days * 2 * 86400000).toISOString();
  const { data } = await sb
    .from('business_metrics')
    .select('metric_name,metric_value,recorded_at')
    .in('metric_name', ['daily_online_revenue', 'daily_online_transactions', 'daily_online_sessions'])
    .gte('recorded_at', since)
    .order('recorded_at');

  // Fold the three series into one point per day.
  const byDate = new Map<string, DayPoint>();
  for (const r of (data ?? []) as { metric_name: string; metric_value: number; recorded_at: string }[]) {
    const date = r.recorded_at.slice(0, 10);
    const p = byDate.get(date) ?? { date, revenue: 0, transactions: 0, sessions: 0 };
    if (r.metric_name === 'daily_online_revenue') p.revenue = Number(r.metric_value);
    else if (r.metric_name === 'daily_online_transactions') p.transactions = Number(r.metric_value);
    else p.sessions = Number(r.metric_value);
    byDate.set(date, p);
  }
  const all = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const current = all.slice(-days);
  const previous = all.slice(-days * 2, -days);
  const currentStats = stats(current);
  const previousStats = stats(previous);

  return {
    days, current, previous, currentStats, previousStats,
    change: {
      revenue: pct(currentStats.revenue, previousStats.revenue),
      transactions: pct(currentStats.transactions, previousStats.transactions),
      aov: pct(currentStats.aov, previousStats.aov),
      conversion: pct(currentStats.conversion, previousStats.conversion),
      sessions: pct(currentStats.sessions, previousStats.sessions),
    },
  };
}
