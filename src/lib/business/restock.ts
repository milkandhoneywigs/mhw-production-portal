// -----------------------------------------------------------------------------
// Store restock orders.
//
// A restock is a bulk order (up to ~10 lines) that restocks a showroom with
// ready styles. It is modelled as a single order (order_type = 'stock') so the
// supplier prices the whole sheet once, exactly like any other order. The line
// items live in the restock_items table. Restock orders are identified by
// order_type === 'stock'; the destination showroom is the order's
// shipping_destination (mhw_showroom = Sydney, qld_showroom = Queensland).
// -----------------------------------------------------------------------------

export interface RestockItem {
  id?: string;
  order_id?: string;
  style_name: string;
  supplier_style_code: string | null;
  length: string | null;
  cap_size: string | null;
  quantity: number;
  position?: number;
}

export const SHOWROOMS = [
  { value: 'sydney', label: 'Sydney Showroom', shippingDestination: 'mhw_showroom' as const },
  { value: 'queensland', label: 'Queensland Showroom', shippingDestination: 'qld_showroom' as const },
];

// Human label for the destination, derived from the order's shipping_destination.
export function showroomFromShipping(shippingDestination: string | null | undefined): string {
  return shippingDestination === 'qld_showroom' ? 'Queensland Showroom' : 'Sydney Showroom';
}

export function totalUnits(items: RestockItem[]): number {
  return items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
}
