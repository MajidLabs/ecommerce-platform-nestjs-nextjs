'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/format';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Category, Product } from '@/lib/types';

interface ProductFormProps {
  product?: Product;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    categoryId: product?.categoryId ?? '',
    initialStock: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await api.upload<{ url: string }>(
        '/uploads/product-image',
        formData,
      );
      setImages((prev) => [...prev, url]);
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : 'Could not upload image',
      );
    } finally {
      setUploading(false);
      // Reset the input so selecting the same file twice still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((i) => i !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (product) {
        await api.patch(`/products/${product.id}`, {
          name: form.name,
          slug: form.slug,
          description: form.description,
          price: Number(form.price),
          categoryId: form.categoryId,
          images,
        });
      } else {
        await api.post('/products', {
          name: form.name,
          slug: form.slug,
          description: form.description,
          price: Number(form.price),
          categoryId: form.categoryId,
          images,
          initialStock: form.initialStock ? Number(form.initialStock) : 0,
        });
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save product');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!product) return;
    if (!confirm('Deactivate this product? It will stop showing in the storefront.')) return;
    await api.delete(`/products/${product.id}`);
    router.push('/admin/products');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      <div className="flex flex-col gap-4">
        <Input label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input
          label="Slug"
          required
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers, and hyphens only"
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
        />

        <div>
          <label className="text-sm font-medium text-ink">Description</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="mt-1.5 w-full rounded border border-line px-3 py-2.5 text-sm focus:border-signal"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink">Images</label>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {images.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-0.5 top-0.5 rounded-sm bg-ink/70 p-0.5 text-paper hover:bg-brick"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-line text-muted hover:border-signal hover:text-signal disabled:opacity-50"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">{uploading ? 'Uploading…' : 'Add'}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="mt-1.5 text-xs text-muted">JPEG, PNG or WebP, up to 5MB each.</p>
          {uploadError && <p className="mt-1 text-xs text-brick">{uploadError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (USD)"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
          />
          <Select
            label="Category"
            required
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {!product && (
          <Input
            label="Initial stock"
            type="number"
            min="0"
            value={form.initialStock}
            onChange={(e) => set('initialStock', e.target.value)}
          />
        )}

        {error && <p className="text-sm text-brick">{error}</p>}

        <div className="mt-2 flex items-center gap-3">
          <Button type="submit" loading={loading}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
          {product && (
            <Button type="button" variant="danger" onClick={handleDeactivate}>
              Deactivate
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
