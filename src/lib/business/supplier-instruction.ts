// -----------------------------------------------------------------------------
// Supplier instruction generator (deterministic v1).
//
// Produces a clean supplier-facing summary. IMPORTANT: this output is safe to
// share with suppliers — it must NEVER include internal_notes, risk level, or
// financials. Only the fields below are included.
//
// Shipping wording is fixed by policy:
//   READY MADE   -> ship direct to customer via DHL, NOT to the showroom
//   MADE TO ORDER-> produce and ship to the Milk & Honey showroom, NOT to customer
// -----------------------------------------------------------------------------
import type { Order, Customer } from '../types';
import { SUPPLIER_INSTRUCTION_SHIPPING, MHW_SHOWROOM_ADDRESS, ORDER_TYPE_LABELS } from '../constants';

function fmtCustomerAddress(c: Customer | null | undefined): string {
  if (!c) return '[customer address not on file — add before dispatch]';
  const parts = [
    c.full_name,
    c.shipping_address_line1,
    c.shipping_address_line2,
    [c.suburb, c.state, c.postcode].filter(Boolean).join(' '),
    c.country,
  ].filter(Boolean);
  return parts.join('\n');
}

export function generateSupplierInstruction(order: Order, customer?: Customer | null): string {
  const isReadyMade = order.order_type === 'ready_made';
  const shipping = isReadyMade
    ? SUPPLIER_INSTRUCTION_SHIPPING.ready_made
    : SUPPLIER_INSTRUCTION_SHIPPING.made_to_order;

  const shipTo = isReadyMade
    ? `Customer shipping address:\n${fmtCustomerAddress(customer)}`
    : `Ship to:\n${MHW_SHOWROOM_ADDRESS}`;

  const line = (label: string, value: string | null | undefined) =>
    `${label}: ${value && String(value).trim() ? value : '-'}`;

  return [
    `MILK & HONEY WIGS — SUPPLIER INSTRUCTION`,
    `Order number: ${order.order_number}`,
    `Order type: ${ORDER_TYPE_LABELS[order.order_type]}`,
    ``,
    line('Supplier style code', order.supplier_style_code),
    line('Internal style name', order.internal_style_name),
    line('Customer ordered length', order.customer_ordered_length),
    line('Supplier production length', order.supplier_order_length),
    line('Cap style', order.cap_style),
    line('Cap size', order.cap_size),
    line('Density', order.density),
    line('Hair type', order.hair_type),
    line('Colour notes', order.colour_notes),
    line('Production notes', order.production_notes),
    ``,
    `SHIPPING INSTRUCTION:`,
    shipping,
    ``,
    shipTo,
  ].join('\n');
}
