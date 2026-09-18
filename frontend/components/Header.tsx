'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api';

export function Header() {
  const { itemCount, refresh } = useCartStore();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<{ id: string }>('/users/me', { redirectOn401: false })
      .then(() => {
        setAuthed(true);
        refresh();
      })
      .catch(() => setAuthed(false));
  }, [refresh]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl font-medium tracking-tight">
          Northfield
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium sm:flex">
          <Link href="/products" className="hover:text-signal transition-colors">
            All products
          </Link>
          <Link href="/products?category=electronics" className="hover:text-signal transition-colors">
            Electronics
          </Link>
          <Link href="/products?category=clothing" className="hover:text-signal transition-colors">
            Clothing
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href={authed ? '/account/orders' : '/login'}
            className="flex items-center gap-1.5 text-sm hover:text-signal transition-colors"
          >
            <User className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">{authed ? 'Account' : 'Sign in'}</span>
          </Link>
          <Link href="/cart" className="relative flex items-center hover:text-signal transition-colors">
            <ShoppingBag className="h-[18px] w-[18px]" />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brick text-[10px] font-medium text-white tabular-nums">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
