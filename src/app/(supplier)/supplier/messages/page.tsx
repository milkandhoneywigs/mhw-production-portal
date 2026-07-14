import { requireSupplier } from '@/lib/auth';
import { PageHeader, EmptyState } from '@/components/ui';
import { fetchThreads } from '@/lib/supplier-data';
import { MessagesFilter } from '@/components/supplier/MessagesFilter';

export const dynamic = 'force-dynamic';

// Central inbox: one row per order conversation, newest first.
export default async function SupplierMessagesPage() {
  const profile = await requireSupplier();
  const threads = await fetchThreads(profile.id);

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="All your conversations with Milk & Honey, in one place. Messages sent from an order page appear here too."
      />
      {threads.length === 0 ? (
        <EmptyState>No conversations yet. Open any order and send a message to start one.</EmptyState>
      ) : (
        <MessagesFilter
          threads={threads.map((t) => ({
            orderId: t.order.id,
            orderNumber: t.order.order_number,
            orderType: t.order.order_type,
            style: t.order.internal_style_name,
            latestBody: t.latest.body,
            latestSender: t.latest.sender_name,
            latestAt: t.latest.created_at,
            unread: t.unread,
            hasAttachment: t.hasAttachment,
          }))}
        />
      )}
    </>
  );
}
