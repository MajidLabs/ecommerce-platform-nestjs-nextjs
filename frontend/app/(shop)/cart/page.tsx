'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart-store';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import type { Cart } from '@/lib/types';

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshBadge = useCartStore((s) => s.refresh);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await api.get<Cart>('/cart');
    setCart(data);
    setLoading(false);
  }

  async function updateQty(itemId: string, quantity: number) {
    if (quantity < 1) return;
    await api.patch(`/cart/items/${itemId}`, { quantity });
    await load();
    refreshBadge();
  }

  async function remove(itemId: string) {
    await api.delete(`/cart/items/${itemId}`);
    await load();
    refreshBadge();
  }

  if (loading) return <p className="text-muted">Loading cart…</p>;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/products" className="mt-4 inline-block text-sm underline hover:text-signal">
          Browse products
        </Link>
      </div>
    );
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="font-display text-3xl">Your cart</h1>
        <div className="mt-8 divide-y divide-line border-t border-b border-line">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-5">
              <div className="flex-1">
                <p className="font-display text-base">{item.product.name}</p>
                <p className="mt-1 text-sm text-muted tabular-nums">
                  {formatCurrency(item.product.price)}
                </p>
              </div>

              <div className="flex items-center rounded border border-line">
                <button
                  onClick={() => updateQty(item.id, item.quantity - 1)}
                  className="p-2 text-muted hover:text-ink"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.id, item.quantity + 1)}
                  className="p-2 text-muted hover:text-ink"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="w-20 text-right text-sm tabular-nums">
                {formatCurrency(Number(item.product.price) * item.quantity)}
              </p>

              <button
                onClick={() => remove(item.id)}
                className="text-muted hover:text-brick"
                aria-label="Remove item"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <aside className="h-fit rounded border border-line p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Subtotal</span>
          <span className="tabular-nums text-lg">{formatCurrency(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">Shipping and any discount are calculated at checkout.</p>
        <Link href="/checkout">
          <Button className="mt-6 w-full">Proceed to checkout</Button>
        </Link>
      </aside>
    </div>
  );
}
