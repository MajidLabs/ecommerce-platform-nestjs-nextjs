import Link from 'next/link';
import { Plus } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Coupon } from '@/lib/types';

export default async function AdminCouponsPage() {
  const coupons = (await serverFetch<Coupon[]>('/coupons', { auth: true, revalidate: false })) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Coupons</h1>
        <Link href="/admin/coupons/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> New coupon
          </Button>
        </Link>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-3 font-medium">Code</th>
            <th className="pb-3 font-medium">Discount</th>
            <th className="pb-3 font-medium">Used</th>
            <th className="pb-3 font-medium">Expires</th>
            <th className="pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id} className="border-b border-line/60 hover:bg-line/10">
              <td className="py-3 font-mono">{c.code}</td>
              <td className="py-3">
                {c.type === 'PERCENTAGE' ? `${c.value}%` : formatCurrency(c.value)}
                {c.maxDiscountAmount && (
                  <span className="text-muted"> (cap {formatCurrency(c.maxDiscountAmount)})</span>
                )}
              </td>
              <td className="py-3 tabular-nums text-muted">
                {c.usedCount}
                {c.usageLimit ? ` / ${c.usageLimit}` : ''}
              </td>
              <td className="py-3 text-muted">{c.validUntil ? formatDate(c.validUntil) : '—'}</td>
              <td className="py-3">
                <Badge tone={c.isActive ? 'signal' : 'muted'}>{c.isActive ? 'Active' : 'Disabled'}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {coupons.length === 0 && <p className="mt-10 text-center text-muted">No coupons yet.</p>}
    </div>
  );
}
