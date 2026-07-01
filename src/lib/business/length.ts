// -----------------------------------------------------------------------------
// Length conversion rules.
//
// For standard made-to-order human hair wigs, the supplier order length is
// 2 inches SHORTER than the customer's ordered length:
//   14" customer -> 12" supplier
//   18" customer -> 16" supplier
//   22" customer -> 20" supplier
//   26" customer -> 24" supplier
//
// SAFETY: if the ordered length is a bob, a custom measurement, unclear, or
// cannot be parsed, we DO NOT guess. We flag the order as needs_review and
// require a staff member to confirm the supplier length manually.
// -----------------------------------------------------------------------------

export const SUPPLIER_LENGTH_OFFSET_INCHES = 2;

export interface ParsedLength {
  inches: number | null;
  isBob: boolean;
  needsReview: boolean;
  reason?: string;
  raw: string;
}

const BOB_HINTS = ['bob', 'pixie', 'crop'];
const UNCLEAR_HINTS = ['custom', 'measurement', 'measure', 'tbc', 'unknown', '?'];

// Extract a clean inch value from free-text like "18", "18 inch", "18\"", "18in".
export function parseLength(input: string | null | undefined): ParsedLength {
  const raw = (input ?? '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return { inches: null, isBob: false, needsReview: true, reason: 'No length provided', raw };
  }
  if (BOB_HINTS.some((h) => lower.includes(h))) {
    return { inches: null, isBob: true, needsReview: true, reason: 'Bob / short style — confirm length manually', raw };
  }
  if (UNCLEAR_HINTS.some((h) => lower.includes(h))) {
    return { inches: null, isBob: false, needsReview: true, reason: 'Custom / unclear measurement — confirm manually', raw };
  }

  // Pull the first integer we see. Reject ranges and multiple numbers as unclear.
  const numbers = lower.match(/\d+/g) ?? [];
  if (numbers.length !== 1) {
    return {
      inches: null,
      isBob: false,
      needsReview: true,
      reason: numbers.length === 0 ? 'No numeric length found' : 'Ambiguous / multiple lengths — confirm manually',
      raw,
    };
  }
  const inches = parseInt(numbers[0], 10);
  // Sanity bounds for a human-hair wig length.
  if (inches < 6 || inches > 40) {
    return { inches: null, isBob: false, needsReview: true, reason: `Length ${inches}" is out of the expected range — confirm manually`, raw };
  }
  return { inches, isBob: false, needsReview: false, raw };
}

export interface SupplierLengthResult {
  supplierLength: string | null; // e.g. "16" — null when review is required
  parsed: ParsedLength;
  needsReview: boolean;
  reason?: string;
}

// Apply the -2" rule. Returns needsReview=true (and null length) when we cannot
// safely convert, so the caller can set the order to needs_review.
export function calculateSupplierLength(customerOrderedLength: string | null | undefined): SupplierLengthResult {
  const parsed = parseLength(customerOrderedLength);
  if (parsed.needsReview || parsed.inches === null) {
    return { supplierLength: null, parsed, needsReview: true, reason: parsed.reason };
  }
  const supplierInches = parsed.inches - SUPPLIER_LENGTH_OFFSET_INCHES;
  return { supplierLength: String(supplierInches), parsed, needsReview: false };
}
