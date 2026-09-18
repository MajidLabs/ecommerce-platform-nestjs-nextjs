import { serverFetch } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import { RevenueChart } from '@/components/admin/RevenueChart';
import type { RevenuePoint, SalesSummary, TopProduct } from '@/lib/types';

interface LowStockRow {
  productId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { startDate?: string; endDate?: string };
}) {
  const summaryQuery = new URLSearchParams();
  if (searchParams.startDate) summaryQuery.set('startDate', searchParams.startDate);
  if (searchParams.endDate) summaryQuery.set('endDate', searchParams.endDate);

  const [summary, revenue, topProducts, lowStock] = await Promise.all([
    serverFetch<SalesSummary>(`/reports/summary?${summaryQuery.toString()}`, {
      auth: true,
      revalidate: false,
    }),
    serverFetch<RevenuePoint[]>('/reports/revenue-by-day?days=90', { auth: true, revalidate: false }),
    serverFetch<TopProduct[]>('/reports/top-products?limit=20', { auth: true, revalidate: false }),
    serverFetch<LowStockRow[]>('/reports/low-stock', { auth: true, revalidate: false }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl">Reports</h1>

      <form className="mt-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">From</label>
          <input
            type="date"
            name="startDate"
            defaultValue={searchParams.startDate}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">To</label>
          <input
            type="date"
            name="endDate"
            defaultValue={searchParams.endDate}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded bg-ink px-4 py-2 text-sm text-paper">
          Apply
        </button>
      </form>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Revenue</p>
          <p className="mt-2 font-display text-2xl tabular-nums">
            {formatCurrency(summary?.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="rounded border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Orders</p>
          <p className="mt-2 font-display text-2xl tabular-nums">{summary?.totalOrders ?? 0}</p>
        </div>
        <div className="rounded border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Avg. order value</p>
          <p className="mt-2 font-display text-2xl tabular-nums">
            {formatCurrency(summary?.averageOrderValue ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded border border-line bg-white p-6">
        <h2 className="text-sm font-medium text-muted">Revenue, last 90 days</h2>
        <div className="mt-4">
          <RevenueChart data={revenue ?? []} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-muted">Top products</h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {(topProducts ?? []).map((tp) => (
                <tr key={tp.product?.id} className="border-b border-line/60">
                  <td className="py-2">{tp.product?.name ?? 'Unknown'}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{tp.totalSold} sold</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted">Low stock</h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {(lowStock ?? []).map((row) => (
                <tr key={row.productId} className="border-b border-line/60">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-right tabular-nums text-brick">{row.quantity} left</td>
                </tr>
              ))}
              {(!lowStock || lowStock.length === 0) && (
                <tr>
                  <td className="py-2 text-muted">Nothing below its reorder level.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
