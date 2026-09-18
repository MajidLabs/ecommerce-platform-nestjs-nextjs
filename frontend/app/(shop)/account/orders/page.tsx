import Link from 'next/link';
import { serverFetch } from '@/lib/server-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import type { Order, OrderStatus } from '@/lib/types';

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'signal' | 'brick' | 'muted'> = {
  PENDING: 'neutral',
  PAID: 'signal',
  PROCESSING: 'signal',
  SHIPPED: 'signal',
  DELIVERED: 'signal',
  CANCELLED: 'brick',
  REFUNDED: 'brick',
};

export default async function OrdersPage() {
  const orders = (await serverFetch<Order[]>('/orders/mine', { auth: true, revalidate: false })) ?? [];

  return (
    <div>
      <h1 className="font-display text-3xl">Your orders</h1>

      {orders.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-muted">No orders yet.</p>
          <Link href="/products" className="mt-4 inline-block text-sm underline hover:text-signal">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 divide-y divide-line border-t border-b border-line">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between py-5">
              <div>
                <p className="font-mono text-sm text-muted">{order.id.slice(0, 8)}</p>
                <p className="mt-1 text-sm">{formatDate(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                <span className="w-20 text-right tabular-nums">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
