import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/server-api';
import { ProductForm } from '@/components/admin/ProductForm';
import type { Product } from '@/lib/types';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await serverFetch<Product>(`/products/by-id/${params.id}`, {
    auth: true,
    revalidate: false,
  });
  if (!product) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl">Edit product</h1>
      <div className="mt-6">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
