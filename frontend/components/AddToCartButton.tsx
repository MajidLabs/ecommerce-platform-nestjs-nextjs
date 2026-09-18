'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { api, ApiError } from '@/lib/api';
import { useCartStore } from '@/store/cart-store';

export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const refresh = useCartStore((s) => s.refresh);
  const router = useRouter();

  async function handleAdd() {
    setLoading(true);
    try {
      await api.post('/cart/items', { productId, quantity });
      await refresh();
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded border border-line">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="p-2.5 text-muted hover:text-ink disabled:opacity-30"
          disabled={disabled}
          aria-label="Decrease quantity"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          className="p-2.5 text-muted hover:text-ink disabled:opacity-30"
          disabled={disabled}
          aria-label="Increase quantity"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <Button onClick={handleAdd} loading={loading} disabled={disabled} className="flex-1">
        {disabled ? 'Out of stock' : added ? 'Added' : 'Add to cart'}
      </Button>
    </div>
  );
}
