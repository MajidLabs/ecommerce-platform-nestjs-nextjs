import { serverFetch } from '@/lib/server-api';
import { ProductCard } from '@/components/ProductCard';
import { Filters } from '@/components/Filters';
import type { Category, Paginated, Product } from '@/lib/types';

// Rendered per request (not ISR): search params make every filter
// combination effectively a different page, so caching one wouldn't help
// and could show stale results for a different query.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: {
    search?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = new URLSearchParams();
  if (searchParams.search) params.set('search', searchParams.search);
  if (searchParams.category) params.set('category', searchParams.category);
  if (searchParams.sort) params.set('sort', searchParams.sort);
  if (searchParams.page) params.set('page', searchParams.page);
  params.set('limit', '24');

  const [productsRes, categories] = await Promise.all([
    serverFetch<Paginated<Product>>(`/products?${params.toString()}`, { revalidate: false }),
    serverFetch<Category[]>('/categories', { revalidate: 300 }),
  ]);

  const products = productsRes?.items ?? [];

  return (
    <div>
      <h1 className="font-display text-3xl">All products</h1>
      <div className="mt-6 border-b border-line pb-6">
        <Filters categories={categories ?? []} />
      </div>

      {productsRes === null ? (
        <div className="py-24 text-center">
          <p className="text-muted">We&apos;re having trouble loading products right now. Please try again shortly.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-muted">No products match those filters.</p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {productsRes && productsRes.totalPages > 1 && (
        <p className="mt-10 text-center text-sm text-muted tabular-nums">
          Page {productsRes.page} of {productsRes.totalPages}
        </p>
      )}
    </div>
  );
}
