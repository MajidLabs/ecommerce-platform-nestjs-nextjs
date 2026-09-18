import Link from 'next/link';
import { Package } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatCurrency, resolveImageUrl } from '@/lib/format';
import { StockBadge } from './StockBadge';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col">
      <div className="aspect-[4/5] w-full overflow-hidden rounded bg-line/30 flex items-center justify-center">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(product.images[0])}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Package className="h-10 w-10 text-muted/40" />
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base leading-snug">{product.name}</h3>
          <p className="mt-1 text-sm text-muted tabular-nums">{formatCurrency(product.price)}</p>
        </div>
      </div>
      <div className="mt-1.5">
        <StockBadge
          quantity={product.inventory?.quantity}
          reserved={product.inventory?.reserved}
        />
      </div>
    </Link>
  );
}
