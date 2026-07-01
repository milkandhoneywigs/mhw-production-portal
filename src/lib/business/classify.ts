// -----------------------------------------------------------------------------
// Order classification (deterministic v1).
//
// classifyOrder decides the order_type, the initial production status, and the
// default shipping destination. This is a placeholder-friendly seam: an AI
// classifier can later refine order_type, but the deterministic rules below run
// first and always produce a safe default.
// -----------------------------------------------------------------------------
import type { OrderType, OrderStatus } from '../constants';
import type { ShippingDestination } from '../types';
import { calculateSupplierLength } from './length';

export interface ClassifyInput {
  requestedType: 'ready_made' | 'made_to_order';
  customerOrderedLength?: string | null;
}

export interface ClassifyResult {
  orderType: OrderType;
  status: OrderStatus;
  shippingDestination: ShippingDestination;
  needsReview: boolean;
  reviewReason?: string;
}

export function classifyOrder(input: ClassifyInput): ClassifyResult {
  if (input.requestedType === 'ready_made') {
    // Ready made ships direct to the customer; no length conversion needed.
    return {
      orderType: 'ready_made',
      status: 'new_ready_made_order',
      shippingDestination: 'customer_direct',
      needsReview: false,
    };
  }

  // Made to order: verify we can safely convert the length. If not, flag review.
  const len = calculateSupplierLength(input.customerOrderedLength);
  if (len.needsReview) {
    return {
      orderType: 'needs_review',
      status: 'manager_review_required',
      shippingDestination: 'mhw_showroom',
      needsReview: true,
      reviewReason: len.reason ?? 'Length requires manual confirmation',
    };
  }

  return {
    orderType: 'made_to_order',
    status: 'new_made_to_order',
    shippingDestination: 'mhw_showroom',
    needsReview: false,
  };
}
