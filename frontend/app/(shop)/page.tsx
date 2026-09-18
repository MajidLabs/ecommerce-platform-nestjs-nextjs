import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { ProductCard } from '@/components/ProductCard';
import type { Paginated, Product } from '@/lib/types';

export const revalidate = 120;

export default async function HomePage() {
  const data = await serverFetch<Paginated<Product>>('/products?limit=4&sort=newest');
  const products = data?.items ?? [];

  return (
    <div>
      <section className="grid gap-10 py-8 sm:grid-cols-2 sm:items-center sm:py-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-brick">
            New arrivals, honestly stocked
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            What's on the shelf is what's <em className="not-italic text-signal">actually</em> in stock.
          </h1>
          <p className="mt-5 max-w-md text-muted">
            No phantom inventory. Every product page shows the same stock count our
            warehouse team sees — right down to the last unit.
          </p>
          <Link
            href="/products"
            className="mt-7 inline-flex items-center gap-2 border-b border-ink pb-1 text-sm font-medium hover:gap-3 hover:text-signal hover:border-signal transition-all"
          >
            Browse all products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="aspect-square rounded bg-gradient-to-br from-signal/10 via-line/40 to-brick/10" />
      </section>

      {products.length > 0 && (
        <section className="border-t border-line py-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Just landed</h2>
            <Link href="/products" className="text-sm text-muted hover:text-signal transition-colors">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
