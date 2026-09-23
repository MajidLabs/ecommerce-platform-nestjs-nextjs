import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { AddToCartButton } from '@/components/AddToCartButton';
import { StockBadge, isAvailable } from '@/components/StockBadge';
import { formatCurrency, resolveImageUrl } from '@/lib/format';
import type { Product } from '@/lib/types';

// On-demand ISR: first request for a given slug renders and caches the
// page; subsequent requests are served from cache until it's older than
// `revalidate`, at which point the next request triggers a background
// re-render. No generateStaticParams — that would require querying the
// backend for every product slug at `next build` time.
export const revalidate = 3600;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverFetch<Product>(`/products/${slug}`);
  if (!product) notFound();

  const available = isAvailable(product.inventory?.quantity, product.inventory?.reserved);

  return (
    <div className="grid gap-10 sm:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded bg-line/30 flex items-center justify-center">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveImageUrl(product.images[0])} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-16 w-16 text-muted/40" />
        )}
      </div>

      <div>
        {product.category && (
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            {product.category.name}
          </p>
        )}
        <h1 className="mt-2 font-display text-3xl leading-tight">{product.name}</h1>
        <p className="mt-3 text-xl tabular-nums text-signal-dark">{formatCurrency(product.price)}</p>
        <div className="mt-3">
          <StockBadge quantity={product.inventory?.quantity} reserved={product.inventory?.reserved} />
        </div>

        <p className="mt-6 leading-relaxed text-muted">{product.description}</p>

        <div className="mt-8 max-w-sm">
          <AddToCartButton productId={product.id} disabled={!available} />
        </div>
      </div>
    </div>
  );
}
