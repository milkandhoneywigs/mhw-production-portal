// -----------------------------------------------------------------------------
// Customer update draft generator (deterministic v1).
//
// Produces DRAFT customer messages for each lifecycle milestone. v1 does NOT
// send anything — drafts are created with status 'draft' and a human approves.
// An AI generator can later replace the templates below; the seam is the same
// function signature so nothing downstream changes.
//
// Brand voice: warm, premium, AU English, no em dashes, no hype.
// -----------------------------------------------------------------------------
import type { CustomerUpdateType } from '../types';
import type { Order, Customer } from '../types';

export interface CustomerUpdateDraft {
  update_type: CustomerUpdateType;
  subject: string;
  message: string;
}

export function generateCustomerUpdateDraft(
  type: CustomerUpdateType,
  order: Order,
  customer?: Customer | null,
): CustomerUpdateDraft {
  const name = customer?.full_name?.split(' ')[0] || 'there';
  const product = order.customer_facing_product_name || 'your wig';
  const orderNo = order.order_number;
  const signoff = '\n\nMuch Love,\nEm';

  const templates: Record<CustomerUpdateType, { subject: string; body: string }> = {
    order_received: {
      subject: `We have received your order ${orderNo}`,
      body: `Hi ${name},\n\nThank you so much for your order. We have received it and our team is getting everything started for you. We will keep you updated at each step along the way.`,
    },
    production_started: {
      subject: `Your order ${orderNo} is now in production`,
      body: `Hi ${name},\n\nLovely news, ${product} has now moved into production and is being handcrafted with care. We will check in with an update as it progresses.`,
    },
    production_checkin: {
      subject: `A quick update on your order ${orderNo}`,
      body: `Hi ${name},\n\nJust a warm check in to let you know your order is progressing nicely in production. Thank you for your patience while we make sure it is perfect.`,
    },
    production_complete: {
      subject: `Your order ${orderNo} is complete`,
      body: `Hi ${name},\n\nWonderful news, ${product} is now complete. The next step is a careful quality check with our team, and we will let you know as soon as it is ready to be sent to you.`,
    },
    arrived_showroom: {
      subject: `Your order ${orderNo} has arrived with us`,
      body: `Hi ${name},\n\n${product} has safely arrived at our showroom. Our team will now complete a final quality check before dispatching it to you.`,
    },
    dispatched: {
      subject: `Your order ${orderNo} is on its way`,
      body: `Hi ${name},\n\nExciting news, ${product} has been dispatched and is on its way to you. We hope you love it as much as we loved creating it for you.`,
    },
    delay: {
      subject: `An update on the timing of your order ${orderNo}`,
      body: `Hi ${name},\n\nWe wanted to be upfront and let you know your order is taking a little longer than expected. We are so sorry for the wait and are doing everything we can to get it to you soon. Thank you for your understanding.`,
    },
    custom: {
      subject: `An update on your order ${orderNo}`,
      body: `Hi ${name},\n\n`,
    },
  };

  const t = templates[type];
  return { update_type: type, subject: t.subject, message: t.body + signoff };
}

// The lifecycle milestones the queue can pre-draft for an order.
export const CUSTOMER_UPDATE_MILESTONES: CustomerUpdateType[] = [
  'order_received',
  'production_started',
  'production_checkin',
  'production_complete',
  'arrived_showroom',
  'dispatched',
];
