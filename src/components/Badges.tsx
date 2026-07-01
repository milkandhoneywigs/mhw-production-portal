import {
  STATUS_LABELS, STATUS_TONE, TONE_CLASSES, ORDER_TYPE_LABELS,
  STAGE_LABELS, STAGE_TONE, stageOf,
  type OrderStatus, type OrderType, type RiskLevel, type BadgeTone,
} from '@/lib/constants';

// Primary badge: the simplified 5-stage label (NEW ORDER / IN PROGRESS / …).
export function StageBadge({ status }: { status: OrderStatus }) {
  const stage = stageOf(status);
  return <span className={`chip ${TONE_CLASSES[STAGE_TONE[stage]]}`}>{STAGE_LABELS[stage]}</span>;
}

// Detailed status badge (kept for the order detail sub-line).
export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={`chip ${TONE_CLASSES[tone]}`}>{STATUS_LABELS[status] ?? status}</span>
  );
}

export function OrderTypeBadge({ type }: { type: OrderType }) {
  const cls =
    type === 'ready_made' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : type === 'made_to_order' ? 'bg-violet-50 text-violet-800 ring-violet-200'
    : type === 'needs_review' ? 'bg-red-50 text-red-700 ring-red-200'
    : 'bg-sand text-ink ring-beige';
  return <span className={`chip ${cls}`}>{ORDER_TYPE_LABELS[type]}</span>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  if (level === 'low') return null;
  const cls = level === 'high'
    ? 'bg-red-600 text-white ring-red-700'
    : 'bg-amber-100 text-amber-900 ring-amber-300';
  return <span className={`chip ${cls}`}>AT RISK</span>;
}

// Loud operational flags.
export function Flag({ children, tone = 'blocked' }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`chip ${TONE_CLASSES[tone]}`}>{children}</span>;
}
