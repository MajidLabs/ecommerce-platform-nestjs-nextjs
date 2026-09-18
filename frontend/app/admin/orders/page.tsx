import Link from 'next/link';
import { serverFetch } from '@/lib/server-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import type { Order, OrderStatus, Paginated } from '@/lib/types';

const STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'signal' | 'brick' | 'muted'> = {
  PENDING: 'neutral',
  PAID: 'signal',
  PROCESSING: 'signal',
  SHIPPED: 'signal',
  DELIVERED: 'signal',
  CANCELLED: 'brick',
  REFUNDED: 'brick',
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: OrderStatus };
}) {
  const query = searchParams.status ? `?status=${searchParams.status}&limit=100` : '?limit=100';
  const data = await serverFetch<Paginated<Order>>(`/orders${query}`, {
    auth: true,
    revalidate: false,
  });
  const orders = data?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full border px-3 py-1 text-xs ${
            !searchParams.status ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              searchParams.status === s ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-3 font-medium">Order</th>
            <th className="pb-3 font-medium">Customer</th>
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-line/60 hover:bg-line/10">
              <td className="py-3">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-mono text-xs hover:text-signal"
                >
                  {order.id.slice(0, 8)}
                </Link>
              </td>
              <td className="py-3 text-muted">
                {order.user ? `${order.user.firstName} ${order.user.lastName}` : '—'}
              </td>
              <td className="py-3 text-muted">{formatDate(order.createdAt)}</td>
              <td className="py-3">
                <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
              </td>
              <td className="py-3 text-right tabular-nums">{formatCurrency(order.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && <p className="mt-10 text-center text-muted">No orders in this view.</p>}
    </div>
  );
}
