// -----------------------------------------------------------------------------
// Estimated completion (ETA) rules.
//
// Production lead time depends on the channel:
//   ONLINE  (Shopify / website) -> 40 business days
//   IN-STORE (walk-in / custom)  -> 20 business days
//
// Business days = Mon–Fri (weekends skipped). ETA is stored as a plain date.
// -----------------------------------------------------------------------------

export const ONLINE_PRODUCTION_DAYS = 40;
export const INSTORE_PRODUCTION_DAYS = 20;

export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function productionDaysFor(channel: 'online' | 'instore'): number {
  return channel === 'online' ? ONLINE_PRODUCTION_DAYS : INSTORE_PRODUCTION_DAYS;
}

// Returns the ETA as a YYYY-MM-DD string for the given channel.
export function etaFor(channel: 'online' | 'instore', from: Date = new Date()): string {
  return addBusinessDays(from, productionDaysFor(channel)).toISOString().slice(0, 10);
}
