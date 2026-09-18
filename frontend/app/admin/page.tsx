import Link from 'next/link';
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { StatCard } from '@/components/admin/StatCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatCurrency } from '@/lib/format';
import type { SalesSummary, RevenuePoint, TopProduct } from '@/lib/types';

interface LowStockRow {
  productId: string;
  name: string;
  slug: string;
  quantity: number;
  reorderLevel: number;
}

export default async function AdminDashboard() {
  const [summary, revenue, topProducts, lowStock] = await Promise.all([
    serverFetch<SalesSummary>('/reports/summary', { auth: true, revalidate: false }),
    serverFetch<RevenuePoint[]>('/reports/revenue-by-day?days=30', { auth: true, revalidate: false }),
    serverFetch<TopProduct[]>('/reports/top-products?limit=5', { auth: true, revalidate: false }),
    serverFetch<LowStockRow[]>('/reports/low-stock', { auth: true, revalidate: false }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl">Dashboard</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          icon={DollarSign}
        />
        <StatCard label="Orders" value={String(summary?.totalOrders ?? 0)} icon={ShoppingCart} />
        <StatCard
          label="Avg. order value"
          value={formatCurrency(summary?.averageOrderValue ?? 0)}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-8 rounded border border-line bg-white p-6">
        <h2 className="text-sm font-medium text-muted">Revenue, last 30 days</h2>
        <div className="mt-4">
          <RevenueChart data={revenue ?? []} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded border border-line bg-white p-6">
          <h2 className="text-sm font-medium text-muted">Top products</h2>
          <div className="mt-4 flex flex-col gap-3">
            {(topProducts ?? []).map((tp) => (
              <div key={tp.product?.id} className="flex items-center justify-between text-sm">
                <span>{tp.product?.name ?? 'Unknown product'}</span>
                <span className="tabular-nums text-muted">{tp.totalSold} sold</span>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-sm text-muted">No sales yet.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-line bg-white p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-brick" />
            <h2 className="text-sm font-medium text-muted">Low stock</h2>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {(lowStock ?? []).map((row) => (
              <Link
                key={row.productId}
                href={`/admin/products/${row.productId}`}
                className="flex items-center justify-between text-sm hover:text-signal"
              >
                <span>{row.name}</span>
                <span className="tabular-nums text-brick">{row.quantity} left</span>
              </Link>
            ))}
            {(!lowStock || lowStock.length === 0) && (
              <p className="text-sm text-muted">Everything's above its reorder level.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
