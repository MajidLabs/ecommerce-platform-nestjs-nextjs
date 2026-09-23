import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/server-api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusControl } from '@/components/admin/OrderStatusControl';
import type { Order } from '@/lib/types';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await serverFetch<Order>(`/orders/${id}`, { auth: true, revalidate: false });
  if (!order) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl">Order {order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-muted">{formatDateTime(order.createdAt)}</p>
        </div>
        <Badge tone="signal">{order.status}</Badge>
      </div>

      {order.user && (
        <p className="mt-4 text-sm">
          <span className="text-muted">Customer: </span>
          {order.user.firstName} {order.user.lastName} ({order.user.email})
        </p>
      )}

      <div className="mt-6 rounded border border-line p-5">
        <h2 className="text-sm font-medium text-muted">Update status</h2>
        <div className="mt-3">
          <OrderStatusControl orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      <div className="mt-6 divide-y divide-line border-t border-b border-line">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-4 text-sm">
            <span>
              {item.product?.name ?? 'Product'} <span className="text-muted">× {item.quantity}</span>
            </span>
            <span className="tabular-nums">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
        </div>
        {Number(order.discountAmount) > 0 && (
          <div className="flex justify-between text-brick">
            <span>Discount</span>
            <span className="tabular-nums">-{formatCurrency(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
        </div>
      </div>

      <div className="mt-6 text-sm">
        <h2 className="text-muted">Shipping to</h2>
        <p className="mt-1">
          {order.shippingLine1}, {order.shippingCity}
          {order.shippingState ? `, ${order.shippingState}` : ''} {order.shippingPostal},{' '}
          {order.shippingCountry}
        </p>
      </div>

      {order.payment && (
        <div className="mt-6 text-sm">
          <h2 className="text-muted">Payment</h2>
          <p className="mt-1">
            {order.payment.status}
            {order.payment.providerRef && (
              <span className="ml-2 font-mono text-xs text-muted">{order.payment.providerRef}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
