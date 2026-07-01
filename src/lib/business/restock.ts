// -----------------------------------------------------------------------------
// Store restock orders.
//
// A restock is a bulk order (up to ~10 lines) that restocks a showroom with
// ready styles. It is modelled as a single order (order_type = 'stock') so the
// supplier prices the whole sheet once, exactly like any other order. The line
// items are stored as JSON in production_notes (supplier-visible) — no schema
// change required. Restock orders are identified by order_type === 'stock'.
// -----------------------------------------------------------------------------

export interface RestockItem {
  style_name: string;
  supplier_style_code: string | null;
  length: string | null;
  cap_size: string | null;
  quantity: number;
}

export interface RestockData {
  restock: true;
  destination: 'sydney' | 'queensland';
  items: RestockItem[];
}

export const SHOWROOMS = [
  { value: 'sydney', label: 'Sydney Showroom', shippingDestination: 'mhw_showroom' as const },
  { value: 'queensland', label: 'Queensland Showroom', shippingDestination: 'qld_showroom' as const },
];

export function showroomLabel(destination: RestockData['destination']): string {
  return SHOWROOMS.find((s) => s.value === destination)?.label ?? 'Showroom';
}

export function serializeRestock(data: RestockData): string {
  return JSON.stringify(data);
}

// Returns the parsed restock sheet, or null if this isn't a restock order.
export function parseRestock(productionNotes: string | null | undefined): RestockData | null {
  if (!productionNotes) return null;
  try {
    const p = JSON.parse(productionNotes);
    return p && p.restock === true && Array.isArray(p.items) ? (p as RestockData) : null;
  } catch {
    return null;
  }
}

export function totalUnits(items: RestockItem[]): number {
  return items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
}
