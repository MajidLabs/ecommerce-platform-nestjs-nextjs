import Link from 'next/link';
import { Plus } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Paginated, Product } from '@/lib/types';

export default async function AdminProductsPage() {
  const data = await serverFetch<Paginated<Product>>('/products?limit=100', {
    auth: true,
    revalidate: false,
  });
  const products = data?.items ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Products</h1>
        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> New product
          </Button>
        </Link>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-3 font-medium">Product</th>
            <th className="pb-3 font-medium">Category</th>
            <th className="pb-3 font-medium text-right">Price</th>
            <th className="pb-3 font-medium text-right">Stock</th>
            <th className="pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-line/60 hover:bg-line/10">
              <td className="py-3">
                <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-signal">
                  {p.name}
                </Link>
                <p className="font-mono text-xs text-muted">{p.slug}</p>
              </td>
              <td className="py-3 text-muted">{p.category?.name ?? '—'}</td>
              <td className="py-3 text-right tabular-nums">{formatCurrency(p.price)}</td>
              <td className="py-3 text-right tabular-nums">{p.inventory?.quantity ?? 0}</td>
              <td className="py-3">
                <Badge tone={p.isActive ? 'signal' : 'muted'}>
                  {p.isActive ? 'Active' : 'Disabled'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {products.length === 0 && <p className="mt-10 text-center text-muted">No products yet.</p>}
    </div>
  );
}
